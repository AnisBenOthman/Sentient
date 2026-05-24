import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';

import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { DOCUMENT_STORAGE } from './storage/document-storage.interface';
import { FilesystemDocumentStorage } from './storage/filesystem-document-storage.service';

// PrismaModule, ClientsModule, and EventBusModule are all @Global() — no explicit import needed.
@Module({
  imports: [
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        limits: {
          fileSize: config.get<number>('DOCUMENT_MAX_SIZE_BYTES') ?? 26_214_400,
        },
      }),
    }),
  ],
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    { provide: DOCUMENT_STORAGE, useClass: FilesystemDocumentStorage },
  ],
  exports: [DocumentsService],
})
export class DocumentsModule {}
