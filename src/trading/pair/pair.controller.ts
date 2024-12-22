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
import { PairService } from './pair.service';
import { CreatePairDto } from './dto/create-pair.dto';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Pair } from './schemas/pair.schema';

@ApiTags('Pair')
@Controller('/scanprices/pairs')
export class PairController {
  constructor(private pairService: PairService) {}

  @ApiOperation({ summary: 'Get all pairs' })
  @ApiResponse({ status: 200, type: [Pair] })
  @Get()
  getAll() {
    return this.pairService.getAll();
  }

  @ApiOperation({ summary: 'Get pair by id' })
  @ApiResponse({ status: 200, type: Pair })
  @Get(':id')
  getById(@Param('id') id: ObjectId) {
    return this.pairService.getById(id);
  }

  @ApiOperation({ summary: 'Update pair by id' })
  @ApiResponse({ status: 200, type: Pair })
  @Put(':id')
  update(@Param('id') id: ObjectId, @Body() dto: CreatePairDto) {
    return this.pairService.update(id, dto);
  }

  @ApiOperation({ summary: 'Create new pair' })
  @ApiResponse({ status: 200, type: Pair })
  @Post()
  create(@Body() dto: CreatePairDto) {
    return this.pairService.create(dto);
  }

  @ApiOperation({ summary: 'Delete pair by id' })
  @ApiResponse({ status: 200, type: Pair })
  @Delete(':id')
  delete(@Param('id') id: ObjectId) {
    return this.pairService.delete(id);
  }
}
