import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ObjectId } from 'mongoose';
import { CreateShopDto } from './dto/create-shop.dto';
import { Shop, ShopDocument } from './schemas/shop.schema';

@Injectable()
export class ShopService {
  constructor(@InjectModel(Shop.name) private shopModel: Model<ShopDocument>) {}

  async getAll(): Promise<Shop[]> {
    const shops = await this.shopModel.find();
    return shops;
  }

  async getById(id: ObjectId): Promise<Shop> {
    const shop = await this.shopModel.findById(id);
    return shop;
  }

  async update(id: ObjectId, dto: CreateShopDto): Promise<Shop> {
    const { tagPrices: stringPrice } = dto;
    const tagPrices = stringPrice.split(',');
    const shop = await this.shopModel.findByIdAndUpdate(id, {
      ...dto,
      tagPrices,
    });
    return shop;
  }

  async create(dto: CreateShopDto): Promise<Shop> {
    const { tagPrices: stringPrice } = dto;
    const tagPrices = stringPrice.split(',');
    const newShop = await this.shopModel.create({ ...dto, tagPrices });
    return newShop;
  }

  async delete(id: ObjectId): Promise<Shop> {
    const deletedShop = await this.shopModel.findByIdAndDelete(id);
    return deletedShop;
  }
}
