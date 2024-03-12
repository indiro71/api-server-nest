import { Module } from '@nestjs/common';
import { StorageModule } from './storage/storage.module';
import { FilesModule } from './files/files.module';
import { LoggerModule } from './logger/logger.module';
import { MxcModule } from './mxc/mxc.module';
import { TelegramModule } from './telegram/telegram.module';

@Module({
  imports: [StorageModule, FilesModule, LoggerModule, MxcModule, TelegramModule],
  exports: [StorageModule, FilesModule, LoggerModule, MxcModule, TelegramModule],
})
export class ServicesModule {}
