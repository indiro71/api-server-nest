import { AccountOrderV5 } from 'bybit-api';
import { BybitService } from '../../../services/bybit/bybit.service';
import { PushService } from '../../../push/push.service';
import { TelegramService } from '../../../services/telegram/telegram.service';
import { BybitMarketPositionSide as Side } from '../dto/buy-bybit-market-position.dto';
import { PairController } from '../pair.controller';
import { PairService } from '../pair.service';
import { Pair } from '../schemas/pair.schema';
import { InsuranceDocument } from './insurance.schema';
import { InsuranceService } from './insurance.service';

jest.mock('bybit-api', () => ({ RestClientV5: jest.fn() }));

const requestId = 'a'.repeat(32);
const insuranceLink = `i-${requestId}-s`;
const closeLink = `i-${requestId}-c`;
const reopenLink = `i-${requestId}-r`;
const pair = {
  name: 'BTC',
  symbol: 'BTCUSDT',
  exchange: 'BYBIT',
  exchangeAccount: 2,
  isActive: true,
  leverage: 10,
  longPrice: 100,
  shortPrice: 100,
  longMargin: 45,
  shortMargin: 45,
  longMarginStep: 5,
  shortMarginStep: 5,
  sellLongPrice: 101.34,
  sellShortPrice: 98.66,
  nextBuyLongPrice: 95,
  nextBuyShortPrice: 105,
} as Pair;

function exchangeOrder(orderStatus: AccountOrderV5['orderStatus'], cumExecQty = '0') {
  return { orderStatus, cumExecQty, updatedTime: '0' } as AccountOrderV5;
}

function setup() {
  const orders = new Map<string, AccountOrderV5>();
  const records = new Map<string, InsuranceDocument>();
  const record = () => records.get(requestId);
  const position = { positionIdx: 1, size: '4.5', avgPrice: '100', leverage: '10' };
  const bybit = {
    openMarketPosition: jest.fn(),
    getContractFairPrice: jest.fn().mockResolvedValue('102'),
    getPositions: jest.fn(async () => ({ retCode: 0, result: { list: [{ ...position }] } })),
    getInstrument: jest.fn().mockResolvedValue({
      settleCoin: 'USDT',
      lotSizeFilter: { qtyStep: '0.1', minOrderQty: '0.1', maxMktOrderQty: '100', minNotionalValue: '5' },
      priceFilter: { tickSize: '0.1' },
    }),
    getTrackedOrder: jest.fn(async (_account: number, _symbol: string, id: string) => orders.get(id)),
    submitTrackedMarketOrder: jest.fn(async (_account: number, order: { orderLinkId: string; triggerPrice?: string }) => {
      orders.set(order.orderLinkId, exchangeOrder(order.triggerPrice ? 'Untriggered' : 'New'));
    }),
    cancelTrackedOrder: jest.fn().mockResolvedValue(undefined),
  };
  const model = {
    aggregate: jest.fn(async () => Array.from(records.values()).map(insurance => ({ insurance }))),
    create: jest.fn(async (data) => {
      const doc = {
        ...data,
        id: data._id,
        updatedAt: new Date(),
        set(fields: object) { Object.assign(this, fields); },
        save() { this.updatedAt = new Date(); return Promise.resolve(this); },
      };
      records.set(doc._id, doc);
      return doc;
    }),
    find: jest.fn(() => ({
      sort: async () => Array.from(records.values()).filter(doc =>
        doc.blocking || (doc.notification && (!doc.telegramClaimed || !doc.pushClaimed))),
    })),
    findById: jest.fn(async (id: string) => records.get(id)),
    findOneAndUpdate: jest.fn(async (filter, update) => {
      const doc = records.get(filter._id);
      const field = Object.keys(update.$set)[0];
      if (!doc || doc[field]) return null;
      Object.assign(doc, update.$set);
      return doc;
    }),
    exists: jest.fn(async (filter) => Array.from(records.values()).some(doc =>
      doc.scope === filter.scope && doc.blocking && (!filter.side || doc.side === filter.side))),
  };
  const telegram = { sendMessage: jest.fn().mockResolvedValue(null) };
  const push = { sendMessage: jest.fn().mockResolvedValue(null) };
  const restart = () => {
    const service = new InsuranceService(
      model as never, null, bybit as unknown as BybitService,
      telegram as unknown as TelegramService, push as unknown as PushService,
    );
    jest.spyOn(service, 'withTradeLock').mockImplementation(async (_scope, action) => action());
    return service;
  };
  const service = restart();
  const arm = async (side: Side = Side.LONG) => {
    const quote = await service.preview(pair, side);
    return service.arm(pair, { ...quote, requestId, side });
  };
  const refresh = async () => service.refresh(pair, { insuranceId: requestId, side: Side.LONG });
  return { arm, bybit, orders, pair, position, push, record, refresh, restart, service, telegram };
}

