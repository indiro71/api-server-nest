import { ApiProperty } from '@nestjs/swagger';

export class CreateShopDto {
  @ApiProperty({ example: 'ozon.ru', description: 'Shop name' })
  readonly name: string;

  @ApiProperty({ example: 'https://ozon.ru', description: 'Shop url' })
  readonly url: string;

  @ApiProperty({
    example: '.price, .alert-price, .action-price',
    description: 'Shop price tags',
  })
  readonly tagPrices: string;

  @ApiProperty({
    example: '.available',
    description: 'Product available tag for this shop',
    required: false,
  })
  readonly tagAvailable?: string;

  @ApiProperty({
    example: '.preview-image',
    description: 'Product image tag for this shop',
    required: false,
  })
  readonly tagImage?: string;

  @ApiProperty({
    example: 'p',
    description: 'Element in price on this shop',
    required: false,
  })
  readonly elementPrice?: string;

  @ApiProperty({
    example: 'h1',
    description: 'Product name tag for this shop',
    required: false,
  })
  readonly tagName?: string;

  @ApiProperty({
    example: 'POST',
    description: 'Request method for this shop',
    default: 'GET',
    required: false,
  })
  readonly methodRequest?: string;
}
