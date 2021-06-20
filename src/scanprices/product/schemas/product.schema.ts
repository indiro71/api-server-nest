import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { User } from '../../../user/schemas/user.schema';
import * as mongoose from 'mongoose';
import { Shop } from '../../shop/schemas/shop.schema';

export type ProductDocument = Product & Document;

@Schema()
export class Product {
  @Prop({
    required: true,
  })
  name: string;

  @Prop({
    required: true,
  })
  url: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Shop' })
  shop: Shop;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  user: User;

  @Prop({
    default: false,
  })
  available: boolean;

  @Prop()
  currentPrice: number;

  @Prop()
  minPrice: number;

  @Prop()
  maxPrice: number;

  @Prop()
  image: string;

  @Prop({
    required: true,
    default: true,
  })
  enabled: boolean;

  @Prop({
    default: Date.now,
  })
  dateCreate: Date;

  @Prop({
    default: Date.now,
  })
  dateUpdate: Date;
}

export const ProductSchema = SchemaFactory.createForClass(Product);
