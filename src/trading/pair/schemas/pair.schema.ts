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

  @ApiProperty({ example: 500, description: 'Long Margin Limit' })
  @Prop({
    default: 250,
  })
  longMarginLimit: number;

  @ApiProperty({ example: 400, description: 'Short Margin Limit' })
  @Prop({
    default: 200,
  })
  shortMarginLimit: number;

  @ApiProperty({ example: 20, description: 'Long Margin Step' })
  @Prop({
    default: 5,
  })
  longMarginStep: number;

  @ApiProperty({ example: 10, description: 'Short Margin Step' })
  @Prop({
    default: 5,
  })
  shortMarginStep: number;

  @ApiProperty({ example: 10, description: 'Margin Difference' })
  @Prop({
    default: 20,
  })
  marginDifference: number;

  @ApiProperty({ example: 10, description: 'Current price' })
  @Prop({
    default: 0.1,
  })
  currentPrice: number;

  @ApiProperty({ example: 2, description: 'Sell percent' })
  @Prop({
    default: 1.3,
  })
  sellPercent: number;

  @ApiProperty({ example: 1.2, description: 'Buy Long Coefficient' })
  @Prop({
    default: 1.5,
  })
  buyLongCoefficient: number;

  @ApiProperty({ example: 1.2, description: 'Buy Short Coefficient' })
  @Prop({
    default: 2,
  })
  buyShortCoefficient: number;

  @ApiProperty({ example: 6, description: 'Alarm percent' })
  @Prop({
    default: 9,
  })
  alarmPercent: number;

  @ApiProperty({ example: 6, description: 'Critical percent' })
  @Prop({
    default: 9.5,
  })
  criticalPercent: number;

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

  @ApiProperty({ example: 100, description: 'Long All margin' })
  @Prop({
    default: 20,
  })
  longAllMargin: number;

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

  @ApiProperty({ example: 100, description: 'Short All margin' })
  @Prop({
    default: 20,
  })
  shortAllMargin: number;

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

  @ApiProperty({ example: false, description: 'Buy Notification is sending' })
  @Prop({
    default: false,
  })
  buyNotificationSending: boolean;

  @ApiProperty({ example: false, description: 'Sell Notification is sending' })
  @Prop({
    default: false,
  })
  sellNotificationSending: boolean;

  @ApiProperty({ example: false, description: 'Margin Notification is sending' })
  @Prop({
    default: false,
  })
  marginNotificationSending: boolean;

  @ApiProperty({ example: 2, description: 'Round' })
  @Prop({
    default: 2,
  })
  round: number;

  @ApiProperty({ example: 1, description: 'Order' })
  @Prop({
    default: 1,
  })
  order: number;

  @ApiProperty({ example: 100, description: 'Long Liquidate Price' })
  @Prop({
    default: 0.1,
  })
  longLiquidatePrice: number;

  @ApiProperty({ example: 100, description: 'Long Liquidate Percent' })
  @Prop({
    default: 10,
  })
  longLiquidatePercent: number;

  @ApiProperty({ example: 100, description: 'Short Liquidate Price' })
  @Prop({
    default: 0.1,
  })
  shortLiquidatePrice: number;

  @ApiProperty({ example: 100, description: 'Short Liquidate Percent' })
  @Prop({
    default: 10,
  })
  shortLiquidatePercent: number;

  @ApiProperty({ example: 100, description: 'Next Buy Short Price' })
  @Prop({
    default: 0.1,
  })
  nextBuyShortPrice: number;

  @ApiProperty({ example: false, description: 'Next Buy Short Price Warning' })
  @Prop({
    default: false,
  })
  nextBuyShortPriceWarning: boolean;

  @ApiProperty({ example: 100, description: 'Critical Buy Short Price' })
  @Prop({
    default: 0.1,
  })
  criticalBuyShortPrice: number;

  @ApiProperty({ example: false, description: 'Critical Buy Short Price Warning' })
  @Prop({
    default: false,
  })
  criticalBuyShortPriceWarning: boolean;

  @ApiProperty({ example: 100, description: 'Next Buy Long Price' })
  @Prop({
    default: 0.1,
  })
  nextBuyLongPrice: number;

  @ApiProperty({ example: false, description: 'Next Buy Long Price Warning' })
  @Prop({
    default: false,
  })
  nextBuyLongPriceWarning: boolean;

  @ApiProperty({ example: 100, description: 'Critical Buy Long Price' })
  @Prop({
    default: 0.1,
  })
  criticalBuyLongPrice: number;

  @ApiProperty({ example: false, description: 'Critical Buy Long Price Warning' })
  @Prop({
    default: false,
  })
  criticalBuyLongPriceWarning: boolean;

  @ApiProperty({ example: 100, description: 'Sell Short Price' })
  @Prop({
    default: 0.1,
  })
  sellShortPrice: number;

  @ApiProperty({ example: false, description: 'Sell Short Price Warning' })
  @Prop({
    default: false,
  })
  sellShortPriceWarning: boolean;

  @ApiProperty({ example: 100, description: 'Sell Long Price' })
  @Prop({
    default: 0.1,
  })
  sellLongPrice: number;

  @ApiProperty({ example: false, description: 'Sell Long Price Warning' })
  @Prop({
    default: false,
  })
  sellLongPriceWarning: boolean;

  @ApiProperty({ example: false, description: 'Auto add long margin' })
  @Prop({
    default: false,
  })
  autoAddLongMargin: boolean;

  @ApiProperty({ example: false, description: 'Auto add short margin' })
  @Prop({
    default: false,
  })
  autoAddShortMargin: boolean;

  @ApiProperty({ example: 4, description: 'Orders Count' })
  @Prop({
    default: 1,
  })
  ordersCount: number;

  @ApiProperty({ example: 30, description: 'Long percent' })
  @Prop({
    default: 0.1,
  })
  longPercent: number;

  @ApiProperty({ example: 30, description: 'Short percent' })
  @Prop({
    default: 0.1,
  })
  shortPercent: number;
}

export const PairSchema = SchemaFactory.createForClass(Pair);
