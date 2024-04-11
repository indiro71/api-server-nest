import { Module, HttpModule } from '@nestjs/common';
import { MxcService } from './mxc.service';

@Module({
  imports: [HttpModule],
  providers: [MxcService],
  exports: [MxcService],
})
export class MxcModule {}
