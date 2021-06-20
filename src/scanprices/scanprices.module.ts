import { Module } from '@nestjs/common';
import { PriceModule } from './price/price.module';
import { ProductModule } from './product/product.module';
import { ShopModule } from './shop/shop.module';

@Module({
  imports: [ProductModule, PriceModule, ShopModule],
})
export class ScanpricesModule {}
