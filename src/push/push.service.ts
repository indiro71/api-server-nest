import {
  BadRequestException,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomBytes } from 'crypto';
import * as webPush from 'web-push';
import { PushSubscriptionDto } from './dto/push-subscription.dto';
import {
  PushSubscriptionDocument,
  PushSubscriptionEntity,
} from './schemas/push-subscription.schema';
import {
  PushDeliveryDocument,
  PushDeliveryEntity,
} from './schemas/push-delivery.schema';

@Injectable()
export class PushService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(PushService.name);
  private readonly publicKey = process.env.WEB_PUSH_PUBLIC_KEY;
  private readonly privateKey = process.env.WEB_PUSH_PRIVATE_KEY;
  private readonly subject =
    process.env.WEB_PUSH_SUBJECT || 'mailto:admin@indiro.ru';
  private activeButtonsCount = 0;
  private processing = false;
  private queueTimer?: NodeJS.Timeout;

  constructor(
    @InjectModel(PushSubscriptionEntity.name)
    private readonly subscriptionModel: Model<PushSubscriptionDocument>,
    @InjectModel(PushDeliveryEntity.name)
    private readonly deliveryModel: Model<PushDeliveryDocument>,
  ) {}

  onApplicationBootstrap() {
    this.queueTimer = setInterval(() => {
      void this.processQueue();
    }, 5000);
    this.queueTimer.unref();
  }

  onApplicationShutdown() {
    if (this.queueTimer) clearInterval(this.queueTimer);
  }

  getPublicKey() {
    return {
      publicKey: this.publicKey || null,
      enabled: Boolean(this.publicKey && this.privateKey),
    };
  }

  async subscribe(dto: PushSubscriptionDto, userId?: string) {
    let endpoint: URL;
    try {
      endpoint = new URL(dto?.endpoint);
    } catch {
      throw new BadRequestException('Invalid push endpoint');
    }
    const allowedHost =
      endpoint.hostname === 'fcm.googleapis.com' ||
      endpoint.hostname === 'updates.push.services.mozilla.com' ||
      endpoint.hostname.endsWith('.push.apple.com');
    if (
      endpoint.protocol !== 'https:' ||
      endpoint.username ||
      endpoint.password ||
      (endpoint.port && endpoint.port !== '443') ||
      !allowedHost ||
      !/^[\w-]{87}$/.test(dto?.keys?.p256dh || '') ||
      !/^[\w-]{22}$/.test(dto?.keys?.auth || '')
    ) {
      throw new BadRequestException('Invalid push subscription');
    }
    let appUrl: string;
    if (dto.appUrl) {
      try {
        const url = new URL(dto.appUrl);
        if (
          url.protocol !== 'https:' &&
          !(url.protocol === 'http:' && url.hostname === 'localhost')
        )
          throw new Error();
        appUrl = `${url.origin}/`;
      } catch {
        throw new BadRequestException('Invalid application URL');
      }
    }
    await this.subscriptionModel.findOneAndUpdate(
      { endpoint: dto.endpoint },
      {
        endpoint: dto.endpoint,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
        userId,
        ...(appUrl ? { appUrl } : {}),
        dateUpdate: new Date(),
      },
      { new: true, setDefaultsOnInsert: true, upsert: true },
    );
    // Never return endpoint or encryption keys to the UI.
    return { success: true };
  }

  async unsubscribe(dto: { endpoint: string }, userId: string) {
    if (!dto?.endpoint)
      throw new BadRequestException('Invalid push subscription');
    await this.subscriptionModel.deleteOne({ endpoint: dto.endpoint, userId });
    return { success: true };
  }

  // Badge updates alone must never wake a browser with a silent Web Push.
  async notifyTradingSignals(payload: { activeButtonsCount: number }) {
    this.activeButtonsCount = Math.max(
      0,
      Math.floor(Number(payload.activeButtonsCount) || 0),
    );
  }

  async sendMessage(
    title: string,
    message: string,
    tag = 'trading-message',
    priority = 0,
  ) {
    if (!this.getPublicKey().enabled || !message?.trim()) return;
    const subscriptions = await this.subscriptionModel.find();
    return this.enqueue(subscriptions, title, message, tag, 0, priority);
  }

  async sendEmergencyMessage(title: string, message: string) {
    return this.sendMessage(title, message, 'trading-emergency', 100);
  }

  async testPush(endpoint: string, userId: string) {
    if (!this.getPublicKey().enabled)
      throw new BadRequestException('Push are not configured on the server');
    const subscription = await this.subscriptionModel.findOne({
      endpoint,
      userId,
    });
    if (!subscription)
      throw new BadRequestException('Reconnect push notifications first');
    const recent = await this.deliveryModel.findOne({
      subscriptionId: String(subscription._id),
      tag: /^push-test-/,
      createdAt: { $gt: new Date(Date.now() - 30_000) },
    });
    if (recent)
      throw new BadRequestException('Wait 30 seconds before another test');
    const eventId = await this.enqueue(
      [subscription],
      'Web3 — проверка',
      'Тестовое уведомление. Доставка push работает.',
      'push-test',
      5000,
    );
    return { eventId, state: 'queued', delaySeconds: 5 };
  }

  async status(endpoint: string, userId: string, eventId?: string) {
    const subscription = await this.subscriptionModel.findOne({
      endpoint,
      userId,
    });
    if (!subscription) return { subscribed: false, lastDelivery: null };
    const delivery = await this.deliveryModel
      .findOne({
        subscriptionId: String(subscription._id),
        userId,
        ...(eventId ? { eventId } : {}),
      })
      .sort({ createdAt: -1 });
    return {
      subscribed: true,
      lastDelivery: delivery
        ? {
            eventId: delivery.eventId,
            state: delivery.state,
            attempts: delivery.attempts,
            statusCode: delivery.statusCode,
            createdAt: delivery.createdAt,
            acceptedAt: delivery.acceptedAt,
          }
        : null,
    };
  }

  private async enqueue(
    subscriptions: PushSubscriptionDocument[],
    title: string,
    body: string,
    tag: string,
    delay = 0,
    priority = 0,
  ) {
    const eventId = randomBytes(16).toString('hex');
    const now = Date.now();
    if (subscriptions.length) {
      await this.deliveryModel.insertMany(
        subscriptions.map((subscription) => ({
          eventId,
          subscriptionId: String(subscription._id),
          userId: subscription.userId,
          priority,
          title: this.truncateUtf8(title || 'Trading monitor', 120),
          body: this.truncateUtf8(body, 1000),
          tag: `${tag.slice(0, 40)}-${eventId}`,
          badge: this.activeButtonsCount,
          nextAttemptAt: new Date(now + delay),
          expiresAt: new Date(now + 5 * 60_000),
          deleteAt: new Date(now + 7 * 24 * 3600_000),
        })),
      );
    }
    return eventId;
  }

  async processQueue() {
    if (this.processing || !this.getPublicKey().enabled) return;
    this.processing = true;
    try {
      await this.deliveryModel.updateMany(
        {
          state: { $in: ['pending', 'sending'] },
          expiresAt: { $lte: new Date() },
        },
        { $set: { state: 'expired' } },
      );
      await this.deliveryModel.updateMany(
        {
          state: { $in: ['pending', 'sending'] },
          attempts: { $gte: 6 },
          nextAttemptAt: { $lte: new Date() },
        },
        { $set: { state: 'failed' } },
      );
      // Atomic leases also recover jobs interrupted by a server restart.
      for (let batch = 0; batch < 4; batch++) {
        const jobs = await Promise.all(
          Array.from({ length: 5 }, async () => {
            const now = new Date();
            return this.deliveryModel.findOneAndUpdate(
              {
                state: { $in: ['pending', 'sending'] },
                attempts: { $lt: 6 },
                nextAttemptAt: { $lte: now },
                expiresAt: { $gt: now },
              },
              {
                $set: {
                  state: 'sending',
                  leaseId: randomBytes(12).toString('hex'),
                  nextAttemptAt: new Date(Date.now() + 60_000),
                },
                $inc: { attempts: 1 },
              },
              { new: true, sort: { priority: -1, nextAttemptAt: 1 } },
            );
          }),
        );
        await Promise.all(jobs.filter(Boolean).map((job) => this.deliver(job)));
        if (jobs.some((job) => !job)) break;
      }
    } catch {
      this.logger.error(
        'Push queue processing failed; pending deliveries will be retried',
      );
    } finally {
      this.processing = false;
    }
  }

  private async deliver(job: PushDeliveryDocument) {
    const claim = { _id: job._id, state: 'sending', leaseId: job.leaseId };
    const subscription = await this.subscriptionModel.findById(
      job.subscriptionId,
    );
    if (
      !subscription ||
      String(subscription.userId || '') !== String(job.userId || '')
    ) {
      await this.deliveryModel.updateOne(claim, {
        $set: { state: 'unsubscribed' },
      });
      return;
    }
    const notification = {
      title: job.title,
      body: job.body,
      tag: job.tag,
      ...(subscription.appUrl ? { navigate: subscription.appUrl } : {}),
      app_badge: String(job.badge || 0),
      data: { eventId: job.eventId, url: '/' },
    };
    // Flat fields keep already installed workers working during rollout.
    const serialize = () =>
      JSON.stringify({
        ...(subscription.appUrl ? { web_push: 8030, notification } : {}),
        title: job.title,
        body: notification.body,
        tag: job.tag,
        badge: job.badge,
        eventId: job.eventId,
      });
    let payload = serialize();
    // JSON escaping can expand even a short UTF-8 body. Leave room for encryption.
    while (
      Buffer.byteLength(payload, 'utf8') > 3800 &&
      notification.body.length > 1
    ) {
      notification.body = Array.from(notification.body)
        .slice(0, Math.floor(Array.from(notification.body).length * 0.75))
        .join('');
      payload = serialize();
    }
    let statusCode: number;
    try {
      const response = await webPush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { auth: subscription.auth, p256dh: subscription.p256dh },
        },
        payload,
        {
          vapidDetails: {
            subject: this.subject,
            publicKey: this.publicKey,
            privateKey: this.privateKey,
          },
          TTL: Math.max(
            1,
            Math.ceil((job.expiresAt.getTime() - Date.now()) / 1000),
          ),
          urgency: 'high',
          timeout: 15_000,
        },
      );
      statusCode = response.statusCode;
    } catch (error) {
      statusCode = Number(error?.statusCode) || 0;
      if (statusCode === 404 || statusCode === 410) {
        await this.subscriptionModel.deleteOne({
          _id: subscription._id,
          dateUpdate: subscription.dateUpdate,
        });
      }
      const retryable =
        statusCode === 0 ||
        statusCode === 408 ||
        statusCode === 429 ||
        statusCode >= 500;
      const delay = this.retryDelayMs(
        job.attempts,
        error?.headers?.['retry-after'],
      );
      const retry =
        retryable &&
        job.attempts < 6 &&
        Date.now() + delay < job.expiresAt.getTime();
      await this.deliveryModel.updateOne(claim, {
        $set: {
          state: retry ? 'pending' : 'failed',
          statusCode,
          nextAttemptAt: new Date(Date.now() + delay),
        },
      });
      // Do not log endpoints, encryption keys, payloads or provider response bodies.
      this.logger.warn(
        `Push ${job.eventId}: ${retry ? 'retry' : 'failed'} (${statusCode})`,
      );
      return;
    }
    await this.deliveryModel.updateOne(claim, {
      $set: { state: 'accepted', statusCode, acceptedAt: new Date() },
    });
  }

  private retryDelayMs(attempt: number, retryAfter?: string) {
    const seconds = Number(retryAfter);
    const providerDelay = retryAfter
      ? Number.isFinite(seconds)
        ? seconds * 1000
        : Date.parse(retryAfter) - Date.now()
      : 0;
    return Math.max(
      5000 * Math.pow(2, Math.min(attempt - 1, 5)),
      Number.isFinite(providerDelay) ? providerDelay : 0,
    );
  }

  private truncateUtf8(value: string, bytes: number) {
    let result = '';
    for (const character of value) {
      if (Buffer.byteLength(result + character, 'utf8') > bytes)
        return `${result}…`;
      result += character;
    }
    return result;
  }
}
