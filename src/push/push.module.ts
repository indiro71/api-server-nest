import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { ErrorLogModule } from '../error-log/error-log.module';
import { PushController } from './push.controller';
import { PushService } from './push.service';
import {
  PushSubscriptionEntity,
  PushSubscriptionSchema,
} from './schemas/push-subscription.schema';

@Module({
  controllers: [PushController],
  imports: [
    MongooseModule.forFeature([
      { name: PushSubscriptionEntity.name, schema: PushSubscriptionSchema },
    ]),
    AuthModule,
    ErrorLogModule,
  ],
  providers: [PushService],
  exports: [PushService],
})
export class PushModule {}
