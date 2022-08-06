import { Module } from '@nestjs/common';
import { StorageModule } from './storage/storage.module';
import { FilesModule } from './files/files.module';
import { LoggerModule } from './logger/logger.module';

@Module({
  imports: [StorageModule, FilesModule, LoggerModule],
  exports: [StorageModule, FilesModule, LoggerModule],
})
export class ServicesModule {}
