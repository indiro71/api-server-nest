import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import { randomBytes } from 'crypto';
import { Document, Model } from 'mongoose';
import { AccountOrderV5 } from 'bybit-api';
import { BybitService, BybitTrackedOrderError } from '../../../services/bybit/bybit.service';
import { TelegramService } from '../../../services/telegram/telegram.service';
import { PushService } from '../../../push/push.service';
import { Exchange } from '../../trading.interfaces';
import { BybitMarketPositionSide as Side } from '../dto/buy-bybit-market-position.dto';
import { Pair, PairDocument } from '../schemas/pair.schema';
import { ArmInsuranceDto, RefreshInsuranceDto } from './insurance.dto';
import {
  alignTriggerPrice,
  insuranceMinimumMargin,
  insuranceRefreshPercent,
  insuranceRemainingMargin,
  positionQuantity,
  validatePositionQuantity,
} from './insurance-quantity';
import {
  INSURANCE_MODEL,
  InsuranceDocument,
  InsurancePhase,
  InsuranceResult,
  LOCK_MODEL,
} from './insurance.schema';

const sides = [Side.LONG, Side.SHORT];
const terminalStatuses = new Set(['Filled', 'Cancelled', 'Rejected', 'Deactivated', 'PartiallyFilledCanceled']);
const uncertainOrderCodes = new Set([10000, 10006, 10014, 10016, 10019, 110072, 110079]);
const lockDurationMs = 120_000;

interface Scope {
  exchangeAccount: number;
  symbol: string;
}

interface PositionSnapshot {
  size: number;
  avgPrice: number;
  leverage: number;
}

export interface InsuranceView {
  id: string;
  phase: InsurancePhase;
  blocking: boolean;
  triggerPrice: string;
  result?: InsuranceResult;
}

export type PairWithInsurance = Pair & { insurance?: Partial<Record<Side, InsuranceView>> };

@Injectable()
export class InsuranceService {
  private readonly logger = new Logger(InsuranceService.name);
  private reconciling = false;

  constructor(
    @InjectModel(INSURANCE_MODEL) private readonly model: Model<InsuranceDocument>,
    @InjectModel(LOCK_MODEL) private readonly locks: Model<Document>,
    private readonly bybit: BybitService,
    private readonly telegram: TelegramService,
    private readonly push: PushService,
  ) {}

  async preview(pair: Pair, side: Side) {
    this.validatePair(pair, side);
    await this.assertTradeAllowed(pair, side, false);
    return (await this.getQuote(pair, side)).quote;
  }

  async arm(pair: Pair, dto: ArmInsuranceDto) {
    this.validatePair(pair, dto.side);
    if (typeof dto.requestId !== 'string' || !/^[a-f0-9]{32}$/.test(dto.requestId)) {
      throw new BadRequestException('Некорректный идентификатор запроса');
    }

    const scope = this.getScope(pair);
    return this.withTradeLock(scope, async () => {
      const existing = await this.model.findById(dto.requestId);
      if (existing) {
        this.assertInsuranceScope(existing, scope, dto.side);
        await this.tryReconcile(existing);
        return this.toView(existing);
      }

      await this.assertTradeAllowed(pair, dto.side, false);
      const { quote, position } = await this.getQuote(pair, dto.side);
      if (dto.triggerPrice !== quote.triggerPrice || dto.qty !== quote.qty) {
        throw new ConflictException('Параметры позиции изменились. Обновите расчёт страховки.');
      }

      const insurance = await this.model.create({
        ...scope,
        ...position,
        _id: dto.requestId,
        scope: this.scopeKey(scope),
        name: pair.name,
        side: dto.side,
        phase: 'placing',
        blocking: true,
        triggerPrice: quote.triggerPrice,
        qty: quote.qty,
        displayLeverage: Number(pair.leverage),
      });

      await this.tryReconcile(insurance);
      return this.toView(insurance);
    });
  }

