import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';
import * as mongoose from 'mongoose';
import { Currency } from '../../currency/schemas/currency.schema';

export type OrderDocument = Order & Document;

@Schema()
export class Order {
  _id?: any;

  @ApiProperty({ description: 'Currency' })
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Currency' })
  currency: Currency;

  @ApiProperty({
    example: '1624216164414',
    description: 'Date buy currency',
    default: Date.now(),
    required: false,
  })
  @Prop({
    default: Date.now,
  })
  dateBuy: Date;

  @ApiProperty({
    example: '1624216164414',
    description: 'Date sell currency',
    required: false,
  })
  dateSell: Date;

  @ApiProperty({ example: 100, description: 'Quantity buy currency' })
  @Prop({
    required: true,
  })
  quantity: number;

  @ApiProperty({ example: 0.14, description: 'Current price currency' })
  @Prop({
    required: true,
  })
  currencyPrice: number;

  @ApiProperty({ example: 0.14, description: 'Buy price currency' })
  @Prop({
    required: true,
  })
  buyPrice: number;

  @ApiProperty({ example: 0.15, description: 'Sell price currency' })
  @Prop({
    required: false,
  })
  sellPrice: number;

  @ApiProperty({ example: "Json buy string", description: 'Result buy' })
  @Prop({
    required: false,
  })
  buyResult: string;

  @ApiProperty({ example: "Json sell string", description: 'Result sell' })
  @Prop({
    required: false,
  })
  sellResult: string;

  @ApiProperty({
    example: false,
    description: 'Order is sold',
    required: false,
  })
  @Prop({
    default: false,
  })
  sold: boolean;

  @ApiProperty({
    example: false,
    description: 'Order is exhibited',
    required: false,
  })
  @Prop({
    default: false,
  })
  exhibited: boolean;

  @ApiProperty({ example: "Order id", description: '12345' })
  @Prop({
    required: false,
  })
  orderId: string;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
