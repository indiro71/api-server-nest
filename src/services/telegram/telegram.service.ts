import { Injectable } from '@nestjs/common';
import * as TelegramBot from 'node-telegram-bot-api';
import { ErrorLogService } from '../../error-log/error-log.service';

interface TelegramQueuedMessage {
  text: string;
  chatId?: string | number;
}

const DEFAULT_SEND_TIMEOUT_MS = 4000;
const DEFAULT_REQUEST_TIMEOUT_MS = 15000;
const DEFAULT_QUEUE_LIMIT = 100;

@Injectable()
export class TelegramService {
  public bot: TelegramBot | null;
  private inited: boolean;
  private enabled: boolean;
  private pollingEnabled: boolean;
  private sendTimeoutMs: number;
  private requestTimeoutMs: number;
  private queueLimit: number;
  private queue: TelegramQueuedMessage[];
  private queueProcessing: boolean;

  constructor(private readonly errorLogService: ErrorLogService) {
    this.bot = null;
    this.inited = false;
    this.enabled = this.resolveEnabled();
    this.pollingEnabled = this.resolvePollingEnabled();
    this.sendTimeoutMs = this.resolveNumberEnv('TELEGRAM_SEND_TIMEOUT_MS', DEFAULT_SEND_TIMEOUT_MS);
    this.requestTimeoutMs = this.resolveNumberEnv('TELEGRAM_REQUEST_TIMEOUT_MS', DEFAULT_REQUEST_TIMEOUT_MS);
    this.queueLimit = this.resolveNumberEnv('TELEGRAM_QUEUE_LIMIT', DEFAULT_QUEUE_LIMIT);
    this.queue = [];
    this.queueProcessing = false;
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
      this.bot = new TelegramBot(process.env.TELEGRAM_API_KEY, {
        polling: this.pollingEnabled,
        request: {
          timeout: this.requestTimeoutMs,
        },
      });

      if (this.pollingEnabled) {
        this.bot.on('polling_error', (error) => {
          void this.errorLogService.capture(error, {
            level: 'error',
            source: 'telegram.polling',
          });
        });
      }

      this.inited = true;
    }
  }

  async sendMessage(text: string, chatId?: string | number): Promise<null> {
    if (!this.isEnabled) {
      return null;
    }

    this.enqueueMessage({
      text,
      chatId,
    });

    return null;
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
      void this.errorLogService.capture(error, {
        level: 'error',
        source: 'telegram.listen',
      });
      return null;
    }
  }

  private enqueueMessage(message: TelegramQueuedMessage): void {
    if (this.queue.length >= this.queueLimit) {
      this.queue.shift();
      console.warn('Telegram message queue limit reached. Oldest message was dropped.');
      void this.errorLogService.captureMessage(
        'Telegram message queue limit reached. Oldest message was dropped.',
        {
          level: 'warn',
          source: 'telegram.queue',
          meta: {
            queueLimit: this.queueLimit,
          },
        },
      );
    }

    this.queue.push(message);
    this.processQueue();
  }

  private processQueue(): void {
    if (this.queueProcessing) {
      return;
    }

    this.queueProcessing = true;
    this.drainQueue()
      .catch((error) => {
        void this.errorLogService.capture(error, {
          level: 'error',
          source: 'telegram.queue',
        });
      })
      .then(() => {
        this.queueProcessing = false;

        if (this.queue.length > 0) {
          this.processQueue();
        }
      });
  }

  private async drainQueue(): Promise<void> {
    while (this.queue.length > 0) {
      const message = this.queue.shift();

      if (message) {
        await this.sendQueuedMessage(message);
      }
    }
  }

  private async sendQueuedMessage({ text, chatId }: TelegramQueuedMessage): Promise<void> {
    if (!this.bot) {
      return;
    }

    try {
      await this.withTimeout(
        this.bot.sendMessage(chatId || process.env.CHAT_ID, text),
        this.sendTimeoutMs,
        'Telegram send timeout',
      );
    } catch (error) {
      void this.errorLogService.capture(error, {
        level: 'error',
        source: 'telegram.send',
        meta: {
          chatId: chatId || process.env.CHAT_ID,
          text,
        },
      });
    }
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
    let timer: NodeJS.Timeout;

    return new Promise<T>((resolve, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`${timeoutMessage} after ${timeoutMs}ms`));
      }, timeoutMs);

      promise.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error) => {
          clearTimeout(timer);
          reject(error);
        },
      );
    });
  }

  private resolveEnabled(): boolean {
    if (process.env.TELEGRAM_ENABLED) {
      return process.env.TELEGRAM_ENABLED === 'true';
    }

    return process.env.NODE_ENV === 'production';
  }

  private resolvePollingEnabled(): boolean {
    if (process.env.TELEGRAM_POLLING_ENABLED) {
      return process.env.TELEGRAM_POLLING_ENABLED === 'true';
    }

    return this.enabled;
  }

  private resolveNumberEnv(name: string, fallback: number): number {
    const value = Number(process.env[name]);

    if (!Number.isFinite(value) || value <= 0) {
      return fallback;
    }

    return value;
  }
}
