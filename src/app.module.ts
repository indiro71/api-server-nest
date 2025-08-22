import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { SendGridModule } from "@anchan828/nest-sendgrid";
import { UserModule } from './user/user.module';
import { ScanpricesModule } from './scanprices/scanprices.module';
import { RoleModule } from './role/role.module';
import { AuthModule } from './auth/auth.module';
import { ParserModule } from './parser/parser.module';
import { ScheduleModule } from '@nestjs/schedule';
import { CronService } from './cron/cron.service';
import { ServicesModule } from './services/services.module';
import { join } from 'path';
import { TradingModule } from './trading/trading.module';
import { FootballModule } from './football/football.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      envFilePath: `.${process.env.NODE_ENV}.env`,
    }),
    MongooseModule.forRoot(process.env.MONGODB_URI),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, 'logs'),
      serveRoot: '/logs'
    }),
    SendGridModule.forRoot({
      apikey: process.env.SENDGRID_API_KEY,
    }),
    UserModule,
    ScanpricesModule,
    RoleModule,
    AuthModule,
    ParserModule,
    ServicesModule,
    TradingModule,
    FootballModule
  ],
  providers: [CronService],
})
export class AppModule {}
