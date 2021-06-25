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
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { SubscribeService } from './subscribe.service';
import { ObjectId } from 'mongoose';
import { Subscribe } from './schemas/subscribe.schema';
import { CreateSubscribeDto } from './dto/create-subscribe.dto';
@ApiTags('Subscribes')
@Controller('/scanprices/subscribe')
export class SubscribeController {
  constructor(private subscribeService: SubscribeService) {}

  @ApiOperation({ summary: 'Subscribe on price alert' })
  @ApiResponse({ status: 200 })
  @UseGuards(JwtAuthGuard)
  @Post('/')
  subscribe(@Body() subscribeDto: CreateSubscribeDto, @Req() request) {
    return this.subscribeService.subscribe(subscribeDto, request.user._id);
  }

  @ApiOperation({ summary: 'Unsubscribe on price alert' })
  @ApiResponse({ status: 200 })
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  unsubscribe(@Param('id') productId: ObjectId, @Req() request) {
    return this.subscribeService.unsubscribe(productId, request.user._id);
  }

  @ApiOperation({ summary: 'Get subscribed price by id' })
  @ApiResponse({ status: 200, type: Subscribe })
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  getById(@Param('id') id: ObjectId, @Req() request) {
    return this.subscribeService.getSubscribeById(id, request.user._id);
  }
}
