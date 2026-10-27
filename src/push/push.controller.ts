import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
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
  unsubscribe(@Body() dto: PushSubscriptionDto, @Req() req) {
    return this.pushService.unsubscribe(dto, req.user._id);
  }

  @Post('/test')
  test(@Body() dto: { endpoint: string }, @Req() req) {
    return this.pushService.testPush(dto?.endpoint, req.user._id);
  }

  @Post('/status')
  status(@Body() dto: { endpoint: string; eventId?: string }, @Req() req) {
    return this.pushService.status(dto?.endpoint, req.user._id, dto?.eventId);
  }
}
