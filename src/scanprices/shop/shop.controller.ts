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
  constructor(private shopServece: ShopService) {}

  @Get()
  getAll() {
    return this.shopServece.getAll();
  }

  @Get(':id')
  getById(@Param('id') id: ObjectId) {
    return this.shopServece.getById(id);
  }

  @Put(':id')
  update(@Param('id') id: ObjectId, @Body() dto: CreateShopDto) {
    return this.shopServece.update(id, dto);
  }

  @Post()
  create(@Body() dto: CreateShopDto) {
    return this.shopServece.create(dto);
  }

  @Delete(':id')
  delete(@Param('id') id: ObjectId) {
    return this.shopServece.delete(id);
  }
}