  async refresh(pair: Pair, dto: RefreshInsuranceDto) {
    this.validatePair(pair, dto.side);
    if (typeof dto.insuranceId !== 'string' || !/^[a-f0-9]{32}$/.test(dto.insuranceId)) {
      throw new BadRequestException('Некорректный идентификатор страховки');
    }

    const scope = this.getScope(pair);
    return this.withTradeLock(scope, async () => {
      const insurance = await this.model.findById(dto.insuranceId);
      this.assertInsuranceScope(insurance, scope, dto.side);

      if (insurance.phase !== 'active') {
        await this.tryReconcile(insurance);
        return this.toView(insurance);
      }

      const order = await this.bybit.getTrackedOrder(scope.exchangeAccount, scope.symbol, this.orderLinkId(insurance));
      if (order?.orderStatus !== 'Untriggered') {
        if (order && terminalStatuses.has(order.orderStatus)) await this.finishConditionalOrder(insurance, order);
        return this.toView(insurance);
      }

      const [position, price, instrument] = await Promise.all([
        this.getPosition(scope, dto.side),
        this.getPrice(scope),
        this.bybit.getInstrument(scope.symbol),
      ]);
      this.requireOriginalPosition(insurance, position);
      const displayLeverage = Number(pair.leverage);
      if (this.getProfitPercent(position, price, displayLeverage, dto.side) <= insuranceRefreshPercent) {
        throw new ConflictException('Процент позиции должен быть больше 50%');
      }

      const qty = this.quantityOrBadRequest(() =>
        positionQuantity(position.size, instrument.lotSizeFilter, price, position.size / 2));
      await this.advance(insurance, 'cancelling', { refreshRequested: true, refreshQty: qty, displayLeverage });
      await this.tryReconcile(insurance);
      return this.toView(insurance);
    });
  }

  async projectPairs(pairs: Pair[]): Promise<PairWithInsurance[]> {
    const scopes = Array.from(new Set(pairs.filter(pair => pair.exchange === Exchange.BYBIT)
      .map(pair => this.scopeKey(this.getScope(pair)))));
    if (!scopes.length) return pairs;

    const records = await this.model.aggregate<{ insurance: InsuranceDocument }>([
      { $match: { scope: { $in: scopes } } },
      { $sort: { blocking: -1, createdAt: -1 } },
      { $group: { _id: { scope: '$scope', side: '$side' }, insurance: { $first: '$$ROOT' } } },
    ]);
    const byScope = new Map<string, Partial<Record<Side, InsuranceView>>>();
    for (const { insurance } of records) {
      const scope = byScope.get(insurance.scope) ?? {};
      scope[insurance.side] = this.toView(insurance);
      byScope.set(insurance.scope, scope);
    }

    return pairs.map(pair => {
      if (pair.exchange !== Exchange.BYBIT) return pair;
      const insurance = byScope.get(this.scopeKey(this.getScope(pair)));
      if (!insurance) return pair;
      const document = pair as PairDocument;
      const data: Pair = typeof document.toObject === 'function' ? document.toObject() : pair;
      return {
        ...data,
        insurance,
        ...(insurance.short?.blocking ? { nextBuyLongPrice: 0 } : {}),
        ...(insurance.long?.blocking ? { nextBuyShortPrice: 0 } : {}),
      };
    });
  }

  async assertTradeAllowed(pair: Pair, side: Side, isBuy: boolean) {
    const blocked = await this.model.exists({
      scope: this.scopeKey(this.getScope(pair)),
      blocking: true,
      ...(isBuy ? {} : { side }),
    });
    if (blocked) throw new ConflictException('Операция недоступна, пока действует страховка');
  }

