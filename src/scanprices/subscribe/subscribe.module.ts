import { Module } from '@nestjs/common';
import { SubscribeService } from './subscribe.service';
import { SubscribeController } from './subscribe.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Subscribe, SubscribeSchema } from './schemas/subscribe.schema';
import { AuthModule } from '../../auth/auth.module';
import { UserModule } from '../../user/user.module';

@Module({
  providers: [SubscribeService],
  controllers: [SubscribeController],
  imports: [
    MongooseModule.forFeature([
      { name: Subscribe.name, schema: SubscribeSchema },
    ]),
    AuthModule,
    UserModule,
  ],
  exports: [SubscribeService],
})
export class SubscribeModule {}
