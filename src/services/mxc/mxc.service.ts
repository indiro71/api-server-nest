import { Injectable, HttpService } from '@nestjs/common';
import { TelegramService } from '../telegram/telegram.service';
import * as crypto from 'crypto';

@Injectable()
export class MxcService {
  constructor(private httpService: HttpService, private readonly telegramService: TelegramService) {}

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

  private generateSignature(data: string): string {
    const hmac = crypto.createHmac('sha256', process.env.MEXC_SECRET_KEY);
    hmac.update(data);
    return hmac.digest('hex');
  }
}
