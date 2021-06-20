import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Product } from '../../product/schemas/product.schema';
import * as mongoose from 'mongoose'

export type PriceDocument = Price & Document;

@Schema()
export class Price {
  @Prop({
    required: true,
  })
  price: number;

  @Prop({type: mongoose.Schema.Types.ObjectId, ref: 'Product'})
  good: Product;

  @Prop({
    default: Date.now,
  })
  date: Date;
}

export const PriceSchema = SchemaFactory.createForClass(Price);
