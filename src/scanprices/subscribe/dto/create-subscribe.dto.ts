import { ApiProperty } from '@nestjs/swagger';
import { ObjectId } from 'mongoose';

export class CreateSubscribeDto {
  @ApiProperty({ example: 15000, description: 'Subscribed price' })
  readonly price: number;

  @ApiProperty({ example: 'ed412343', description: 'User id' })
  readonly good: ObjectId;
}
