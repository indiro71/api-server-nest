import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ObjectId } from 'mongoose';
import { Price, PriceDocument } from './schemas/price.schema';
import { CreatePriceDto } from './dto/create-price.dto';

@Injectable()
export class PriceService {
  constructor(
    @InjectModel(Price.name) private priceModel: Model<PriceDocument>,
  ) {}

  async getProductPrices(id: ObjectId): Promise<Price[]> {
    const prices = await this.priceModel.find().where('product').equals(id);
    return prices;
  }

  async create(priceDto: CreatePriceDto): Promise<Price> {
    const newPrice = await this.priceModel.create({ ...priceDto });
    return newPrice;
  }

  async deleteForProduct(product) {
    await this.priceModel.deleteMany({ product });
  }
}
