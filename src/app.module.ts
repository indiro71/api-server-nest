import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProductModule } from './scanprices/product/product.module';
import { ConfigModule } from '@nestjs/config';
import { UserModule } from './user/user.module';
import { PriceModule } from './scanprices/price/price.module';
import { ShopModule } from './scanprices/shop/shop.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: `.${process.env.NODE_ENV}.env`,
    }),
    MongooseModule.forRoot(process.env.MONGODB_URI),
    ProductModule,
    UserModule,
    PriceModule,
    ShopModule,
  ],
})
export class AppModule {}