  async withTradeLock<T>(scope: Scope, action: () => Promise<T>): Promise<T> {
    const key = this.scopeKey(scope);
    const token = randomBytes(16).toString('hex');
    const expiresAt = () => new Date(Date.now() + lockDurationMs);
    try {
      await this.locks.findOneAndUpdate(
        { _id: key, expiresAt: { $lte: new Date() } },
        { $set: { token, expiresAt: expiresAt() } },
        { upsert: true },
      );
    } catch (error) {
      if (error?.code === 11000) throw new ConflictException('Для этой пары уже выполняется операция');
      throw error;
    }

    const renewal = setInterval(() => {
      void this.locks.updateOne({ _id: key, token }, { $set: { expiresAt: expiresAt() } })
        .catch(error => this.logger.error(error.message));
    }, lockDurationMs / 4);
    renewal.unref();

    try {
      return await action();
    } finally {
      clearInterval(renewal);
      await this.locks.deleteOne({ _id: key, token }).catch(error => this.logger.error(error.message));
    }
  }

  @Cron('*/15 * * * * *')
  async reconcileOrders() {
    if (this.reconciling) return;
    this.reconciling = true;
    try {
      const pending = await this.model.find({
        $or: [
          { blocking: true },
          { notification: { $exists: true }, telegramClaimed: { $ne: true } },
          { notification: { $exists: true }, pushClaimed: { $ne: true } },
        ],
      }).sort({ updatedAt: 1 });

      for (const record of pending) {
        try {
          await this.withTradeLock(record, async () => {
            const insurance = await this.model.findById(record.id);
            if (insurance.blocking) await this.tryReconcile(insurance);
            if (insurance.notification) await this.notify(insurance);
          });
        } catch (error) {
          if (!(error instanceof ConflictException)) this.logger.error(error.message);
        }
      }
    } catch (error) {
      this.logger.error(error.message);
    } finally {
      this.reconciling = false;
    }
  }

  private async tryReconcile(insurance: InsuranceDocument) {
    try {
      await this.reconcile(insurance);
    } catch (error) {
      this.logger.warn(`${insurance.id} ${insurance.phase}: ${error.message}`);
    }
  }

  private async reconcile(insurance: InsuranceDocument) {
    if (!insurance.blocking) return;
    const { exchangeAccount, symbol, side, phase } = insurance;
    if ((phase === 'placing' || phase === 'closing' || phase === 'reopening') && !insurance.attemptedAt) {
      await this.submit(insurance);
      return;
    }
    const order = await this.bybit.getTrackedOrder(exchangeAccount, symbol, this.orderLinkId(insurance));
    if (phase === 'placing' || phase === 'active' || phase === 'cancelling') {
      if (order && terminalStatuses.has(order.orderStatus)) {
        if (phase === 'cancelling' && insurance.refreshRequested
            && ['Cancelled', 'Deactivated'].includes(order.orderStatus) && Number(order.cumExecQty) === 0) {
          await this.advance(insurance, 'closing', { attemptedAt: undefined });
          await this.submit(insurance);
        } else {
          await this.finishConditionalOrder(insurance, order);
        }
        return;
      }

      if (order?.orderStatus === 'Untriggered') {
        if (phase === 'placing') await this.advance(insurance, 'active');
        if (insurance.phase === 'active' && !this.matchesOriginalPosition(insurance, await this.getPosition(insurance, side))) {
          await this.advance(insurance, 'cancelling');
        }
        if (insurance.phase === 'cancelling') {
          await this.bybit.cancelTrackedOrder(exchangeAccount, symbol, this.orderLinkId(insurance));
        }
      }
      return;
    }

    if (!order || !terminalStatuses.has(order.orderStatus)) return;
    const executedQty = Number(order.cumExecQty);
    if (!Number.isFinite(executedQty) || (order.orderStatus === 'Filled' && executedQty === 0)) return;

    if (phase === 'closing') {
      if (executedQty > 0) {
        await this.advance(insurance, 'reopening', { closedQty: order.cumExecQty, attemptedAt: undefined });
        await this.submit(insurance);
      } else {
        await this.finishRefresh(insurance, 0, 'Закрытие половины позиции не исполнилось');
      }
      return;
    }

    if (phase === 'reopening') {
      const fullyRestored = executedQty === Number(insurance.closedQty);
      const message = !fullyRestored ? 'Объём позиции восстановлен не полностью'
        : Number(insurance.closedQty) < Number(insurance.refreshQty) ? 'Закрытие исполнилось частично, исполненный объём восстановлен'
        : 'Обновление страховки завершено';
      await this.finishRefresh(insurance, executedQty, message);
    }
  }

