import { Module, HttpModule } from '@nestjs/common';
import { FootballDataService } from './footballData.service';

@Module({
  imports: [HttpModule],
  providers: [FootballDataService],
  exports: [FootballDataService],
})
export class FootballDataModule {}
