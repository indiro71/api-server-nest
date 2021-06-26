import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Product } from '../../product/schemas/product.schema';
import * as mongoose from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type PriceDocument = Price & Document;

@Schema()
export class Price {
  @ApiProperty({ example: 10000, description: 'One of some prices of product' })
  @Prop({
    required: true,
  })
  price: number;

  @ApiProperty({ description: 'Product' })
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Product' })
  product: Product;

  @ApiProperty({
    example: '1624216164414',
    description: 'Date added price',
    default: Date.now(),
    required: false,
  })
  @Prop({
    default: Date.now,
  })
  date: Date;
}

export const PriceSchema = SchemaFactory.createForClass(Price);