  private async submit(insurance: InsuranceDocument) {
    const { phase, side, symbol, exchangeAccount } = insurance;
    const position = await this.getPosition(insurance, side);
    if (phase !== 'reopening' && !this.matchesOriginalPosition(insurance, position)) {
      await this.finish(insurance, { success: false, message: 'Позиция изменилась. Проверьте её в Bybit.' });
      return;
    }

    const price = await this.getPrice(insurance);
    if (phase === 'placing' && !(side === Side.LONG
      ? price > Number(insurance.triggerPrice) : price < Number(insurance.triggerPrice))) {
      await this.finish(insurance, { success: false, message: 'Цена уже вернулась к уровню закрытия' });
      return;
    }
    if (phase === 'closing' && this.getProfitPercent(position, price, insurance.displayLeverage, side) <= insuranceRefreshPercent) {
      await this.finishRefresh(insurance, 0, 'На момент закрытия процент позиции уже не превышает 50%');
      return;
    }
    if (phase === 'reopening' && !this.matchesPositionAfterClose(insurance, position)) {
      // The execution can appear before the position update. Allow the next poll to see it.
      if (Date.now() - insurance.updatedAt.getTime() < 30_000) return;
      await this.finishRefresh(insurance, 0, 'Позиция изменилась после закрытия. Проверьте её в Bybit.');
      return;
    }

    const qty = phase === 'placing' ? insurance.qty : phase === 'closing' ? insurance.refreshQty : insurance.closedQty;
    if (phase === 'reopening') {
      const instrument = await this.bybit.getInstrument(symbol);
      try {
        validatePositionQuantity(qty, instrument.lotSizeFilter, price, false);
      } catch (error) {
        await this.finishRefresh(insurance, 0, error.message);
        return;
      }
    }

    // Record the attempt before contacting the exchange. An ambiguous response is reconciled by link ID.
    insurance.attemptedAt = new Date();
    await insurance.save();
    try {
      await this.bybit.submitTrackedMarketOrder(exchangeAccount, {
        symbol,
        positionIdx: this.positionIdx(side),
        qty,
        orderLinkId: this.orderLinkId(insurance),
        reduceOnly: phase !== 'reopening',
        triggerPrice: phase === 'placing' ? insurance.triggerPrice : undefined,
      });
    } catch (error) {
      if (!(error instanceof BybitTrackedOrderError) || uncertainOrderCodes.has(error.code)) throw error;
      if (phase === 'placing') {
        await this.finish(insurance, { success: false, message: error.message });
      } else {
        await this.finishRefresh(insurance, 0, error.message);
      }
      return;
    }

    if (phase === 'placing') await this.reconcile(insurance);
  }

  private async finishConditionalOrder(insurance: InsuranceDocument, order: AccountOrderV5) {
    const closedQty = Number(order.cumExecQty);
    if (!Number.isFinite(closedQty) || (closedQty === 0 && order.orderStatus === 'Filled')) return;
    if (closedQty === 0) {
      const cancelled = ['Cancelled', 'Deactivated'].includes(order.orderStatus);
      await this.finish(insurance, {
        success: cancelled,
        message: cancelled ? 'Страховка отменена' : `Страховой ордер отклонён: ${order.rejectReason}`,
      });
      return;
    }

    const position = await this.getPosition(insurance, insurance.side);
    const remainingQty = position?.size ?? 0;
    if (remainingQty === insurance.size && Date.now() - Number(order.updatedTime) < 30_000) return;
    const partial = closedQty < Number(insurance.qty);
    const message = partial ? 'Страховка исполнена частично' : 'Сработала страховка';
    const notification = `${message} для ${insurance.name} (${insurance.symbol}, аккаунт ${insurance.exchangeAccount}) `
      + `${insurance.side.toUpperCase()}. Закрыто: ${closedQty}. Остаток: ${remainingQty}.`;
    await this.finish(insurance, { success: !partial, message, closedQty, remainingQty }, notification);
  }

