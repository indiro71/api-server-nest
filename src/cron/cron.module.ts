import { Module } from '@nestjs/common';
import { CronService } from './cron.service';
import { ParserModule } from '../parser/parser.module';
import { ProductModule } from '../scanprices/product/product.module';
import { ShopModule } from '../scanprices/shop/shop.module';
import { PriceModule } from '../scanprices/price/price.module';
import { SubscribeModule } from '../scanprices/subscribe/subscribe.module';
import { FootballModule } from '../football/football.module';

@Module({
  providers: [CronService],
  imports: [
    ParserModule,
    ProductModule,
    ShopModule,
    PriceModule,
    SubscribeModule,
    FootballModule,
  ],
})
export class CronModule {}
