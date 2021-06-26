import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
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
    if (!shop) {
      throw new HttpException('Product not found', HttpStatus.NOT_FOUND);
    }
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

  async getShopByProductUrl(productUrl: string) {
    const shops = await this.getAll();

    const productShop = shops.filter((shop) => {
      return productUrl.indexOf(shop.url) !== -1;
    });

    if (productShop[0]) return productShop[0];
    return null;
  }
}
