import { ApiProperty } from '@nestjs/swagger';

export class CreateCurrencyDto {
  _id?: any;

  @ApiProperty({ example: 'KAS-USDT', description: 'Currency name' })
  readonly name: string;

  @ApiProperty({ example: 'KASUSDT', description: 'Currency symbol' })
  readonly symbol: string;

  @ApiProperty({ example: 0.001, description: 'Step monitoring' })
  readonly step: number;

  @ApiProperty({ example: 0.140, description: 'Last value' })
  readonly lastValue: number;

  @ApiProperty({ example: 50, description: 'Purchase quantity' })
  readonly purchaseQuantity: number;
}
