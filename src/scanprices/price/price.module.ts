import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PriceService } from './price.service';
import { Price, PriceSchema } from './schemas/price.schema';

@Module({
  providers: [PriceService],
  imports: [
    MongooseModule.forFeature([{ name: Price.name, schema: PriceSchema }]),
  ],
  exports: [PriceService],
})
export class PriceModule {}
