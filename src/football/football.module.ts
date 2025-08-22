import { HttpModule, Module } from '@nestjs/common';
import { FootballDataService } from '../services/footballData/footballData.service';
import { ServicesModule } from '../services/services.module';
import { FootballService } from './football.service';

@Module({
  imports: [HttpModule, ServicesModule],
  providers: [FootballDataService, FootballService],
  exports: [FootballService],
})
export class FootballModule {}
