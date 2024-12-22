import { Injectable, HttpService } from '@nestjs/common';
import * as crypto from 'crypto';
import { IPositionResponse, OpenType, SideType } from './mxc.interfaces';

@Injectable()
export class MxcService {
  constructor(private httpService: HttpService) {}

  headers = {
    'X-MEXC-APIKEY': process.env.MEXC_API_KEY,
    'Content-Type': 'application/json',
  };

  async monitoring() {
    const symbol = 'KASUSDT';
    const response = await this.getCurrencyPrice(symbol);
    const price = response.data.price;

    const chatId = process.env.CHAT_ID;
    const text = `Current price: ${price}`;
    // await this.telegramService.sendMessage(chatId, text);
    // const byeData = await this.testNewOrder(symbol, 100, price);
    const byeData = await this.getWalletState();
  }

  async getCurrencyPrice(symbol: string): Promise<any> {
    const url = `https://api.mexc.com/api/v3/ticker/price?symbol=${symbol}`;
    const response = await this.httpService.get(url).toPromise();
    return response.data.price;
  }

  async getAveragePrice(symbol: string): Promise<any> {
    const url = `https://api.mexc.com/api/v3/avgPrice?symbol=${symbol}`;
    const response = await this.httpService.get(url).toPromise();
    return response.data;
  }

  async getTickerPrice(symbol: string): Promise<any> {
    const url = `https://api.mexc.com/api/v3/ticker/price?symbol=${symbol}`;
    const response = await this.httpService.get(url).toPromise();
    return response.data;
  }

  async getOrderBook(symbol: string, limit:number = 25): Promise<any> {
    const url = `https://api.mexc.com/api/v3/depth?symbol=${symbol}&limit=${limit}`;
    const response = await this.httpService.get(url).toPromise();
    return response.data;
  }

  async getTradesList(symbol: string, limit:number = 50): Promise<any> {
    const url = `https://api.mexc.com/api/v3/trades?symbol=${symbol}&limit=${limit}`;
    const response = await this.httpService.get(url).toPromise();
    return response.data;
  }

  async buyOrder(symbol: string, quantity: number, buyPrice?: number) {
    const price = buyPrice || await this.getCurrencyPrice(symbol);
    const data = await this.newOrder(symbol, quantity, price, 'BUY', process.env.NODE_ENV === 'development')
    return data;
  }

  async sellOrder(symbol: string, quantity: number, sellPrice?: number) {
    const price = sellPrice || await this.getCurrencyPrice(symbol);
    const data = await this.newOrder(symbol, quantity, price, 'SELL', process.env.NODE_ENV === 'development')
    return data;
  }

  async getOpenOrders(symbol: string) {
    const apiUrl = 'https://api.mexc.com/api/v3/openOrders';
    const timestamp = Date.now().toString();

    const data = {
      symbol,
      timestamp: timestamp
    };

    const dataString = Object.keys(data)
        .map(key => `${key}=${encodeURIComponent(data[key])}`)
        .join('&');

    const signature = this.generateSignature(dataString);
    const url = `${apiUrl}?${dataString}&signature=${signature}`;

    try {
      const response = await this.httpService.get(url, {headers: this.headers}).toPromise();
      return response.data;
    } catch (e) {
      console.error(e.response)
    }
  }

  async testBuyOrder(symbol: string, quantity: number, price: number) {
    const data = await this.newOrder(symbol, quantity, price, 'BUY', true)
    return data;
  }

  async testSellOrder(symbol: string, quantity: number, price: number) {
    const data = await this.newOrder(symbol, quantity, price, 'SELL', true)
    return data;
  }

  async newOrder(symbol: string, quantity: number, price: number, side: 'BUY' | 'SELL', isTest): Promise<any> {
    const apiUrl = isTest ? 'https://api.mexc.com/api/v3/order/test' : 'https://api.mexc.com/api/v3/order';
    const timestamp = Date.now();

    const data = {
      symbol,
      side,
      type: 'LIMIT',
      quantity: quantity,
      price: price,
      timestamp: timestamp
    };

    process.env.NODE_ENV === 'development' && console.log(`New order ${side}`, data)

    const dataString = Object.keys(data)
        .map(key => `${key}=${encodeURIComponent(data[key])}`)
        .join('&');

    const signature = this.generateSignature(dataString);
    const url = `${apiUrl}?${dataString}&signature=${signature}`;

    try {
      const response = await this.httpService.post(url, null, {headers: this.headers}).toPromise();
      return response.data;
    } catch (error) {
      console.error('Error creating new order:', error.response);
      throw error;
    }
  }

