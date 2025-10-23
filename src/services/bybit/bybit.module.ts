import { Module, HttpModule } from '@nestjs/common';
import { BybitService } from './bybit.service';

@Module({
  imports: [HttpModule],
  providers: [BybitService],
  exports: [BybitService],
})
export class BybitModule {}
