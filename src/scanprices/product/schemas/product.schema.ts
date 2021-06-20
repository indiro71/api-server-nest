import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

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
  url: number;

  @Prop()
  shop: string; //!

  @Prop()
  user: string; //!

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
