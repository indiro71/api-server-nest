import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type CurrencyDocument = Currency & Document;

@Schema()
export class Currency {
  _id?: any;

  @ApiProperty({ example: 'KAS-USDT', description: 'Currency name' })
  @Prop({
    required: true,
  })
  name: string;

  @ApiProperty({ example: 'KASUSDT', description: 'Currency symbol' })
  @Prop({
    required: true,
  })
  symbol: string;

  @ApiProperty({ example: 0.001, description: 'Step monitoring' })
  @Prop({
    required: true,
  })
  step: number;

  @ApiProperty({ example: 0.140, description: 'Last value' })
  @Prop({
    required: true,
  })
  lastValue: number;

  @ApiProperty({ example: 0.160, description: 'Maximum trading price' })
  @Prop({
    required: true,
  })
  maxTradePrice: number;

  @ApiProperty({ example: 0, description: 'Minimum trading price' })
  @Prop({
    required: true,
  })
  minTradePrice: number;

  @ApiProperty({ example: 50, description: 'Purchase quantity' })
  @Prop({
    required: true,
  })
  purchaseQuantity: number;

  @ApiProperty({ example: true, description: 'Currency is active' })
  @Prop({
    default: true,
  })
  isActive: boolean;

  @ApiProperty({ example: true, description: 'Currency can buy' })
  @Prop({
    default: true,
  })
  canBuy: boolean;

  @ApiProperty({ example: true, description: 'Currency can sell' })
  @Prop({
    default: true,
  })
  canSell: boolean;

  @ApiProperty({ example: false, description: 'Currency send statistics' })
  @Prop({
    default: false,
  })
  sendStat: boolean;

  @ApiProperty({
    example: '1624216164414',
    description: 'Date create currency',
    default: Date.now(),
    required: false,
  })
  @Prop({
    default: Date.now,
  })
  dateCreate: Date;

  @ApiProperty({
    example: '1624216164414',
    description: 'Date update currency',
    default: Date.now(),
    required: false,
  })
  @Prop({
    default: Date.now,
  })
  dateUpdate: Date;

  @ApiProperty({ example: false, description: 'Is new strategy' })
  @Prop({
    default: false,
  })
  isNewStrategy: boolean;

  @ApiProperty({ example: false, description: 'Send notification' })
  @Prop({
    default: false,
  })
  sendNotification: boolean;
}

export const CurrencySchema = SchemaFactory.createForClass(Currency);
