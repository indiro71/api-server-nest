import { Injectable } from '@nestjs/common';
import { RestClientV5 } from 'bybit-api';
import { ErrorLogService } from '../../error-log/error-log.service';
import {
    BybitMarginMode,
    CategoryType,
    IBybitClosedPnl,
    IBybitClosedPnlResponse,
    IBybitOrdersResponse,
    IBybitPosition,
    IBybitPositionsResponse,
    OrderSide,
    OrderTimeInForce,
    OrderType,
} from './bybit.interfaces';

interface OpenMarketPositionParams {
    symbol: string;
    side: OrderSide;
    amount: number;
    leverage: number;
    price: number;
    positionIdx: 1 | 2;
}

export interface OpenMarketPositionResult {
    amount: number;
    leverage: number;
    orderValue: number;
    price: number;
    qty: string;
    result: any;
}

interface CloseMarketPositionParams {
    symbol: string;
    side: OrderSide;
    positionIdx: 1 | 2;
}

export interface CloseMarketPositionResult {
    avgEntryPrice: string;
    closedPnl: IBybitClosedPnl | null;
    orderId?: string;
    positionIdx: 1 | 2;
    positionValue: string;
    qty: string;
    result: any;
    side: OrderSide;
    symbol: string;
    unrealisedPnl: string;
}

@Injectable()
export class BybitService {
    private readonly requestTimeoutMs = this.getRequestTimeoutMs();
    private readonly clients = new Map<number, RestClientV5>();
    private readonly publicClient: RestClientV5;

    constructor(private readonly errorLogService: ErrorLogService) {
        this.publicClient = new RestClientV5(
            {},
            {
                timeout: this.requestTimeoutMs,
            },
        );
    }

    async getContractFairPrice(symbol?: string): Promise<string> {
        try {
            const response = await this.publicClient.getTickers({
                category: CategoryType.LINEAR,
                symbol
            })
            return response.result.list[0].lastPrice;
        } catch (e) {
            this.captureError(e, 'bybit.getContractFairPrice', { symbol });
            throw e;
        }
    }

    async getPositions(
        exchangeAccount: number,
        symbol?: string,
    ): Promise<IBybitPositionsResponse> {
        const client = this.getClient(exchangeAccount);

        try {
            const result = await client.getPositionInfo({
                category: CategoryType.LINEAR,
                ...(symbol ? { symbol } : { settleCoin: 'USDT' }),
                limit: 100
            })
            return result as IBybitPositionsResponse;
        } catch (e) {
            this.captureError(e, 'bybit.getPositions', { exchangeAccount, symbol });
            throw e;
        }
    }

    async getOrders(exchangeAccount: number, symbol?: string): Promise<IBybitOrdersResponse> {
        const client = this.getClient(exchangeAccount);

        try {
            const result = await client.getActiveOrders({
                category: CategoryType.LINEAR,
                ...(symbol ? { symbol } : { settleCoin: 'USDT' }),
                limit: 100
            });
            return result as unknown as IBybitOrdersResponse;
        } catch (e) {
            this.captureError(e, 'bybit.getOrders', { exchangeAccount, symbol });
            throw e;
        }
    }

    getMarginMode(exchangeAccount: number): BybitMarginMode {
        const account = this.normalizeExchangeAccount(exchangeAccount);
        const value = process.env[`BYBIT_MARGIN_MODE_${account}`]?.trim().toUpperCase();

        if (value === BybitMarginMode.ISOLATED || value === BybitMarginMode.CROSS) {
            return value;
        }

        throw new Error(
            `BYBIT_MARGIN_MODE_${account} must be ${BybitMarginMode.ISOLATED} or ${BybitMarginMode.CROSS}`,
        );
    }

    private getRequestTimeoutMs(): number {
        const timeout = Number(process.env.BYBIT_REQUEST_TIMEOUT_MS);

        return Number.isFinite(timeout) && timeout > 0 ? timeout : 15_000;
    }

    async openMarketPosition(exchangeAccount: number, {
        symbol,
        side,
        amount,
        leverage,
        price,
        positionIdx,
    }: OpenMarketPositionParams): Promise<OpenMarketPositionResult> {
        const client = this.getClient(exchangeAccount);

        try {
            const instrument = await this.getInstrument(symbol);
            const orderValue = amount * leverage;
            const qty = this.calculateOrderQty(orderValue, price, instrument?.lotSizeFilter);
            const result = await client.submitOrder({
                category: CategoryType.LINEAR,
                symbol,
                side,
                orderType: OrderType.Market,
                qty,
                timeInForce: OrderTimeInForce.IOC,
                positionIdx,
                reduceOnly: false,
            });

            if (result?.retCode) {
                throw new Error(result.retMsg);
            }

            return {
                amount,
                leverage,
                orderValue,
                price,
                qty,
                result,
            };
        } catch (e) {
            this.captureError(e, 'bybit.openMarketPosition', {
                amount,
                exchangeAccount,
                leverage,
                positionIdx,
                price,
                side,
                symbol,
            });
            throw e;
        }
    }

