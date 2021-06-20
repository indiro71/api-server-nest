import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { ObjectId } from 'mongoose';

@Controller('/scanprices/products')
export class ProductController {
  constructor(private productService: ProductService) {}
  @Get()
  getAll() {
    return this.productService.getAll();
  }

  @Post('/add')
  create(@Body() dto: CreateProductDto) {
    return this.productService.create(dto);
  }

  @Get('/lastadded')
  getLastAddedProducts() {
    return this.productService.getLastAddedProducts();
  }

  @Get('/lastupdated')
  getLastUpdatedProducts() {
    return this.productService.getLastUpdatedProducts();
  }

  @Get(':id')
  getById(@Param('id') id: ObjectId) {
    return this.productService.getInfoByProductId(id);
  }
}
