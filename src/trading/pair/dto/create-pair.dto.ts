import { ApiProperty } from '@nestjs/swagger';

export class CreatePairDto {
    _id?: any;

    @ApiProperty({ example: 'KAS USDT', description: 'Pair name' })
    readonly name: string;

    @ApiProperty({ example: 'KASUSDT', description: 'Pair symbol' })
    readonly symbol: string;

    @ApiProperty({ example: 'KAS_USDT', description: 'Pair contract' })
    readonly contract: string;

    @ApiProperty({ example: 'MEXC', description: 'Pair exchange' })
    readonly exchange: string;

    @ApiProperty({ example: 2, description: 'Price rounding decimal places' })
    readonly round: number;

    @ApiProperty({ example: 1, description: 'Pair sorting order' })
    readonly order: number;
}
