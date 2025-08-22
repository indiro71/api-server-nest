import { Injectable } from '@nestjs/common';
import { FootballDataService } from '../services/footballData/footballData.service';
import { TelegramService } from '../services/telegram/telegram.service';

@Injectable()
export class FootballService {
  constructor(
      private readonly footballDataService: FootballDataService,
      private readonly telegramService: TelegramService,
  ) {
    this.listenTg();
  }

  async listenTg() {
    // Список матчей на сегодня
    await this.telegramService.bot.onText(/\/matches/, async (msg) => {
      const chatId = msg.chat.id;
      const text = await this.footballDataService.matches();
      await this.telegramService.sendMessage(text, chatId);
    });

    // Список топовых матчей на сегодня
    await this.telegramService.bot.onText(/\/topmatches/, async (msg) => {
      const chatId = msg.chat.id;
      const text = await this.footballDataService.topMatches();
      await this.telegramService.sendMessage(text, chatId);
    });
  }

  async todayMatches () {
    const text = await this.footballDataService.matches();
    await this.telegramService.sendMessage(text);
  }

  async topMatches () {
    const text = await this.footballDataService.topMatches();
    await this.telegramService.sendMessage(text);
  }
}
