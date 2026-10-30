import { Module } from '@nestjs/common';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { ShareProxyService } from './share-proxy.service';

@Module({
  controllers: [FilesController],
  providers: [FilesService, ShareProxyService],
  exports: [FilesService, ShareProxyService],
})
export class FilesModule {}
