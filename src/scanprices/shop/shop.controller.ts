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

@Controller('/scanprices/shops')
export class ShopController {
  constructor(private shopService: ShopService) {}

  @Get()
  getAll() {
    return this.shopService.getAll();
  }

  @Get(':id')
  getById(@Param('id') id: ObjectId) {
    return this.shopService.getById(id);
  }

  @Put(':id')
  update(@Param('id') id: ObjectId, @Body() dto: CreateShopDto) {
    return this.shopService.update(id, dto);
  }

  @Post()
  create(@Body() dto: CreateShopDto) {
    return this.shopService.create(dto);
  }

  @Delete(':id')
  delete(@Param('id') id: ObjectId) {
    return this.shopService.delete(id);
  }
}
