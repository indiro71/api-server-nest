import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Pair, PairSchema } from './schemas/pair.schema';
import { PairController } from './pair.controller';
import { PairService } from './pair.service';
import { Order, OrderSchema } from '../order/schemas/order.schema';

@Module({
  controllers: [PairController],
  providers: [PairService],
  imports: [
    MongooseModule.forFeature([{ name: Pair.name, schema: PairSchema }]),
    MongooseModule.forFeature([{ name: Order.name, schema: OrderSchema }]),
  ],
  exports: [PairService],
})
export class PairModule {}
