import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { User } from '../../../user/schemas/user.schema';
import * as mongoose from 'mongoose';
import { Shop } from '../../shop/schemas/shop.schema';
import { ApiProperty } from '@nestjs/swagger';

export type ProductDocument = Product & Document;

@Schema()
export class Product {
  @ApiProperty({ example: 'Apple iphone 12 pro', description: 'Product name' })
  @Prop({
    required: true,
  })
  name: string;

  @ApiProperty({
    example: 'https://ozon.ru/iphone-12-pro',
    description: 'Product url',
  })
  @Prop({
    required: true,
  })
  url: string;

  @ApiProperty({ description: 'Shop' })
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Shop' })
  shop: Shop;

  @ApiProperty({ description: 'User created' })
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  user: User;

  @ApiProperty({
    example: false,
    description: 'Product available',
    required: false,
  })
  @Prop({
    default: false,
  })
  available: boolean;

  @ApiProperty({
    example: 10000,
    description: 'Current product price',
    required: false,
  })
  @Prop()
  currentPrice: number;

  @ApiProperty({
    example: 5000,
    description: 'Minimum product price',
    required: false,
  })
  @Prop()
  minPrice: number;

  @ApiProperty({
    example: 15000,
    description: 'Maximum product price',
    required: false,
  })
  @Prop()
  maxPrice: number;

  @ApiProperty({
    example: 'iphone-12-pro.jpg',
    description: 'Product image name',
    required: false,
  })
  @Prop()
  image: string;

  @ApiProperty({ example: true, description: 'Product enabled', default: true })
  @Prop({
    required: true,
    default: true,
  })
  enabled: boolean;

  @ApiProperty({
    example: '1624216164414',
    description: 'Date added product',
    default: Date.now(),
    required: false,
  })
  @Prop({
    default: Date.now,
  })
  dateCreate: Date;

  @ApiProperty({
    example: '1624216164414',
    description: 'Date updated product',
    default: Date.now(),
    required: false,
  })
  @Prop({
    default: Date.now,
  })
  dateUpdate: Date;
}

export const ProductSchema = SchemaFactory.createForClass(Product);
