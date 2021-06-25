import { Module } from '@nestjs/common';
import { PriceModule } from './price/price.module';
import { ProductModule } from './product/product.module';
import { ShopModule } from './shop/shop.module';
import { SubscribeModule } from './subscribe/subscribe.module';

@Module({
  imports: [ProductModule, PriceModule, ShopModule, SubscribeModule],
  exports: [ProductModule, PriceModule, ShopModule, SubscribeModule],
})
export class ScanpricesModule {}
