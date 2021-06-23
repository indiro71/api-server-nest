import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { SubscribeService } from './subscribe.service';

@Controller('/scanprices/subscribe')
export class SubscribeController {
  constructor(private subscribeService: SubscribeService) {
  }

  @ApiOperation({ summary: 'Subscribe on price alert' })
  @ApiResponse({ status: 200 })
  @UseGuards(JwtAuthGuard)
  @Post('/')
  subscribe(@Body() { price, productId }, @Req() request) {
    return this.subscribeService.subscribe(price, productId, request.user._id);
  }

  @ApiOperation({ summary: 'Unsubscribe on price alert' })
  @ApiResponse({ status: 200 })
  @UseGuards(JwtAuthGuard)
  @Post('/unsubscribe')
  unsubscribe(@Body() { productId }, @Req() request) {
    return this.subscribeService.unsubscribe(productId, request.user._id);
  }
}