    async closeMarketPosition(exchangeAccount: number, {
        symbol,
        side,
        positionIdx,
    }: CloseMarketPositionParams): Promise<CloseMarketPositionResult> {
        const client = this.getClient(exchangeAccount);

        try {
            const position = await this.getOpenPosition(exchangeAccount, symbol, positionIdx);
            const qty = position.size;
            const result = await client.submitOrder({
                category: CategoryType.LINEAR,
                symbol,
                side,
                orderType: OrderType.Market,
                qty,
                timeInForce: OrderTimeInForce.IOC,
                positionIdx,
                reduceOnly: true,
            });

            if (result?.retCode) {
                throw new Error(result.retMsg);
            }

            const orderId = result?.result?.orderId;

            await this.waitForPositionClose(exchangeAccount, symbol, positionIdx);

            const closedPnl = orderId
                ? await this.waitForClosedPnl(exchangeAccount, symbol, orderId).catch((error) => {
                    this.captureError(error, 'bybit.waitForClosedPnl', {
                        exchangeAccount,
                        orderId,
                        symbol,
                    });
                    return null;
                })
                : null;

            return {
                avgEntryPrice: position.avgPrice,
                closedPnl,
                orderId,
                positionIdx,
                positionValue: position.positionValue,
                qty,
                result,
                side,
                symbol,
                unrealisedPnl: position.unrealisedPnl,
            };
        } catch (e) {
            this.captureError(e, 'bybit.closeMarketPosition', {
                exchangeAccount,
                positionIdx,
                side,
                symbol,
            });
            throw e;
        }
    }

    async addMargin(exchangeAccount: number, symbol: string, margin: number, positionIdx?: number): Promise<any> {
        return this.changeMargin(exchangeAccount, symbol, margin, positionIdx);
    }

    async removeMargin(exchangeAccount: number, symbol: string, margin: number, positionIdx?: number): Promise<any> {
        return this.changeMargin(exchangeAccount, symbol, -Math.abs(margin), positionIdx);
    }

    private async changeMargin(exchangeAccount: number, symbol: string, margin: number, positionIdx?: number): Promise<any> {
        if (this.getMarginMode(exchangeAccount) !== BybitMarginMode.ISOLATED) {
            throw new Error(`Bybit account ${exchangeAccount} does not use isolated margin`);
        }

        const client = this.getClient(exchangeAccount);

        try {
            const marginValue = this.formatMargin(margin);
            const result = await client.addOrReduceMargin({
                category: CategoryType.LINEAR,
                symbol,
                margin: marginValue,
                ...(positionIdx !== undefined ? { positionIdx } : {}),
            } as any);

            if (result?.retCode) {
                throw new Error(result.retMsg);
            }

            return result;
        } catch (e) {
            this.captureError(e, 'bybit.changeMargin', {
                exchangeAccount,
                margin,
                positionIdx,
                symbol,
            });
            throw e;
        }
    }

    private captureError(error: any, source: string, meta?: any): void {
        void this.errorLogService.capture(error, {
            level: 'error',
            source,
            meta: {
                ...meta,
                message: error?.message,
                response: error?.response?.data || error?.response,
            },
        });
    }

    private formatMargin(margin: number): string {
        const sign = margin < 0 ? -1 : 1;
        const value = Math.floor(Math.abs(margin));

        if (!value) {
            throw new Error('Margin value is too small');
        }

        return `${sign * value}`;
    }

    private async getInstrument(symbol: string): Promise<any> {
        const result = await this.publicClient.getInstrumentsInfo({
            category: CategoryType.LINEAR,
            symbol,
        } as any);

        if (result?.retCode) {
            throw new Error(result.retMsg);
        }

        const instrument = result?.result?.list?.[0];

        if (!instrument) {
            throw new Error(`Bybit instrument ${symbol} not found`);
        }

        return instrument;
    }

    private async getOpenPosition(exchangeAccount: number, symbol: string, positionIdx: 1 | 2): Promise<IBybitPosition> {
        const positions = await this.getPositions(exchangeAccount, symbol);

        if (!positions) {
            throw new Error('Bybit positions response is empty');
        }

        if (positions.retCode) {
            throw new Error(positions.retMsg);
        }

        const position = positions.result?.list?.find((item) => {
            return item.positionIdx === positionIdx && Number(item.size) > 0;
        });

        if (!position) {
            throw new Error('Open Bybit position not found');
        }

        return position;
    }

