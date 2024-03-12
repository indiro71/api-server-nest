import { ApiProperty } from '@nestjs/swagger';
import { Currency } from '../../currency/schemas/currency.schema';

export class CreateOrderDto {
  _id?: any;

  @ApiProperty({ example: 'ed412343', description: 'Currency id' })
  readonly currency: Currency;

  @ApiProperty({ example: 100, description: 'Quantity buy currency' })
  readonly quantity: number;

  @ApiProperty({ example: 0.14, description: 'Buy price currency' })
  readonly buyPrice: number;

  @ApiProperty({ example: 0.14, description: 'Current price currency' })
  readonly currencyPrice: number;

  @ApiProperty({ example: "Json buy string", description: 'Buy Result' })
  readonly buyResult?: string;

  @ApiProperty({ example: "Json sell string", description: 'Sell Result' })
  readonly sellResult?: string;
}
