import { Injectable } from '@nestjs/common';
import { RestClientV5 } from 'bybit-api';
import { CategoryType, IBybitOrdersResponse, IBybitPositionsResponse, } from './bybit.interfaces';

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
}
