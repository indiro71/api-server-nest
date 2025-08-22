import { Injectable } from '@nestjs/common';
import * as TelegramBot from 'node-telegram-bot-api';

@Injectable()
export class TelegramService {
  public bot: TelegramBot;
  private inited: boolean;

  constructor() {
    this.inited = false;
    this.initBot();
  }

  async initBot() {
    if (!this.inited) {
      this.bot = new TelegramBot(process.env.TELEGRAM_API_KEY, { polling: true });
      this.inited = true;
    }
  }

  async sendMessage(text: string, chatId?: string): Promise<any> {
    try {
      return await this.bot.sendMessage(chatId || process.env.CHAT_ID, text);
    } catch (error) {
      console.error('Error sending message to Telegram:', error);
      throw error;
    }
  }

  async listenMessages(): Promise<any> {
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
      throw error;
    }
  }
}
