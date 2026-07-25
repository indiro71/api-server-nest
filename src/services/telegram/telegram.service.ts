import { Injectable } from '@nestjs/common';
import * as TelegramBot from 'node-telegram-bot-api';

@Injectable()
export class TelegramService {
  public bot: TelegramBot | null;
  private inited: boolean;
  private enabled: boolean;

  constructor() {
    this.bot = null;
    this.inited = false;
    this.enabled = this.resolveEnabled();
    this.initBot();
  }

  get isEnabled(): boolean {
    return this.enabled && !!this.bot;
  }

  async initBot() {
    if (!this.enabled) {
      console.log('Telegram bot is disabled');
      return;
    }

    if (!process.env.TELEGRAM_API_KEY || !process.env.CHAT_ID) {
      console.warn('Telegram bot is not configured');
      return;
    }

    if (!this.inited) {
      this.bot = new TelegramBot(process.env.TELEGRAM_API_KEY, { polling: true });
      this.bot.on('polling_error', (error) => {
        console.error('Telegram polling error:', error?.message || error);
      });
      this.inited = true;
    }
  }

  async sendMessage(text: string, chatId?: string): Promise<any> {
    if (!this.isEnabled) {
      return null;
    }

    try {
      return await this.bot.sendMessage(chatId || process.env.CHAT_ID, text);
    } catch (error) {
      console.error('Error sending message to Telegram:', error?.message || error);
      return null;
    }
  }

  async listenMessages(): Promise<any> {
    if (!this.isEnabled) {
      return null;
    }

    try {
      this.bot.onText(/\/stat/, async (msg, match) => {
        // 'msg' is the received Message from Telegram
        // 'match' is the result of executing the regexp above on the text content
        // of the message

        const chatId = msg.chat.id;
        const resp = match[1]; // the captured "whatever"
        console.log(111, chatId, resp);
        // send back the matched "whatever" to the chat
        // await fn();
        // await this.tradingService.sendStatistics();
      })
    } catch (error) {
      console.error('Error listen message to Telegram:', error);
      return null;
    }
  }

  private resolveEnabled(): boolean {
    if (process.env.TELEGRAM_ENABLED) {
      return process.env.TELEGRAM_ENABLED === 'true';
    }

    return process.env.NODE_ENV === 'production';
  }
}
