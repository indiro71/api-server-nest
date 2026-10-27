import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PushDeliveryDocument = PushDeliveryEntity & Document;

@Schema()
export class PushDeliveryEntity {
  @Prop({ required: true }) eventId: string;
  @Prop({ required: true }) subscriptionId: string;
  @Prop() userId?: string;
  @Prop({ required: true }) title: string;
  @Prop({ required: true }) body: string;
  @Prop({ required: true }) tag: string;
  @Prop() badge?: number;
  @Prop({ default: 'pending' }) state: string;
  @Prop({ default: 0 }) attempts: number;
  @Prop({ default: 0 }) priority: number;
  @Prop({ default: Date.now }) createdAt: Date;
  @Prop({ required: true }) nextAttemptAt: Date;
  @Prop({ required: true }) expiresAt: Date;
  @Prop({ required: true }) deleteAt: Date;
  @Prop() leaseId?: string;
  @Prop() statusCode?: number;
  @Prop() acceptedAt?: Date;
}

export const PushDeliverySchema =
  SchemaFactory.createForClass(PushDeliveryEntity);
PushDeliverySchema.index({ eventId: 1, subscriptionId: 1 }, { unique: true });
PushDeliverySchema.index({ state: 1, nextAttemptAt: 1 });
PushDeliverySchema.index({ deleteAt: 1 }, { expireAfterSeconds: 0 });
