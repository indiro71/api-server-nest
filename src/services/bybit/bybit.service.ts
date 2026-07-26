import { Injectable } from '@nestjs/common';
import { RestClientV5 } from 'bybit-api';
import {
    CategoryType,
    IBybitOrdersResponse,
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

interface OpenMarketPositionResult {
    amount: number;
    leverage: number;
    orderValue: number;
    price: number;
    qty: string;
    result: any;
}

@Injectable()
export class BybitService {
    private readonly apiKey = process.env.BYBIT_API_KEY;
    private readonly secretKey = process.env.BYBIT_SECRET_KEY;
    private readonly client: RestClientV5 = null;

    constructor() {
        this.client = new RestClientV5(
            {
                key: this.apiKey,
                secret: this.secretKey
            }
        );
    }

    async getContractFairPrice(symbol?: string): Promise<string> {
        try {
            const response = await this.client.getTickers({
                category: CategoryType.LINEAR,
                symbol
            })
            return response.result.list[0].lastPrice;
        } catch (e) {
            console.error('Bybit getFuturesTickers error:', e.response?.data || e.message);
        }
    }

    async getPositions(
        symbol?: string,
    ): Promise<IBybitPositionsResponse> {
        try {
            const result = await this.client.getPositionInfo({
                category: CategoryType.LINEAR,
                ...(symbol ? { symbol } : { settleCoin: 'USDT' }),
                limit: 100
            })
            return result as IBybitPositionsResponse;
        } catch (e) {
            console.error('Bybit getPositions error:', e.response?.data || e.message);
        }
    }

    async getOrders(symbol?: string): Promise<IBybitOrdersResponse> {
        try {
            const result = await this.client.getActiveOrders({
                category: CategoryType.LINEAR,
                ...(symbol ? { symbol } : { settleCoin: 'USDT' }),
                limit: 100
            });
            return result as unknown as IBybitOrdersResponse;
        } catch (e) {
            console.error('Bybit getOrders error:', e.response?.data || e.message);
        }
    }

    async openMarketPosition({
        symbol,
        side,
        amount,
        leverage,
        price,
        positionIdx,
    }: OpenMarketPositionParams): Promise<OpenMarketPositionResult> {
        try {
            const instrument = await this.getInstrument(symbol);
            const orderValue = amount * leverage;
            const qty = this.calculateOrderQty(orderValue, price, instrument?.lotSizeFilter);
            const result = await this.client.submitOrder({
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
            console.error('Bybit openMarketPosition error:', e.response?.data || e.message);
            throw e;
        }
    }

    async addMargin(symbol: string, margin: number, positionIdx?: number): Promise<any> {
        return this.changeMargin(symbol, margin, positionIdx);
    }

    async removeMargin(symbol: string, margin: number, positionIdx?: number): Promise<any> {
        return this.changeMargin(symbol, -Math.abs(margin), positionIdx);
    }

    private async changeMargin(symbol: string, margin: number, positionIdx?: number): Promise<any> {
        try {
            const marginValue = this.formatMargin(margin);
            const result = await this.client.addOrReduceMargin({
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
            console.error('Bybit changeMargin error:', e.response?.data || e.message);
            throw e;
        }
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
        const result = await this.client.getInstrumentsInfo({
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
}
