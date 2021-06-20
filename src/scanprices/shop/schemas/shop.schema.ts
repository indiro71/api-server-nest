import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ShopDocument = Shop & Document;

@Schema()
export class Shop {
  @Prop({
    required: true,
  })
  name: string;

  @Prop({
    required: true,
  })
  url: string;

  @Prop({
    required: true,
  })
  tagPrices: Array<string>;

  @Prop()
  tagAvailable: string;

  @Prop()
  tagImage: string;

  @Prop()
  elementPrice: string;

  @Prop()
  tagName: string;

  @Prop({
    default: 'GET',
  })
  methodRequest: string;

  @Prop({
    default: Date.now,
  })
  date: Date;
}

export const ShopSchema = SchemaFactory.createForClass(Shop);
