import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { UserModule } from './user/user.module';
import { ScanpricesModule } from './scanprices/scanprices.module';
import { RoleModule } from './role/role.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: `.${process.env.NODE_ENV}.env`,
    }),
    MongooseModule.forRoot(process.env.MONGODB_URI),
    UserModule,
    ScanpricesModule,
    RoleModule,
  ],
})
export class AppModule {}
