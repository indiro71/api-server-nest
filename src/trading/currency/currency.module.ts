import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Currency, CurrencySchema } from './schemas/currency.schema';
import { CurrencyController } from './currency.controller';
import { CurrencyService } from './currency.service';
import { Order, OrderSchema } from '../order/schemas/order.schema';

@Module({
  controllers: [CurrencyController],
  providers: [CurrencyService],
  imports: [
    MongooseModule.forFeature([{ name: Currency.name, schema: CurrencySchema }]),
    MongooseModule.forFeature([{ name: Order.name, schema: OrderSchema }]),
  ],
  exports: [CurrencyService],
})
export class CurrencyModule {}
