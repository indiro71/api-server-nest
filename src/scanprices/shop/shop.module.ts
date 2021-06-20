import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Shop, ShopSchema } from './schemas/shop.schema';
import { ShopController } from './shop.controller';
import { ShopService } from './shop.service';

@Module({
  controllers: [ShopController],
  providers: [ShopService],
  imports: [
    MongooseModule.forFeature([{ name: Shop.name, schema: ShopSchema }]),
  ],
})
export class ShopModule {}
