import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import * as path from 'path';
import { UserModule } from './user/user.module';
import { ScanpricesModule } from './scanprices/scanprices.module';
import { RoleModule } from './role/role.module';
import { AuthModule } from './auth/auth.module';
import { ParserModule } from './parser/parser.module';
import { ScheduleModule } from '@nestjs/schedule';
import { CronService } from './cron/cron.service';
import { ServicesModule } from './services/services.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      envFilePath: `.${process.env.NODE_ENV}.env`,
    }),
    MongooseModule.forRoot(process.env.MONGODB_URI),
    ServeStaticModule.forRoot({
      rootPath: path.resolve(__dirname, 'static'),
    }),
    UserModule,
    ScanpricesModule,
    RoleModule,
    AuthModule,
    ParserModule,
    ServicesModule,
  ],
  providers: [CronService],
})
export class AppModule {}
