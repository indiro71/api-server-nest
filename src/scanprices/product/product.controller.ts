import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
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

  @Get(':id')
  getById(@Param('id') id: ObjectId) {
    return this.productService.getInfoByProductId(id);
  }

  @Post('/add')
  create(@Body() dto: CreateProductDto) {
    return this.productService.create(dto);
  }

  @Delete('/delete/:id')
  delete() {}
}
