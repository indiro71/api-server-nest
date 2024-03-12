import { Module, HttpModule } from '@nestjs/common';
import { MxcService } from './mxc.service';
import { TelegramService } from '../telegram/telegram.service';

@Module({
  imports: [HttpModule],
  providers: [MxcService, TelegramService],
  exports: [MxcService],
})
export class MxcModule {}
