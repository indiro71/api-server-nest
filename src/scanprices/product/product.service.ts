import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ObjectId } from 'mongoose';
import { Product, ProductDocument } from './schemas/product.schema';
import { CreateProductDto } from './dto/create-product.dto';
import { PriceService } from '../price/price.service';
import { Price, PriceDocument } from '../price/schemas/price.schema';

@Injectable()
export class ProductService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(Price.name) private priceModel: Model<PriceDocument>,
    private priceService: PriceService,
  ) {}

  async getAll(): Promise<Product[]> {
    const products = await this.productModel.find().populate('shop', 'name').select('name currentPrice url image');
    return products;
  }

  async create(dto: CreateProductDto): Promise<Product> {
    const product = await this.productModel.create({ ...dto });
    return product;
  }

  async getById(id: ObjectId): Promise<Product> {
    const product = await this.productModel
      .findById(id)
      .populate('shop', 'name');
    return product;
  }

  async getInfoByProductId(id: ObjectId): Promise<any> {
    const params = await this.getById(id);
    const prices = await this.priceService.getProductPrices(id);
    return {
      params,
      prices,
    };
  }

  async getLastAddedProducts(): Promise<Product[]> {
    const products = await this.productModel.find().populate('shop', 'name').sort({ dateCreate: -1 }).limit(5);
    return products;
  }

  async getLastUpdatedProducts() {
    const products = await this.productModel.find().sort({ dateUpdate: -1 }).limit(10);
    const prices = {};
    for (const product of products) {
      prices[product._id] = await this.priceModel.find().where('good').equals(product.id).sort({ date: -1 }).limit(2);
    }

    return {
      products,
      prices
    }
  }
}