    private async waitForPositionClose(exchangeAccount: number, symbol: string, positionIdx: 1 | 2): Promise<void> {
        const attempts = 12;
        const delayMs = 500;

        for (let attempt = 0; attempt < attempts; attempt += 1) {
            await this.sleep(delayMs);

            const positions = await this.getPositions(exchangeAccount, symbol);
            const position = positions?.result?.list?.find((item) => item.positionIdx === positionIdx);

            if (!position || Number(position.size) <= 0) {
                return;
            }
        }

        throw new Error('Bybit position close was not confirmed');
    }

    private async waitForClosedPnl(exchangeAccount: number, symbol: string, orderId: string): Promise<IBybitClosedPnl | null> {
        const attempts = 10;
        const delayMs = 500;

        for (let attempt = 0; attempt < attempts; attempt += 1) {
            const closedPnlResponse = await this.getClosedPnl(exchangeAccount, symbol);
            const closedPnl = closedPnlResponse.result?.list?.find((item) => item.orderId === orderId);

            if (closedPnl) {
                return closedPnl;
            }

            await this.sleep(delayMs);
        }

        return null;
    }

    private async getClosedPnl(exchangeAccount: number, symbol: string): Promise<IBybitClosedPnlResponse> {
        const client = this.getClient(exchangeAccount);
        const result = await client.getClosedPnL({
            category: CategoryType.LINEAR,
            symbol,
            limit: 20,
        } as any);

        if (result?.retCode) {
            throw new Error(result.retMsg);
        }

        return result as IBybitClosedPnlResponse;
    }

    private getClient(exchangeAccount: number): RestClientV5 {
        const account = this.normalizeExchangeAccount(exchangeAccount);
        const existingClient = this.clients.get(account);

        if (existingClient) {
            return existingClient;
        }

        const key = process.env[`BYBIT_API_KEY_${account}`];
        const secret = process.env[`BYBIT_SECRET_KEY_${account}`];

        if (!key || !secret) {
            throw new Error(`Bybit credentials for exchange account ${account} are not configured`);
        }

        const client = new RestClientV5(
            { key, secret },
            { timeout: this.requestTimeoutMs },
        );

        this.clients.set(account, client);

        return client;
    }

    private normalizeExchangeAccount(exchangeAccount: number): number {
        const account = Number(exchangeAccount);

        if (!Number.isInteger(account) || account < 1) {
            throw new Error(`Invalid Bybit exchange account: ${exchangeAccount}`);
        }

        return account;
    }

    private calculateOrderQty(orderValue: number, price: number, lotSizeFilter?: any): string {
        if (!Number.isFinite(orderValue) || orderValue <= 0) {
            throw new Error('Order value is invalid');
        }

        if (!Number.isFinite(price) || price <= 0) {
            throw new Error('Current price is invalid');
        }

        const qtyStep = Number(lotSizeFilter?.qtyStep || 0);
        const minOrderQty = Number(lotSizeFilter?.minOrderQty || 0);
        const maxMktOrderQty = Number(lotSizeFilter?.maxMktOrderQty || lotSizeFilter?.maxOrderQty || 0);
        const rawQty = orderValue / price;
        const qty = qtyStep > 0 ? Math.floor(rawQty / qtyStep) * qtyStep : rawQty;

        if (minOrderQty > 0 && qty < minOrderQty) {
            throw new Error(`Order qty ${qty} is below Bybit min order qty ${minOrderQty}`);
        }

        if (maxMktOrderQty > 0 && qty > maxMktOrderQty) {
            throw new Error(`Order qty ${qty} is above Bybit max market order qty ${maxMktOrderQty}`);
        }

        if (qty <= 0) {
            throw new Error('Order qty is too small');
        }

        return this.formatQty(qty, lotSizeFilter?.qtyStep);
    }

    private formatQty(qty: number, qtyStep?: string): string {
        const decimals = this.getStepDecimals(qtyStep);
        const formatted = qty.toFixed(decimals);

        if (!formatted.includes('.')) {
            return formatted;
        }

        return formatted.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '');
    }

    private getStepDecimals(step?: string): number {
        if (!step || !step.includes('.')) {
            return 0;
        }

        return step.replace(/0+$/, '').split('.')[1]?.length || 0;
    }

    private sleep(delayMs: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, delayMs));
    }
}
