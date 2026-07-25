import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Pair, PairSchema } from './schemas/pair.schema';
import { PairController } from './pair.controller';
import { PairService } from './pair.service';
import { Order, OrderSchema } from '../order/schemas/order.schema';
import { PairGateway } from './pair.gateway';

@Module({
  controllers: [PairController],
  providers: [PairService, PairGateway],
  imports: [
    MongooseModule.forFeature([{ name: Pair.name, schema: PairSchema }]),
    MongooseModule.forFeature([{ name: Order.name, schema: OrderSchema }]),
  ],
  exports: [PairService, PairGateway],
})
export class PairModule {}
