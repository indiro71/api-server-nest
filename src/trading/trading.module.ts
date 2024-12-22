import { HttpModule, Module } from '@nestjs/common';
import { CurrencyModule } from './currency/currency.module';
import { PairModule } from './pair/pair.module';
import { OrderModule } from './order/order.module';
import { MxcService } from '../services/mxc/mxc.service';
import { TradingService } from './trading.service';
import { ServicesModule } from '../services/services.module';

@Module({
  imports: [PairModule, CurrencyModule, OrderModule, HttpModule, ServicesModule],
  providers: [MxcService, TradingService],
  exports: [PairModule, CurrencyModule, OrderModule, TradingService],
})
export class TradingModule {}
