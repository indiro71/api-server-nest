import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ObjectId } from 'mongoose';
import { Page } from 'puppeteer';
import { load } from 'cheerio';
import { Product, ProductDocument } from './schemas/product.schema';
import { CreateProductDto } from './dto/create-product.dto';
import { PriceService } from '../price/price.service';
import { Price, PriceDocument } from '../price/schemas/price.schema';
import { ParserService } from '../../parser/parser.service';
import { ShopService } from '../shop/shop.service';
import { RoleService } from '../../role/role.service';
import { StorageService } from '../../services/storage/storage.service';

@Injectable()
export class ProductService {
  private browserPage: Page;
  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(Price.name) private priceModel: Model<PriceDocument>,
    private priceService: PriceService,
    private parserService: ParserService,
    private shopService: ShopService,
    private roleService: RoleService,
    private storageService: StorageService,
  ) {
    this.browserPage = null;
  }

  async getAll(): Promise<Product[]> {
    const products = await this.productModel
      .find()
      .populate('shop', 'name')
      .select('name currentPrice url image');
    return products;
  }

  async create(productDto: CreateProductDto, user): Promise<Product> {
    const candidate = await this.productModel.findOne().where({name: productDto.name});
    if (candidate) {
      throw new HttpException('Product already exists', HttpStatus.BAD_REQUEST);
    }
    let image;
    if (productDto.image && productDto.image !== '') {
      await this.storageService.uploadFile(productDto.image);
      image = productDto.image.split('/').pop();
    }
    const product = await this.productModel.create({
      ...productDto,
      image,
      user,
    });
    return product;
  }

  async getById(id: ObjectId): Promise<Product> {
    const product = await this.productModel
      .findById(id)
      .populate('shop', 'name');
    if (!product) {
      throw new HttpException('Product not found', HttpStatus.NOT_FOUND);
    }
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
    const products = await this.productModel
      .find()
      .populate('shop', 'name')
      .sort({ dateCreate: -1 })
      .limit(5);
    return products;
  }

  async getLastUpdatedProducts() {
    const products = await this.productModel
      .find()
      .sort({ dateUpdate: -1 })
      .limit(10);
    const prices = {};
    for (const product of products) {
      prices[product._id] = await this.priceModel
        .find()
        .where('product')
        .equals(product.id)
        .sort({ date: -1 })
        .limit(2);
    }

    return {
      products,
      prices,
    };
  }

  async scan(productUrl: string) {
    if (!productUrl) {
      throw new HttpException('Url exist', HttpStatus.BAD_REQUEST);
    }

    const shop = await this.shopService.getShopByProductUrl(productUrl);
    if (!shop) {
      throw new HttpException('Shop not found', HttpStatus.BAD_REQUEST);
    }

    if (!this.browserPage || this.browserPage.isClosed()) {
      this.browserPage = await this.parserService.createPage();
    }
    const content = await this.parserService.getPageContent(
      productUrl,
      this.browserPage,
    );
    const data = this.parseProductData(content, shop, productUrl);

    if (!data) {
      await this.parserService.closeBrowser();
      throw new HttpException('Error scan', HttpStatus.BAD_REQUEST);
    }

    await this.browserPage.close();

    return data;
  }

  parseProductData(content, shop, url: string) {
    try {
      const $ = load(content);

      const prices = shop.tagPrices
        .map((price) => {
          if ($(price).text()) {
            if (shop.elementPrice) {
              if ($(price).text().indexOf(shop.elementPrice) !== -1) {
                const clearPrice = $(price)
                  .text()
                  .replace(/\s/g, '')
                  .match(/\d+/);
                return parseInt(clearPrice.toString());
              }
              return null;
            }
            const clearPrice = $(price).text().replace(/\s/g, '').match(/\d+/);
            return parseInt(clearPrice.toString());
          }
        })
        .filter(function (x) {
          return x !== undefined && x !== null;
        });

      const name = $(shop.tagName).text().replace(/\r?\n/g, '').trim();
      const imageTag = 'meta[property="' + shop.tagImage + '"]';
      let image = $(imageTag).attr('content');
      if (image) {
        image = image.replace(/\r?\n/g, '');
      }

      if (name) {
        const product = {
          name,
          url: url,
          shop: shop._id,
          image,
          available: prices.length > 0,
          currentPrice: prices.length > 0 ? Math.min.apply(null, prices) : 0,
          minPrice: prices.length > 0 ? Math.min.apply(null, prices) : 0,
          maxPrice: prices.length > 0 ? Math.min.apply(null, prices) : 0,
        };
        return product;
      }
      return null;
    } catch (e) {
      console.log(e);
    }
  }

  async delete(id, user) {
    const product = await this.productModel.findById(id);
    const role = await this.roleService.getRoleById(user.role);
    if (role.value === 'ADMIN' || user?._id === product?.user?.toString()) {
      await product.delete();
    }
    return product;
  }

  async update(product) {
    const updateProduct = await this.productModel.findByIdAndUpdate(
      product._id,
      product,
    );
    console.log(updateProduct, product);
    return updateProduct;
  }
}
