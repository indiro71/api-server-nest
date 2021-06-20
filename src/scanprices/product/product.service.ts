import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ObjectId } from 'mongoose';
import { Product, ProductDocument } from './schemas/product.schema';
import { CreateProductDto } from './dto/create-product.dto';
import { PriceService } from '../price/price.service';

@Injectable()
export class ProductService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    private priceService: PriceService,
  ) {}

  async getAll(): Promise<Product[]> {
    const products = await this.productModel.find();
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

  async delete() {}
}
