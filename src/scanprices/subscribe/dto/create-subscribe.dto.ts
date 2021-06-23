import { ApiProperty } from '@nestjs/swagger';

export class CreateSubscribeDto {
  @ApiProperty({ example: 15000, description: 'Subscribed price' })
  readonly price: number;
}
