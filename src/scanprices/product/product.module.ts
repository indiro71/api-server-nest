import { Module } from '@nestjs/common';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Product, ProductSchema } from './schemas/product.schema';
import { PriceModule } from '../price/price.module';
import { Price, PriceSchema } from '../price/schemas/price.schema';
import { ParserModule } from '../../parser/parser.module';
import { ShopModule } from '../shop/shop.module';
import { AuthModule } from '../../auth/auth.module';
import { RoleModule } from '../../role/role.module';
import { StorageModule } from '../../services/storage/storage.module';
import { SubscribeModule } from '../subscribe/subscribe.module';
import { LoggerModule } from '../../services/logger/logger.module';

@Module({
  controllers: [ProductController],
  providers: [ProductService],
  imports: [
    MongooseModule.forFeature([{ name: Product.name, schema: ProductSchema }]),
    MongooseModule.forFeature([{ name: Price.name, schema: PriceSchema }]),
    PriceModule,
    ParserModule,
    ShopModule,
    AuthModule,
    RoleModule,
    StorageModule,
    SubscribeModule,
    LoggerModule
  ],
  exports: [ProductService],
})
export class ProductModule {}