  async getWalletState(): Promise<any> {
    const apiUrl = 'https://api.mexc.com/api/v3/account';
    const timestamp = Date.now().toString();

    const data = {
      timestamp: timestamp
    };

    const dataString = Object.keys(data)
        .map(key => `${key}=${encodeURIComponent(data[key])}`)
        .join('&');

    const signature = this.generateSignature(dataString);
    const url = `${apiUrl}?${dataString}&signature=${signature}`;

    try {
      const response = await this.httpService.get(url, {headers: this.headers}).toPromise();
      return response.data.balances;
    } catch (e) {
      console.error(e.response)
    }
  }

  // futures

  async getContractIndexPrice(contract: string): Promise<any> {
    const url = `https://contract.mexc.com/api/v1/contract/index_price/${contract}`;
    const response = await this.httpService.get(url).toPromise();
    return response.data.data.indexPrice;
  }

  async getContractFairPrice(contract: string): Promise<any> {
    const url = `https://contract.mexc.com/api/v1/contract/fair_price/${contract}`;
    const response = await this.httpService.get(url).toPromise();
    return response.data.data.fairPrice;
  }

  async getAccountAssets() {
    const apiUrl = 'https://contract.mexc.com/api/v1/private/account/assets';
    const timestamp = Date.now().toString();

    const params: Record<string, string> = {
      'recv-window': '5000',
    };

    const signatureString = this.generateSignatureString(timestamp, params);
    const signature = this.generateSignature(signatureString);

    const headers = {
      'ApiKey': process.env.MEXC_API_KEY,
      'Request-Time': timestamp,
      'Signature': signature,
      'Content-Type': 'application/json',
    };

    try {
      const response = await this.httpService.get(apiUrl, { headers, params }).toPromise();
      return response.data;
    } catch (e) {
      console.error(e.response)
    }
  }

  async getPositions(symbol?: string): Promise<IPositionResponse> {
    const apiUrl = 'https://contract.mexc.com/api/v1/private/position/open_positions';
    const timestamp = Date.now().toString();

    const params: Record<string, string> = {};

    if (symbol) params.symbol = symbol;

    const signatureString = this.generateSignatureString(timestamp, params);
    const signature = this.generateSignature(signatureString);

    const headers = {
      'ApiKey': process.env.MEXC_API_KEY,
      'Request-Time': timestamp,
      'Signature': signature,
      'Content-Type': 'application/json',
    };

    try {
      const response = await this.httpService.get(apiUrl, { headers, params }).toPromise();
      return response.data;
    } catch (e) {
      console.error('error',e.response);
    }
  }

  async newFeatureOrder(symbol?: string): Promise<any> {
    const apiUrl = 'https://contract.mexc.com/api/v1/private/order/submit';
    const timestamp = Date.now().toString();

    const params: Record<string, any> = {
      'symbol': symbol,
      // 'price': 0.118,
      'vol': 20,
      'side': SideType.SHORT_OPEN,
      'type': 5,
      'openType': OpenType.ISOLATED,
    };

    const signatureString = this.generateSignatureString(timestamp, params);
    const signature = this.generateSignature(signatureString);

    const headers = {
      'ApiKey': process.env.MEXC_API_KEY,
      'Request-Time': timestamp,
      'Signature': signature,
      'Content-Type': 'application/json',
    };

    try {
      const response = await this.httpService.post(apiUrl, { headers, params }).toPromise();
      return response.data;
    } catch (e) {
      console.error('error',e.response);
    }
  }

  private generateSignatureString(timestamp: string, params: Record<string, string>): string {
    const sortedParams = Object.keys(params)
        .sort()
        .map(key => `${key}=${params[key]}`)
        .join('&');

    const signatureString = `${process.env.MEXC_API_KEY}${timestamp}${sortedParams}`;
    return signatureString;
  }

  private generateSignature(data: string): string {
    const hmac = crypto.createHmac('sha256', process.env.MEXC_SECRET_KEY);
    hmac.update(data);
    return hmac.digest('hex');
  }
}