describe('Bybit position insurance', () => {
  it.each([
    [Side.LONG, 1, '102', '101.3'],
    [Side.SHORT, 2, '98', '98.7'],
  ])('arms %s for the excess and hides opposite Next until cancellation', async (side, index, price, trigger) => {
    const { arm, bybit, orders, position, service } = setup();
    const opposite = side === Side.LONG ? Side.SHORT : Side.LONG;
    position.positionIdx = index;
    bybit.getContractFairPrice.mockResolvedValue(price);

    const state = await arm(side);
    expect(state.phase).toBe('active');
    expect(bybit.submitTrackedMarketOrder).toHaveBeenCalledWith(2, {
      symbol: pair.symbol, positionIdx: index, qty: '2.5', triggerPrice: trigger,
      reduceOnly: true, orderLinkId: insuranceLink,
    });
    const [projected, otherAccount] = await service.projectPairs([pair, { ...pair, exchangeAccount: 1 }]);
    expect(projected[opposite === Side.LONG ? 'nextBuyLongPrice' : 'nextBuyShortPrice']).toBe(0);
    const ownPrice = side === Side.LONG ? 'nextBuyLongPrice' : 'nextBuyShortPrice';
    expect(projected[ownPrice]).toBe(pair[ownPrice]);
    expect(otherAccount).toEqual({ ...pair, exchangeAccount: 1 });
    await expect(service.assertTradeAllowed(pair, opposite, true)).rejects.toThrow('действует страховка');
    await expect(service.assertTradeAllowed(pair, side, false)).rejects.toThrow('действует страховка');
    await expect(service.assertTradeAllowed(pair, opposite, false)).resolves.toBeUndefined();

    orders.set(insuranceLink, exchangeOrder('Cancelled'));
    await service.reconcileOrders();
    const [finished] = await service.projectPairs([pair]);
    expect(finished.nextBuyLongPrice).toBe(95);
    expect(finished.nextBuyShortPrice).toBe(105);
    expect(finished.insurance[side].phase).toBe('finished');
  });

  it('rejects a margin of exactly 25 and a price equal to the configured level', async () => {
    const { service, bybit, position } = setup();
    position.size = '2.5';
    await expect(service.preview(pair, Side.LONG)).rejects.toThrow('больше 25');
    position.size = '4.5';
    bybit.getContractFairPrice.mockResolvedValue('101.34');
    await expect(service.preview(pair, Side.LONG)).rejects.toThrow('должна пройти');
    expect(bybit.submitTrackedMarketOrder).not.toHaveBeenCalled();
  });

  it('blocks a buy request from an already open modal before calling Bybit', async () => {
    const { arm, bybit, service } = setup();
    const controller = new PairController(
      { getById: jest.fn().mockResolvedValue(pair) } as unknown as PairService,
      bybit as unknown as BybitService,
      service,
    );
    await arm();
    await expect(controller.openBybitMarketPosition(null, { side: Side.SHORT, amount: 20 }))
      .rejects.toThrow('действует страховка');
    expect(bybit.openMarketPosition).not.toHaveBeenCalled();
  });

  it('rounds down the close so the retained margin is at least 20 USDT', async () => {
    const { service, position } = setup();
    position.avgPrice = '101';
    const quote = await service.preview({ ...pair, longPrice: 101 }, Side.LONG);
    expect(quote.qty).toBe('2.5');
    expect(quote.remainingMargin).toBeGreaterThanOrEqual(20);
    expect(quote.remainingMargin).toBeLessThan(21.01);
  });

  it('reconciles an ambiguous placement after restart without another submission', async () => {
    const { arm, bybit, orders, record, restart } = setup();
    bybit.submitTrackedMarketOrder.mockRejectedValueOnce(new Error('timeout'));
    expect((await arm()).phase).toBe('placing');
    const afterRestart = restart();
    await afterRestart.reconcileOrders();
    expect(bybit.submitTrackedMarketOrder).toHaveBeenCalledTimes(1);
    orders.set(insuranceLink, exchangeOrder('Untriggered'));
    await afterRestart.reconcileOrders();
    expect(record().phase).toBe('active');
    expect(bybit.submitTrackedMarketOrder).toHaveBeenCalledTimes(1);
  });

  it('reports a partially executed insurance once when cancellation races with execution', async () => {
    const { arm, bybit, orders, position, push, record, refresh, restart, telegram } = setup();
    await arm();
    bybit.getContractFairPrice.mockResolvedValue('106');
    expect((await refresh()).phase).toBe('cancelling');
    expect(bybit.cancelTrackedOrder).toHaveBeenCalledWith(2, pair.symbol, insuranceLink);
    orders.set(insuranceLink, exchangeOrder('Cancelled', '1'));
    position.size = '3.5';
    const afterRestart = restart();
    await afterRestart.reconcileOrders();
    await afterRestart.reconcileOrders();
    expect(record().phase).toBe('finished');
    expect(record().result).toMatchObject({ success: false, closedQty: 1, remainingQty: 3.5 });
    expect(bybit.submitTrackedMarketOrder).toHaveBeenCalledTimes(1);
    expect(telegram.sendMessage).toHaveBeenCalledTimes(1);
    expect(push.sendMessage).toHaveBeenCalledTimes(1);
    expect(telegram.sendMessage).toHaveBeenCalledWith(expect.stringContaining('частично'));
  });

  it('reports a fully executed insurance with the remaining volume', async () => {
    const { arm, orders, position, push, record, service, telegram } = setup();
    await arm();
    orders.set(insuranceLink, exchangeOrder('Filled', '2.5'));
    position.size = '2';
    await service.reconcileOrders();
    expect(record().result).toMatchObject({ success: true, closedQty: 2.5, remainingQty: 2 });
    expect(telegram.sendMessage).toHaveBeenCalledWith(expect.stringContaining('Сработала страховка'));
    expect(push.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('reopens the actual fill after confirmed cancellation and reports a failed reopen', async () => {
    const { arm, bybit, orders, position, record, refresh, restart } = setup();
    await arm();
    bybit.getContractFairPrice.mockResolvedValue('105');
    await expect(refresh()).rejects.toThrow('больше 50');
    expect(bybit.cancelTrackedOrder).not.toHaveBeenCalled();

    bybit.getContractFairPrice.mockResolvedValue('106');
    await refresh();
    expect(bybit.submitTrackedMarketOrder).toHaveBeenCalledTimes(1);
    orders.set(insuranceLink, exchangeOrder('Cancelled'));
    const afterRestart = restart();
    await afterRestart.reconcileOrders();
    expect(bybit.submitTrackedMarketOrder).toHaveBeenLastCalledWith(2,
      expect.objectContaining({ qty: '2.2', orderLinkId: closeLink, reduceOnly: true }));
    orders.set(closeLink, exchangeOrder('Cancelled', '1.3'));
    position.size = '3.2';
    await afterRestart.reconcileOrders();
    expect(bybit.submitTrackedMarketOrder).toHaveBeenLastCalledWith(2,
      expect.objectContaining({ qty: '1.3', orderLinkId: reopenLink, reduceOnly: false }));

    orders.set(reopenLink, exchangeOrder('Rejected'));
    await afterRestart.reconcileOrders();
    expect(record().result).toMatchObject({ success: false, closedQty: 1.3, restoredQty: 0 });
    expect(bybit.submitTrackedMarketOrder).toHaveBeenCalledTimes(3);
  });

  it('cancels an outstanding order if the position is changed outside web3', async () => {
    const { arm, bybit, position, service, record } = setup();
    await arm();
    position.size = '4.6';
    await service.reconcileOrders();
    expect(record().phase).toBe('cancelling');
    expect(bybit.cancelTrackedOrder).toHaveBeenCalledWith(2, pair.symbol, insuranceLink);
    expect(bybit.submitTrackedMarketOrder).toHaveBeenCalledTimes(1);
  });
});

describe('Bybit insurance order parameters', () => {
  it.each([[1, 'Sell', 2], [2, 'Buy', 1]] as const)(
    'places a reduce-only conditional market order for positionIdx %s',
    async (positionIdx, side, triggerDirection) => {
      const bybit = new BybitService(null);
      const submitOrder = jest.fn().mockResolvedValue({ retCode: 0 });
      jest.spyOn(bybit as any, 'getClient').mockReturnValue({ submitOrder });

      await bybit.submitTrackedMarketOrder(2, {
        positionIdx, symbol: pair.symbol, qty: '2.5', orderLinkId: insuranceLink,
        triggerPrice: '100', reduceOnly: true,
      });
      expect(submitOrder).toHaveBeenCalledWith(expect.objectContaining({
        positionIdx, side, triggerDirection, triggerPrice: '100', triggerBy: 'LastPrice',
        orderType: 'Market', reduceOnly: true, closeOnTrigger: true,
      }));
    },
  );
});
