import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { ObjectId } from 'mongoose';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Product } from './schemas/product.schema';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

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
  @UseGuards(JwtAuthGuard)
  @Post('/add')
  create(
    @Body()
    {
      product: productDto,
      alertPrice,
    }: {
      product: CreateProductDto;
      alertPrice: number;
    },
    @Req() request,
  ) {
    return this.productService.create(productDto, request.user._id, alertPrice);
  }

  @ApiOperation({ summary: 'Scan product' })
  @ApiResponse({ status: 200 })
  @UseGuards(JwtAuthGuard)
  @Post('/scan')
  scan(@Body() { url }) {
    return this.productService.scan(url);
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

  @ApiOperation({ summary: 'Delete product by id' })
  @ApiResponse({ status: 200, type: Product })
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  delete(@Param('id') id: ObjectId, @Req() request) {
    return this.productService.delete(id, request.user);
  }
}
