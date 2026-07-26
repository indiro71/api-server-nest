import { ApiProperty } from '@nestjs/swagger';

export enum BybitMarketPositionSide {
  LONG = 'long',
  SHORT = 'short',
}

export class BuyBybitMarketPositionDto {
  @ApiProperty({ example: 'long', enum: BybitMarketPositionSide })
  readonly side: BybitMarketPositionSide;

  @ApiProperty({ example: 5, enum: [5, 10] })
  readonly amount: number;
}
