import { ApiProperty } from '@nestjs/swagger';

class PushSubscriptionKeysDto {
  @ApiProperty()
  readonly auth: string;

  @ApiProperty()
  readonly p256dh: string;
}

export class PushSubscriptionDto {
  @ApiProperty({ required: false })
  readonly appUrl?: string;

  @ApiProperty()
  readonly endpoint: string;

  @ApiProperty()
  readonly keys: PushSubscriptionKeysDto;
}
