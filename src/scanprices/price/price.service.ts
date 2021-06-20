import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ObjectId } from 'mongoose';
import { Price, PriceDocument } from './schemas/price.schema';

@Injectable()
export class PriceService {
  constructor(
    @InjectModel(Price.name) private priceModel: Model<PriceDocument>,
  ) {}

  async getProductPrices(id: ObjectId): Promise<Price[]> {
    const prices = await this.priceModel.find().where('good').equals(id);
    return prices;
  }
}
