import { HttpModule, Module } from '@nestjs/common';
import { CurrencyModule } from './currency/currency.module';
import { OrderModule } from './order/order.module';
import { MxcService } from '../services/mxc/mxc.service';
import { TradingService } from './trading.service';
import { TelegramService } from '../services/telegram/telegram.service';

@Module({
  imports: [CurrencyModule, OrderModule, HttpModule],
  providers: [MxcService, TradingService, TelegramService],
  exports: [CurrencyModule, OrderModule, TradingService],
})
export class TradingModule {}
