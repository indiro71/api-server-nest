import { ApiProperty } from '@nestjs/swagger';

export class CreatePairDto {
  _id?: any;

  @ApiProperty({ example: 'KAS USDT', description: 'Pair name' })
  readonly name: string;

  @ApiProperty({ example: 'KASUSDT', description: 'Pair symbol' })
  readonly symbol: string;

  @ApiProperty({ example: 'KAS_USDT', description: 'Pair contract' })
  readonly contract: string;
}
