import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { LoggerService } from "nest-logger";
import { Page } from 'puppeteer';
import { ParserService } from '../parser/parser.service';
import { ProductService } from '../scanprices/product/product.service';
import { ShopService } from '../scanprices/shop/shop.service';
import { PriceService } from '../scanprices/price/price.service';
import { SubscribeService } from '../scanprices/subscribe/subscribe.service';

@Injectable()
export class CronService {
  private scanpricesPage: Page;
  constructor(
    private parserService: ParserService,
    private productService: ProductService,
    private shopService: ShopService,
    private priceService: PriceService,
    private subscribeService: SubscribeService,
    private logger: LoggerService
  ) {
    this.scanpricesPage = null;
  }

  @Cron('0 * * * *')
  async scanpricesCron() {
    this.logger.info('ScanpricesCron was started');
    const dbProducts = await this.productService.getAll();
    try {
      if (dbProducts) {
        if (!this.scanpricesPage || this.scanpricesPage.isClosed()) {
          this.scanpricesPage = await this.parserService.createPage();
        }
        for (const dbProduct of dbProducts) {
          const productUrl = dbProduct.url;
          const shop = await this.shopService.getShopByProductUrl(productUrl);

          if (shop) {
            try {
              const content = await this.parserService.getPageContent(
                  productUrl,
                  this.scanpricesPage,
              );
              if (!content) continue;

              const product = this.productService.parseProductData(
                  content,
                  shop,
                  productUrl,
              );

              if (product) {
                if (
                    product.currentPrice !== dbProduct.currentPrice &&
                    product.currentPrice !== 0
                ) {
                  if (product.available) {
                    // if (product.currentPrice < dbProduct.currentPrice) {
                    //   await this.subscribeService.checkSubscribes(
                    //     dbProduct,
                    //     product.currentPrice,
                    //   );
                    // }
                    dbProduct.currentPrice = product.currentPrice;
                  }

                  dbProduct.dateUpdate = Date.now();
                  dbProduct.available = product.available;

                  if (product.currentPrice !== 0) {
                    await this.priceService.create({
                      price: product.currentPrice,
                      product: dbProduct._id,
                    });

                    if (product.currentPrice < dbProduct.minPrice) {
                      dbProduct.minPrice = product.currentPrice;
                    }

                    if (product.currentPrice > dbProduct.maxPrice) {
                      dbProduct.maxPrice = product.currentPrice;
                    }
                  }
                  await this.productService.update(dbProduct);
                }
              }
            } catch (e) {
              this.logger.error('ScanpricesCron error', e.message);
            }
          }
        }

      }
    } catch (e) {
      this.logger.error('ScanpricesCron error', e.message);
    } finally {
      await this.scanpricesPage.close();
      await this.parserService.closeBrowser();
    }
    this.logger.info('ScanpricesCron was ended');
  }
}
