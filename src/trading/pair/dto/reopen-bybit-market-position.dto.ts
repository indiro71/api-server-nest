import { ApiProperty } from '@nestjs/swagger';
import { BybitMarketPositionSide } from './buy-bybit-market-position.dto';

export class ReopenBybitMarketPositionDto {
  @ApiProperty({ example: 'long', enum: BybitMarketPositionSide })
  readonly side: BybitMarketPositionSide;

  @ApiProperty({ example: 20, enum: [20, 25, 30, 35, 40, 45, 50] })
  readonly amount: number;
}
