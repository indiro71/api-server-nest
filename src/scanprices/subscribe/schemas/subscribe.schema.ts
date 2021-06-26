import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { User } from '../../../user/schemas/user.schema';
import * as mongoose from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { Product } from '../../product/schemas/product.schema';

export type SubscribeDocument = Subscribe & Document;

@Schema()
export class Subscribe {
  _id: any;

  @ApiProperty({ example: 15000, description: 'Subscribe price' })
  @Prop({
    required: true,
  })
  price: number;

  @ApiProperty({ description: 'Product' })
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Product' })
  product: Product;

  @ApiProperty({ description: 'User created' })
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  user: User;

  @ApiProperty({
    example: true,
    description: 'Subscribe enabled',
    default: true,
  })
  @Prop({
    required: true,
    default: true,
  })
  enabled: boolean;

  @ApiProperty({
    example: '1624216164414',
    description: 'Date added subscribe',
    default: Date.now(),
    required: false,
  })
  @Prop({
    default: Date.now,
  })
  dateUpdate: Date;
}

export const SubscribeSchema = SchemaFactory.createForClass(Subscribe);
