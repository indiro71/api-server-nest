import { Module, HttpModule } from '@nestjs/common';
import { ErrorLogModule } from '../../error-log/error-log.module';
import { BybitService } from './bybit.service';

@Module({
  imports: [HttpModule, ErrorLogModule],
  providers: [BybitService],
  exports: [BybitService],
})
export class BybitModule {}
