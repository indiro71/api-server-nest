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

  @ApiProperty({ example: 50, description: 'Purchase quantity' })
  @Prop({
    required: true,
  })
  purchaseQuantity: number;

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
}

export const CurrencySchema = SchemaFactory.createForClass(Currency);
