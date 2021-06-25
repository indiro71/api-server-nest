import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ParserService } from '../parser/parser.service';
import { ProductService } from '../scanprices/product/product.service';
import { ShopService } from '../scanprices/shop/shop.service';
import { PriceService } from '../scanprices/price/price.service';

@Injectable()
export class CronService {
  constructor(
    private parserService: ParserService,
    private productService: ProductService,
    private shopService: ShopService,
    private priceService: PriceService,
  ) {}

  @Cron('0 * * * *')
  async scanpricesCron() {
    const dbGoods = await this.productService.getAll();
    if (dbGoods) {
      for (const dbGood of dbGoods) {
        const productUrl = dbGood.url;
        const shop = await this.shopService.getShopByProductUrl(productUrl);

        if (shop) {
          try {
            const content = await this.parserService.getPageContent(productUrl);
            if (!content) continue;

            const good = this.productService.parseProductData(
              content,
              shop,
              productUrl,
            );

            if (good) {
              if (
                good.currentPrice !== dbGood.currentPrice &&
                good.currentPrice !== 0
              ) {
                if (good.available) {
                  if (good.currentPrice < dbGood.currentPrice) {
                    // await checkSubscribes(dbGood, good.currentPrice);
                  }
                  dbGood.currentPrice = good.currentPrice;
                }

                dbGood.dateUpdate = Date.now();
                dbGood.available = good.available;

                if (good.currentPrice !== 0) {
                  await this.priceService.create({
                    price: good.currentPrice,
                    good: dbGood._id,
                  });

                  if (good.currentPrice < dbGood.minPrice) {
                    dbGood.minPrice = good.currentPrice;
                  }

                  if (good.currentPrice > dbGood.maxPrice) {
                    dbGood.maxPrice = good.currentPrice;
                  }
                }
                await this.productService.update(dbGood);
              }
            }
          } catch (e) {
            console.log(e);
          }
          await this.parserService.closeBrowser();
        }
      }
      await this.parserService.closeBrowser();
    }
  }
}
