import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { UserModule } from './user/user.module';
import { ScanpricesModule } from './scanprices/scanprices.module';
import { RoleModule } from './role/role.module';
import { AuthModule } from './auth/auth.module';
import { ParserModule } from './parser/parser.module';
import { ScheduleModule } from '@nestjs/schedule';
import { CronService } from './cron/cron.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      envFilePath: `.${process.env.NODE_ENV}.env`,
    }),
    MongooseModule.forRoot(process.env.MONGODB_URI),
    UserModule,
    ScanpricesModule,
    RoleModule,
    AuthModule,
    ParserModule,
  ],
  providers: [CronService],
})
export class AppModule {}
