import { Module } from '@nestjs/common';
import { StorageModule } from './storage/storage.module';
import { FilesModule } from './files/files.module';

@Module({
  imports: [StorageModule, FilesModule],
  exports: [StorageModule, FilesModule],
})
export class ServicesModule {}
