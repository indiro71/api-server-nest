import { ApiProperty } from '@nestjs/swagger';

export class CreateCurrencyDto {
  _id?: any;

  @ApiProperty({ example: 'KAS-USDT', description: 'Currency name' })
  readonly name: string;

  @ApiProperty({ example: 'KASUSDT', description: 'Currency symbol' })
  readonly symbol: string;

  @ApiProperty({ example: 0.001, description: 'Step monitoring' })
  readonly step: number;

  @ApiProperty({ example: 0.001, description: 'Step sold' })
  readonly soldStep: number;

  @ApiProperty({ example: 0.140, description: 'Last value' })
  readonly lastValue: number;

  @ApiProperty({ example: 0.160, description: 'Maximum trading price' })
  readonly maxTradePrice: number;

  @ApiProperty({ example: 0, description: 'Minimum trading price' })
  readonly minTradePrice: number;

  @ApiProperty({ example: true, description: 'Currency is active' })
  readonly isActive: boolean;

  @ApiProperty({ example: true, description: 'Currency can buy' })
  readonly canBuy: boolean;

  @ApiProperty({ example: true, description: 'Currency can sell' })
  readonly canSell: boolean;

  @ApiProperty({ example: false, description: 'Currency send statistics' })
  readonly sendStat: boolean;

  @ApiProperty({ example: false, description: 'Can change strategy' })
  readonly canChangeStrategy: boolean;

  @ApiProperty({ example: false, description: 'Is statistics' })
  readonly isStatistics: boolean;

  @ApiProperty({ example: false, description: 'Under sold step' })
  readonly underSoldStep: boolean;

  @ApiProperty({ example: 50, description: 'Purchase quantity' })
  readonly purchaseQuantity: number;

  @ApiProperty({ example: false, description: 'Is new strategy' })
  readonly isNewStrategy: boolean;

  @ApiProperty({ example: false, description: 'Send notification' })
  readonly sendNotification: boolean;
}
