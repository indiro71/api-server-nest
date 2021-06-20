import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type ShopDocument = Shop & Document;

@Schema()
export class Shop {
  @ApiProperty({ example: 'ozon.ru', description: 'Shop name' })
  @Prop({
    required: true,
  })
  name: string;

  @ApiProperty({ example: 'https://ozon.ru', description: 'Shop url' })
  @Prop({
    required: true,
  })
  url: string;

  @ApiProperty({
    example: '.price, .alert-price, .action-price',
    description: 'Shop price tags',
  })
  @Prop({
    required: true,
  })
  tagPrices: Array<string>;

  @ApiProperty({
    example: '.available',
    description: 'Product available tag for this shop',
    required: false,
  })
  @Prop()
  tagAvailable: string;

  @ApiProperty({
    example: '.preview-image',
    description: 'Product image tag for this shop',
    required: false,
  })
  @Prop()
  tagImage: string;

  @ApiProperty({
    example: 'p',
    description: 'Element in price on this shop',
    required: false,
  })
  @Prop()
  elementPrice: string;

  @ApiProperty({
    example: 'h1',
    description: 'Product name tag for this shop',
    required: false,
  })
  @Prop()
  tagName: string;

  @ApiProperty({
    example: 'POST',
    description: 'Request method for this shop',
    default: 'GET',
    required: false,
  })
  @Prop({
    default: 'GET',
  })
  methodRequest: string;

  @ApiProperty({
    example: '1624216164414',
    description: 'Date added shop',
    default: Date.now(),
    required: false,
  })
  @Prop({
    default: Date.now,
  })
  date: Date;
}

export const ShopSchema = SchemaFactory.createForClass(Shop);
