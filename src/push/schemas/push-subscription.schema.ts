import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PushSubscriptionDocument = PushSubscriptionEntity & Document;

@Schema()
export class PushSubscriptionEntity {
  _id?: any;

  @Prop({ required: true, unique: true })
  endpoint: string;

  @Prop({ required: true })
  p256dh: string;

  @Prop({ required: true })
  auth: string;

  @Prop()
  userId?: string;

  @Prop({ default: Date.now })
  dateCreate: Date;

  @Prop({ default: Date.now })
  dateUpdate: Date;
}

export const PushSubscriptionSchema = SchemaFactory.createForClass(PushSubscriptionEntity);