  private async finishRefresh(insurance: InsuranceDocument, restoredQty: number, message: string) {
    const closedQty = Number(insurance.closedQty ?? 0);
    await this.finish(insurance, {
      success: closedQty > 0 && closedQty === restoredQty,
      closedQty,
      restoredQty,
      message: `${message}. Закрыто: ${closedQty}. Восстановлено: ${restoredQty}.`,
    });
  }

  private async advance(insurance: InsuranceDocument, phase: InsurancePhase, data: Partial<InsuranceDocument> = {}) {
    insurance.set({ ...data, phase });
    await insurance.save();
  }

  private async finish(insurance: InsuranceDocument, result: InsuranceResult, notification?: string) {
    await this.advance(insurance, 'finished', { blocking: false, result, notification });
  }

  private async notify(insurance: InsuranceDocument) {
    const { id, notification } = insurance;
    const telegram = await this.model.findOneAndUpdate({ _id: id, telegramClaimed: { $ne: true } },
      { $set: { telegramClaimed: true } });
    if (telegram) {
      await this.telegram.sendMessage(notification).catch(error => this.logger.error(error.message));
    }

    const push = await this.model.findOneAndUpdate({ _id: id, pushClaimed: { $ne: true } },
      { $set: { pushClaimed: true } });
    if (push) {
      await this.push.sendMessage('Страховой заработок', notification, `insurance-${id}`)
        .catch(error => this.logger.error(error.message));
    }
  }

  private async getQuote(pair: Pair, side: Side) {
    const scope = this.getScope(pair);
    const isLong = side === Side.LONG;
    const [position, price, instrument] = await Promise.all([
      this.getPosition(scope, side),
      this.getPrice(scope),
      this.bybit.getInstrument(scope.symbol),
    ]);
    if (instrument.settleCoin !== 'USDT' || !position || !(position.leverage > 0) || !(position.avgPrice > 0)) {
      throw new BadRequestException('Для страховки нужна открытая USDT-позиция с известным плечом');
    }

    const baseMargin = position.size * position.avgPrice / position.leverage;
    if (baseMargin <= insuranceMinimumMargin) {
      throw new BadRequestException('Базовая маржа должна быть больше 25 USDT');
    }

    const sellPrice = Number(isLong ? pair.sellLongPrice : pair.sellShortPrice);
    const cachedEntry = Number(isLong ? pair.longPrice : pair.shortPrice);
    const cachedMargin = Number(isLong ? pair.longMargin : pair.shortMargin);
    const marginStep = Number(isLong ? pair.longMarginStep : pair.shortMarginStep);
    if (position.avgPrice !== cachedEntry || (baseMargin < marginStep) !== (cachedMargin < marginStep)) {
      throw new ConflictException('Позиция изменилась. Дождитесь обновления таблицы.');
    }

    const triggerPrice = alignTriggerPrice(sellPrice, instrument.priceFilter.tickSize, isLong);
    if (!(sellPrice > 0) || !(Number(triggerPrice) > 0) || !(isLong ? price > sellPrice : price < sellPrice)) {
      throw new BadRequestException('Цена должна пройти расчётный уровень закрытия');
    }
    const keepQty = insuranceRemainingMargin * position.leverage / position.avgPrice;
    const qty = this.quantityOrBadRequest(() => positionQuantity(position.size, instrument.lotSizeFilter, price, keepQty));
    const remainingMargin = (position.size - Number(qty)) * position.avgPrice / position.leverage;
    return { position, quote: { triggerPrice, qty, remainingMargin } };
  }

