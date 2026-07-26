import { ApiProperty } from '@nestjs/swagger';

class PushSubscriptionKeysDto {
  @ApiProperty()
  readonly auth: string;

  @ApiProperty()
  readonly p256dh: string;
}

export class PushSubscriptionDto {
  @ApiProperty()
  readonly endpoint: string;

  @ApiProperty()
  readonly keys: PushSubscriptionKeysDto;
}
