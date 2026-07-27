import { Module, HttpModule } from '@nestjs/common';
import { ErrorLogModule } from '../../error-log/error-log.module';
import { MxcService } from './mxc.service';

@Module({
  imports: [HttpModule, ErrorLogModule],
  providers: [MxcService],
  exports: [MxcService],
})
export class MxcModule {}
