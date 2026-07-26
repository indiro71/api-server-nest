import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as webPush from 'web-push';
import { PushSubscriptionDto } from './dto/push-subscription.dto';
import {
  PushSubscriptionDocument,
  PushSubscriptionEntity,
} from './schemas/push-subscription.schema';

interface TradingSignalsPushPayload {
  activeButtonsCount: number;
  title?: string;
}

interface PushMessagePayload {
  badge?: number;
  body?: string;
  showNotification?: boolean;
  tag?: string;
  title?: string;
}

@Injectable()
export class PushService {
  private readonly publicKey = process.env.WEB_PUSH_PUBLIC_KEY;
  private readonly privateKey = process.env.WEB_PUSH_PRIVATE_KEY;
  private readonly subject = process.env.WEB_PUSH_SUBJECT || 'mailto:admin@indiro.ru';
  private lastActiveButtonsCount = 0;
  private lastSentAt = 0;

  constructor(
    @InjectModel(PushSubscriptionEntity.name)
    private readonly subscriptionModel: Model<PushSubscriptionDocument>,
  ) {
    if (this.publicKey && this.privateKey) {
      webPush.setVapidDetails(this.subject, this.publicKey, this.privateKey);
    }
  }

  getPublicKey() {
    return {
      publicKey: this.publicKey || null,
      enabled: Boolean(this.publicKey && this.privateKey),
    };
  }

  async subscribe(dto: PushSubscriptionDto, userId?: string) {
    if (!dto?.endpoint || !dto?.keys?.p256dh || !dto?.keys?.auth) {
      throw new BadRequestException('Invalid push subscription');
    }

    return this.subscriptionModel.findOneAndUpdate(
      { endpoint: dto.endpoint },
      {
        endpoint: dto.endpoint,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
        userId,
        dateUpdate: new Date(),
      },
      {
        new: true,
        setDefaultsOnInsert: true,
        upsert: true,
      },
    );
  }

  async unsubscribe(dto: PushSubscriptionDto) {
    if (!dto?.endpoint) {
      throw new BadRequestException('Invalid push subscription');
    }

    await this.subscriptionModel.deleteOne({ endpoint: dto.endpoint });

    return { success: true };
  }

  async notifyTradingSignals(payload: TradingSignalsPushPayload) {
    if (!this.publicKey || !this.privateKey) {
      return;
    }

    const activeButtonsCount = Number(payload.activeButtonsCount || 0);
    const now = Date.now();
    const countChanged = activeButtonsCount !== this.lastActiveButtonsCount;
    const shouldSendHeartbeat = activeButtonsCount > 0 && now - this.lastSentAt > 10 * 60 * 1000;

    if (!countChanged && !shouldSendHeartbeat) {
      return;
    }

    this.lastActiveButtonsCount = activeButtonsCount;
    this.lastSentAt = now;

    const subscriptions = await this.subscriptionModel.find();

    if (!subscriptions.length) {
      return;
    }

    await Promise.all(
      subscriptions.map((subscription) => this.sendPushPayload(subscription, {
        badge: activeButtonsCount,
        showNotification: false,
        tag: 'trading-signals',
      })),
    );
  }

  async sendMessage(title: string, message: string, tag = 'trading-message') {
    if (!this.publicKey || !this.privateKey) {
      return;
    }

    const subscriptions = await this.subscriptionModel.find();

    if (!subscriptions.length) {
      return;
    }

    const payload: PushMessagePayload = {
      body: this.truncateMessage(message),
      tag,
      title,
    };

    await Promise.all(
      subscriptions.map((subscription) => this.sendPushPayload(subscription, payload)),
    );
  }

  private async sendPushPayload(subscription: PushSubscriptionDocument, payload: PushMessagePayload) {
    try {
      await webPush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            auth: subscription.auth,
            p256dh: subscription.p256dh,
          },
        },
        JSON.stringify(payload),
      );
    } catch (error) {
      const statusCode = error?.statusCode;

      if (statusCode === 404 || statusCode === 410) {
        await this.subscriptionModel.deleteOne({ endpoint: subscription.endpoint });
        return;
      }

      console.error('Web Push send error:', error?.body || error?.message);
    }
  }

  private truncateMessage(message: string) {
    const maxLength = 1800;

    if (!message || message.length <= maxLength) {
      return message || '';
    }

    return `${message.slice(0, maxLength)}...`;
  }
}
