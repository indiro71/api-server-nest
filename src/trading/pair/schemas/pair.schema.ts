import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type PairDocument = Pair & Document;

@Schema()
export class Pair {
  _id?: any;

  @ApiProperty({ example: 'KAS USDT', description: 'Pair name' })
  @Prop({
    required: true,
  })
  name: string;

  @ApiProperty({ example: 'KASUSDT', description: 'Pair symbol' })
  @Prop({
    required: true,
  })
  symbol: string;

  @ApiProperty({ example: 'KAS_USDT', description: 'Pair contract' })
  @Prop({
    required: true,
  })
  contract: string;

  @ApiProperty({ example: 10, description: 'Trade leverage' })
  @Prop({
    default: 10,
  })
  leverage: number;

  @ApiProperty({ example: 200, description: 'Margin Limit' })
  @Prop({
    default: 200,
  })
  marginLimit: number;

  @ApiProperty({ example: 20, description: 'Margin Step' })
  @Prop({
    default: 20,
  })
  marginStep: number;

  @ApiProperty({ example: 10, description: 'Margin Difference' })
  @Prop({
    default: 10,
  })
  marginDifference: number;

  @ApiProperty({ example: 10, description: 'Current price' })
  @Prop({
    default: 0.1,
  })
  currentPrice: number;

  @ApiProperty({ example: 3, description: 'Sell percent' })
  @Prop({
    default: 3,
  })
  sellPercent: number;

  @ApiProperty({ example: 6, description: 'Buy percent' })
  @Prop({
    default: 6,
  })
  buyPercent: number;

  @ApiProperty({ example: 2, description: 'Buy more percent' })
  @Prop({
    default: 2,
  })
  buyMorePercent: number;

  @ApiProperty({ example: 100, description: 'Trade profit' })
  @Prop({
    default: 0.1,
  })
  profit: number;

  @ApiProperty({ example: 100, description: 'Trade loss' })
  @Prop({
    default: 0.1,
  })
  loss: number;

  @ApiProperty({ example: 100, description: 'Long price' })
  @Prop({
    default: 0.1,
  })
  longPrice: number;

  @ApiProperty({ example: 100, description: 'Long margin' })
  @Prop({
    default: 20,
  })
  longMargin: number;

  @ApiProperty({ example: 100, description: 'Short price' })
  @Prop({
    default: 0.1,
  })
  shortPrice: number;

  @ApiProperty({ example: 100, description: 'Short margin' })
  @Prop({
    default: 20,
  })
  shortMargin: number;

  @ApiProperty({
    example: '1624216164414',
    description: 'Date create pair',
    default: Date.now(),
    required: false,
  })
  @Prop({
    default: Date.now,
  })
  dateCreate: Date;

  @ApiProperty({ example: true, description: 'Pair is active' })
  @Prop({
    default: true,
  })
  isActive: boolean;

  @ApiProperty({
    example: '1624216164414',
    description: 'Date update pair',
    default: Date.now(),
    required: false,
  })
  @Prop({
    default: Date.now,
  })
  dateUpdate: Date;

  @ApiProperty({ example: false, description: 'Sending notifications' })
  @Prop({
    default: true,
  })
  sendNotification: boolean;

  @ApiProperty({ example: false, description: 'Buy Long Notification is sending' })
  @Prop({
    default: false,
  })
  buyLongNotification: boolean;

  @ApiProperty({ example: false, description: 'Buy More Long Notification is sending' })
  @Prop({
    default: false,
  })
  buyMoreLongNotification: boolean;

  @ApiProperty({ example: false, description: 'Sell Long Notification is sending' })
  @Prop({
    default: false,
  })
  sellLongNotification: boolean;

  @ApiProperty({ example: false, description: 'Buy Short Notification is sending' })
  @Prop({
    default: false,
  })
  buyShortNotification: boolean;

  @ApiProperty({ example: false, description: 'Buy More Short Notification is sending' })
  @Prop({
    default: false,
  })
  buyMoreShortNotification: boolean;

  @ApiProperty({ example: false, description: 'Sell Short Notification is sending' })
  @Prop({
    default: false,
  })
  sellShortNotification: boolean;
}

export const PairSchema = SchemaFactory.createForClass(Pair);
