import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { ObjectId } from 'mongoose';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Product } from './schemas/product.schema';

@ApiTags('Product')
@Controller('/scanprices/products')
export class ProductController {
  constructor(private productService: ProductService) {}

  @ApiOperation({ summary: 'Get all products' })
  @ApiResponse({ status: 200, type: [Product] })
  @Get()
  getAll() {
    return this.productService.getAll();
  }

  @ApiOperation({ summary: 'Add product' })
  @ApiResponse({ status: 200, type: Product })
  @Post('/add')
  create(@Body() dto: CreateProductDto) {
    return this.productService.create(dto);
  }

  @ApiOperation({ summary: 'Last added products' })
  @ApiResponse({ status: 200, type: [Product] })
  @Get('/lastadded')
  getLastAddedProducts() {
    return this.productService.getLastAddedProducts();
  }

  @ApiOperation({ summary: 'Last updated products' })
  @ApiResponse({ status: 200, type: [Product] })
  @Get('/lastupdated')
  getLastUpdatedProducts() {
    return this.productService.getLastUpdatedProducts();
  }

  @ApiOperation({ summary: 'Get product by id' })
  @ApiResponse({ status: 200, type: Product })
  @Get(':id')
  getById(@Param('id') id: ObjectId) {
    return this.productService.getInfoByProductId(id);
  }
}
