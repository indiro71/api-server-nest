import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { ErrorLogAccessGuard } from './error-log-access.guard';
import { ErrorLogController } from './error-log.controller';
import { ErrorLogService } from './error-log.service';
import { ErrorLog, ErrorLogSchema } from './schemas/error-log.schema';

@Module({
  controllers: [ErrorLogController],
  imports: [
    MongooseModule.forFeature([{ name: ErrorLog.name, schema: ErrorLogSchema }]),
    JwtModule.register({
      secret: process.env.SESSION_SECRET || 'SECRET',
      signOptions: {
        expiresIn: '24h',
      },
    }),
  ],
  providers: [ErrorLogAccessGuard, ErrorLogService],
  exports: [ErrorLogService],
})
export class ErrorLogModule {}
