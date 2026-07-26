import { Body, Controller, Delete, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PushSubscriptionDto } from './dto/push-subscription.dto';
import { PushService } from './push.service';

@ApiTags('Push')
@UseGuards(JwtAuthGuard)
@Controller('/push')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Get('/public-key')
  getPublicKey() {
    return this.pushService.getPublicKey();
  }

  @Post('/subscribe')
  subscribe(@Body() dto: PushSubscriptionDto, @Req() req) {
    return this.pushService.subscribe(dto, req.user?._id);
  }

  @Delete('/subscribe')
  unsubscribe(@Body() dto: PushSubscriptionDto) {
    return this.pushService.unsubscribe(dto);
  }
}
