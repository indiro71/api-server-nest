import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ObjectId } from 'mongoose';
import { ShopService } from './shop.service';
import { CreateShopDto } from './dto/create-shop.dto';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Shop } from './schemas/shop.schema';

@ApiTags('Shop')
@Controller('/scanprices/shops')
export class ShopController {
  constructor(private shopService: ShopService) {}

  @ApiOperation({ summary: 'Get all shops' })
  @ApiResponse({ status: 200, type: [Shop] })
  @Get()
  getAll() {
    return this.shopService.getAll();
  }

  @ApiOperation({ summary: 'Get shop by id' })
  @ApiResponse({ status: 200, type: Shop })
  @Get(':id')
  getById(@Param('id') id: ObjectId) {
    return this.shopService.getById(id);
  }

  @ApiOperation({ summary: 'Update shop by id' })
  @ApiResponse({ status: 200, type: Shop })
  @Put(':id')
  update(@Param('id') id: ObjectId, @Body() dto: CreateShopDto) {
    return this.shopService.update(id, dto);
  }

  @ApiOperation({ summary: 'Create new shop' })
  @ApiResponse({ status: 200, type: Shop })
  @Post()
  create(@Body() dto: CreateShopDto) {
    return this.shopService.create(dto);
  }

  @ApiOperation({ summary: 'Delete shop by id' })
  @ApiResponse({ status: 200, type: Shop })
  @Delete(':id')
  delete(@Param('id') id: ObjectId) {
    return this.shopService.delete(id);
  }
}
