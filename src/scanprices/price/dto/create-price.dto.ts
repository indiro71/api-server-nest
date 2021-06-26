import { ApiProperty } from '@nestjs/swagger';
import { ObjectId } from 'mongoose';

export class CreatePriceDto {
  @ApiProperty({ example: 15000, description: 'Product price' })
  readonly price: number;

  @ApiProperty({ example: 'ed412343', description: 'Product id' })
  readonly product: ObjectId;
}
