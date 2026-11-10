import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Pair, PairSchema } from './schemas/pair.schema';
import { PairController } from './pair.controller';
import { PairService } from './pair.service';
import { Order, OrderSchema } from '../order/schemas/order.schema';
import { AuthModule } from '../../auth/auth.module';
import { BybitModule } from '../../services/bybit/bybit.module';
import { TelegramModule } from '../../services/telegram/telegram.module';
import { PushModule } from '../../push/push.module';
import { InsuranceService } from './insurance/insurance.service';
import {
  INSURANCE_MODEL,
  InsuranceLockSchema,
  InsuranceSchema,
  LOCK_MODEL,
} from './insurance/insurance.schema';

@Module({
  controllers: [PairController],
  providers: [PairService, InsuranceService],
  imports: [
    MongooseModule.forFeature([{ name: Pair.name, schema: PairSchema }]),
    MongooseModule.forFeature([{ name: Order.name, schema: OrderSchema }]),
    MongooseModule.forFeature([
      { name: INSURANCE_MODEL, schema: InsuranceSchema },
      { name: LOCK_MODEL, schema: InsuranceLockSchema },
    ]),
    AuthModule,
    BybitModule,
    TelegramModule,
    PushModule,
  ],
  exports: [PairService, InsuranceService],
})
export class PairModule {}
