import { ApiProperty } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiProperty({ example: 'Apple iphone 12 pro', description: 'Product name' })
  readonly name: string;

  @ApiProperty({
    example: 'https://ozon.ru/iphone-12-pro',
    description: 'Product url',
  })
  readonly url: string;

  @ApiProperty({
    example: false,
    description: 'Product available',
    required: false,
  })
  readonly available?: boolean;

  @ApiProperty({
    example: 10000,
    description: 'Current product price',
    required: false,
  })
  readonly currentPrice?: number;

  @ApiProperty({
    example: 5000,
    description: 'Minimum product price',
    required: false,
  })
  readonly minPrice?: number;

  @ApiProperty({
    example: 15000,
    description: 'Maximum product price',
    required: false,
  })
  readonly maxPrice?: number;

  @ApiProperty({
    example: 'iphone-12-pro.jpg',
    description: 'Product image name',
    required: false,
  })
  readonly image?: string;
}
