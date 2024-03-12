import { Injectable } from '@nestjs/common';
import * as TelegramBot from 'node-telegram-bot-api';

@Injectable()
export class TelegramService {
  private bot: TelegramBot;

  constructor() {
    this.bot = new TelegramBot(process.env.TELEGRAM_API_KEY, { polling: false });
  }

  async sendMessage(text: string): Promise<any> {
    try {
      return await this.bot.sendMessage(process.env.CHAT_ID, text);
    } catch (error) {
      console.error('Error sending message to Telegram:', error);
      throw error;
    }
  }
}
