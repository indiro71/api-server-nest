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
import { CurrencyService } from './currency.service';
import { CreateCurrencyDto } from './dto/create-currency.dto';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Currency } from './schemas/currency.schema';

@ApiTags('Currency')
@Controller('/scanprices/currencys')
export class CurrencyController {
  constructor(private currencyService: CurrencyService) {}

  @ApiOperation({ summary: 'Get all currencys' })
  @ApiResponse({ status: 200, type: [Currency] })
  @Get()
  getAll() {
    return this.currencyService.getAll();
  }

  @ApiOperation({ summary: 'Get currency by id' })
  @ApiResponse({ status: 200, type: Currency })
  @Get(':id')
  getById(@Param('id') id: ObjectId) {
    return this.currencyService.getById(id);
  }

  // @ApiOperation({ summary: 'Update currency by id' })
  // @ApiResponse({ status: 200, type: Currency })
  // @Put(':id')
  // update(@Param('id') id: ObjectId, @Body() dto: CreateCurrencyDto) {
  //   return this.currencyService.update(id, dto);
  // }

  @ApiOperation({ summary: 'Create new currency' })
  @ApiResponse({ status: 200, type: Currency })
  @Post()
  create(@Body() dto: CreateCurrencyDto) {
    return this.currencyService.create(dto);
  }

  @ApiOperation({ summary: 'Delete currency by id' })
  @ApiResponse({ status: 200, type: Currency })
  @Delete(':id')
  delete(@Param('id') id: ObjectId) {
    return this.currencyService.delete(id);
  }
}