  private quantityOrBadRequest(calculate: () => string) {
    try {
      return calculate();
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  private async getPosition(scope: Scope, side: Side): Promise<PositionSnapshot | undefined> {
    const response = await this.bybit.getPositions(scope.exchangeAccount, scope.symbol);
    if (response?.retCode !== 0 || !Array.isArray(response.result?.list)) {
      throw new Error(response?.retMsg || 'Bybit не вернул позиции');
    }
    const position = response.result.list.find(item => item.positionIdx === this.positionIdx(side) && Number(item.size) > 0);
    if (!position) return undefined;
    return { size: Number(position.size), avgPrice: Number(position.avgPrice), leverage: Number(position.leverage) };
  }

  private async getPrice(scope: Scope) {
    const price = Number(await this.bybit.getContractFairPrice(scope.symbol));
    if (!(price > 0) || !Number.isFinite(price)) throw new Error('Bybit не вернул актуальную цену');
    return price;
  }

  private getProfitPercent(position: PositionSnapshot, price: number, leverage: number, side: Side) {
    return (price / position.avgPrice * 100 - 100) * (leverage || position.leverage) * (side === Side.LONG ? 1 : -1);
  }

  private matchesOriginalPosition(insurance: InsuranceDocument, position?: PositionSnapshot) {
    return position?.size === insurance.size && position.avgPrice === insurance.avgPrice && position.leverage === insurance.leverage;
  }

  private matchesPositionAfterClose(insurance: InsuranceDocument, position?: PositionSnapshot) {
    const expected = insurance.size - Number(insurance.closedQty);
    return position && Math.abs(position.size - expected) <= expected * 1e-10
      && position.avgPrice === insurance.avgPrice && position.leverage === insurance.leverage;
  }

  private requireOriginalPosition(insurance: InsuranceDocument, position?: PositionSnapshot) {
    if (!this.matchesOriginalPosition(insurance, position)) {
      throw new ConflictException('Позиция изменилась. Дождитесь сверки страховки с Bybit.');
    }
  }

  private validatePair(pair: Pair, side: Side) {
    if (!sides.includes(side) || pair.exchange !== Exchange.BYBIT || pair.isActive === false) {
      throw new BadRequestException('Страховка доступна для активных пар Bybit');
    }
    const { exchangeAccount } = this.getScope(pair);
    if (!Number.isInteger(exchangeAccount) || exchangeAccount < 1) {
      throw new BadRequestException('Некорректный аккаунт Bybit');
    }
  }

  private assertInsuranceScope(insurance: InsuranceDocument, scope: Scope, side: Side) {
    if (!insurance || insurance.scope !== this.scopeKey(scope) || insurance.side !== side) {
      throw new BadRequestException('Страховка для этой позиции не найдена');
    }
  }

  private positionIdx(side: Side): 1 | 2 {
    return side === Side.LONG ? 1 : 2;
  }

  private getScope(pair: Pair): Scope {
    return { exchangeAccount: Number(pair.exchangeAccount || 1), symbol: pair.symbol };
  }

  private scopeKey({ exchangeAccount, symbol }: Scope) {
    return `${exchangeAccount}:${symbol}`;
  }

  private orderLinkId({ _id, phase }: InsuranceDocument) {
    const suffix = phase === 'closing' ? 'c' : phase === 'reopening' ? 'r' : 's';
    return `i-${_id}-${suffix}`;
  }

  private toView(insurance: InsuranceDocument): InsuranceView {
    return {
      id: insurance._id,
      phase: insurance.phase,
      blocking: insurance.blocking,
      triggerPrice: insurance.triggerPrice,
      result: insurance.result,
    };
  }
}
