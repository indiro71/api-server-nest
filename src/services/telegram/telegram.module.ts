import { Module } from '@nestjs/common';
import { ErrorLogModule } from '../../error-log/error-log.module';
import { TelegramService } from './telegram.service';

@Module({
  imports: [ErrorLogModule],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
