import { randomUUID } from 'crypto';

import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentCategory, DomainEvent, EVENT_BUS, IEventBus, JwtPayload } from '@sentient/shared';

import { Document, DocumentCategory as PrismaDocumentCategory, Prisma } from '../../generated/prisma';
import { HrCoreCallContext, EmployeeRef } from '../../common/clients/employee-ref.interface';
import { HrCoreClient } from '../../common/clients/hr-core.client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { ListDocumentsQueryDto } from './dto/list-documents-query.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { DOCUMENT_STORAGE, DocumentStorage } from './storage/document-storage.interface';
import { StorageWriteError } from './storage/filesystem-document-storage.service';
import { mimeToExtension, sanitizeFilename } from './mime/mime-to-extension';

export interface DocumentUploader {
  id: string;
  firstName: string;
  lastName: string;
  employeeCode: string;
}

export interface DocumentResponse {
  id: string;
  title: string;
  description: string | null;
  category: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: DocumentUploader | null;
  version: number;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentListResponse {
  items: DocumentResponse[];
  total: number;
  page: number;
  pageSize: number;
}

interface DocumentUploadedPayload {
  documentId: string;
  category: DocumentCategory;
  mimeType: string;
  title: string;
  uploadedById: string;
  sizeBytes: number;
  sourceUrl: string;
  version: number;
  isPublic: boolean;
}

interface DocumentDeletedPayload {
  documentId: string;
  category: DocumentCategory;
  uploadedById: string;
}

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);
  private readonly maxSizeBytes: number;
  private readonly mimeWhitelist: Set<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly hrCoreClient: HrCoreClient,
    @Inject(EVENT_BUS) private readonly eventBus: IEventBus,
    @Inject(DOCUMENT_STORAGE) private readonly storage: DocumentStorage,
    private readonly config: ConfigService,
  ) {
    this.maxSizeBytes = this.config.get<number>('DOCUMENT_MAX_SIZE_BYTES') ?? 26_214_400;
    const whitelist =
      this.config.get<string>('DOCUMENT_MIME_WHITELIST') ??
      'application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,text/html';
    this.mimeWhitelist = new Set(whitelist.split(',').map((m) => m.trim()));
  }

  async create(
    user: JwtPayload,
    dto: CreateDocumentDto,
    file: Express.Multer.File | undefined,
    correlationId: string,
    context: HrCoreCallContext,
  ): Promise<DocumentResponse> {
    this.validateFile(file);
    const uploadedFile = file!;

    const documentId = randomUUID();
    const sanitizedName = sanitizeFilename(uploadedFile.originalname);
    const sourceUrl = `documents/${documentId}/v1/${sanitizedName}`;

    try {
      await this.storage.put(sourceUrl, uploadedFile.buffer, uploadedFile.mimetype);
    } catch (err) {
      if (err instanceof StorageWriteError) {
        throw new ServiceUnavailableException('StorageUnavailable');
      }
      throw new ServiceUnavailableException('StorageUnavailable');
    }

    const uploadedById = user.employeeId ?? user.sub;

    const persisted = await this.prisma.document.create({
      data: {
        id: documentId,
        title: dto.title,
        description: dto.description ?? null,
        category: dto.category as unknown as PrismaDocumentCategory,
        sourceUrl,
        mimeType: uploadedFile.mimetype,
        sizeBytes: BigInt(uploadedFile.size),
        uploadedById,
        version: 1,
        isPublic: dto.isPublic ?? true,
      },
    });

    try {
      const event: DomainEvent<DocumentUploadedPayload> = {
        id: randomUUID(),
        type: 'document.uploaded',
        source: 'SOCIAL',
        timestamp: new Date(),
        payload: {
          documentId: persisted.id,
          category: persisted.category as unknown as DocumentCategory,
          mimeType: persisted.mimeType,
          title: persisted.title,
          uploadedById,
          sizeBytes: Number(persisted.sizeBytes),
          sourceUrl: persisted.sourceUrl,
          version: persisted.version,
          isPublic: persisted.isPublic,
        },
        metadata: {
          userId: user.sub,
          correlationId: correlationId || randomUUID(),
        },
      };
      await this.eventBus.emit(event);
    } catch (err) {
      this.logger.warn('document.uploaded event emission failed (best-effort)', err);
    }

    return this.enrichWithUploader([persisted], context).then(([doc]) => doc!);
  }

  async findAll(
    user: JwtPayload,
    query: ListDocumentsQueryDto,
    context: HrCoreCallContext,
  ): Promise<DocumentListResponse> {
    const isAdmin = user.roles.includes('HR_ADMIN');
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 100);
    const skip = (page - 1) * pageSize;

    const where: Prisma.DocumentWhereInput = {
      ...(isAdmin ? {} : { isPublic: true }),
      ...(query.category ? { category: query.category as unknown as PrismaDocumentCategory } : {}),
      ...(query.search
        ? { title: { contains: query.search, mode: 'insensitive' as Prisma.QueryMode } }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.document.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip,
        take: pageSize,
      }),
      this.prisma.document.count({ where }),
    ]);

    const enriched = await this.enrichWithUploader(items, context);
    return { items: enriched, total, page, pageSize };
  }

  async findOne(user: JwtPayload, id: string, context: HrCoreCallContext): Promise<DocumentResponse> {
    const row = await this.prisma.document.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('DocumentNotFound');

    const isAdmin = user.roles.includes('HR_ADMIN');
    if (!row.isPublic && !isAdmin) throw new NotFoundException('DocumentNotFound');

    const [doc] = await this.enrichWithUploader([row], context);
    return doc!;
  }

  async download(
    user: JwtPayload,
    id: string,
  ): Promise<{ stream: NodeJS.ReadableStream; mimeType: string; sizeBytes: number; filename: string }> {
    const row = await this.prisma.document.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('DocumentNotFound');

    const isAdmin = user.roles.includes('HR_ADMIN');
    const isSystem = user.roles.includes('SYSTEM');
    if (!row.isPublic && !isAdmin && !isSystem) throw new NotFoundException('DocumentNotFound');

    const fileExists = await this.storage.exists(row.sourceUrl);
    if (!fileExists) throw new GoneException('DocumentFileMissing');

    const stream = await this.storage.get(row.sourceUrl);
    const filename = sanitizeFilename(row.title) + mimeToExtension(row.mimeType);
    return { stream, mimeType: row.mimeType, sizeBytes: Number(row.sizeBytes), filename };
  }

  async update(
    user: JwtPayload,
    id: string,
    dto: UpdateDocumentDto,
    file: Express.Multer.File | undefined,
    correlationId: string,
    context: HrCoreCallContext,
  ): Promise<DocumentResponse> {
    const row = await this.prisma.document.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('DocumentNotFound');

    let updated: Document;

    if (file !== undefined) {
      // File replacement — validate, write new version, update row, emit event
      if (file.size === 0) throw new BadRequestException('EmptyFile');
      if (file.size > this.maxSizeBytes) throw new BadRequestException('FileTooLarge');
      if (!this.mimeWhitelist.has(file.mimetype)) throw new BadRequestException('UnsupportedMimeType');

      const newVersion = row.version + 1;
      const sanitizedName = sanitizeFilename(file.originalname);
      const newSourceUrl = `documents/${id}/v${newVersion}/${sanitizedName}`;

      try {
        await this.storage.put(newSourceUrl, file.buffer, file.mimetype);
      } catch {
        throw new ServiceUnavailableException('StorageUnavailable');
      }

      try {
        updated = await this.prisma.document.update({
          where: { id },
          data: {
            ...(dto.title !== undefined ? { title: dto.title } : {}),
            ...(dto.description !== undefined ? { description: dto.description } : {}),
            ...(dto.category !== undefined
              ? { category: dto.category as unknown as PrismaDocumentCategory }
              : {}),
            ...(dto.isPublic !== undefined ? { isPublic: dto.isPublic } : {}),
            version: newVersion,
            sourceUrl: newSourceUrl,
            mimeType: file.mimetype,
            sizeBytes: BigInt(file.size),
          },
        });
      } catch (err) {
        this.logger.warn(`Document DB update failed after storage write; orphan file: ${newSourceUrl}`, err);
        throw err;
      }

      // best-effort delete of old file
      this.storage.delete(row.sourceUrl).catch((err: unknown) => {
        this.logger.warn(`Orphan file could not be deleted: ${row.sourceUrl}`, err);
      });

      const uploadedById = row.uploadedById;
      try {
        const event: DomainEvent<DocumentUploadedPayload> = {
          id: randomUUID(),
          type: 'document.uploaded',
          source: 'SOCIAL',
          timestamp: new Date(),
          payload: {
            documentId: updated.id,
            category: updated.category as unknown as DocumentCategory,
            mimeType: updated.mimeType,
            title: updated.title,
            uploadedById,
            sizeBytes: Number(updated.sizeBytes),
            sourceUrl: updated.sourceUrl,
            version: updated.version,
            isPublic: updated.isPublic,
          },
          metadata: {
            userId: user.sub,
            correlationId: correlationId || randomUUID(),
          },
        };
        await this.eventBus.emit(event);
      } catch (err) {
        this.logger.warn('document.uploaded event emission failed (best-effort)', err);
      }
    } else {
      // Metadata-only update — no version bump, no event
      const data: Prisma.DocumentUpdateInput = {};
      if (dto.title !== undefined) data['title'] = dto.title;
      if (dto.description !== undefined) data['description'] = dto.description;
      if (dto.category !== undefined) data['category'] = dto.category as unknown as PrismaDocumentCategory;
      if (dto.isPublic !== undefined) data['isPublic'] = dto.isPublic;

      updated = await this.prisma.document.update({ where: { id }, data });
    }

    return this.enrichWithUploader([updated], context).then(([doc]) => doc!);
  }

  async remove(user: JwtPayload, id: string, correlationId: string): Promise<void> {
    if (!user.roles.includes('HR_ADMIN')) {
      throw new ForbiddenException('HR_ADMIN role required');
    }

    const row = await this.prisma.document.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('DocumentNotFound');

    await this.prisma.document.delete({ where: { id } });

    this.storage.delete(row.sourceUrl).catch((err: unknown) => {
      this.logger.warn(`Orphan file on delete could not be removed: ${row.sourceUrl}`, err);
    });

    try {
      const event: DomainEvent<DocumentDeletedPayload> = {
        id: randomUUID(),
        type: 'document.deleted',
        source: 'SOCIAL',
        timestamp: new Date(),
        payload: {
          documentId: row.id,
          category: row.category as unknown as DocumentCategory,
          uploadedById: row.uploadedById,
        },
        metadata: {
          userId: user.sub,
          correlationId: correlationId || randomUUID(),
        },
      };
      await this.eventBus.emit(event);
    } catch (err) {
      this.logger.warn('document.deleted event emission failed (best-effort)', err);
    }
  }

  private validateFile(file: Express.Multer.File | undefined): void {
    if (!file) throw new BadRequestException('MissingFile');
    if (file.size === 0) throw new BadRequestException('EmptyFile');
    if (file.size > this.maxSizeBytes) throw new BadRequestException('FileTooLarge');
    if (!this.mimeWhitelist.has(file.mimetype)) throw new BadRequestException('UnsupportedMimeType');
  }

  async enrichWithUploader(
    rows: Document[],
    context: HrCoreCallContext,
  ): Promise<DocumentResponse[]> {
    const uniqueIds = [...new Set(rows.map((r) => r.uploadedById))];
    const uploaderMap = new Map<string, EmployeeRef | null>();

    await Promise.all(
      uniqueIds.map(async (empId) => {
        try {
          const ref = await this.hrCoreClient.getEmployeeRef(empId, context);
          uploaderMap.set(empId, ref);
        } catch (err) {
          if (err instanceof NotFoundException) {
            uploaderMap.set(empId, null);
          } else {
            this.logger.warn(`Could not enrich uploader ${empId}`, err);
            uploaderMap.set(empId, null);
          }
        }
      }),
    );

    return rows.map((row) => {
      const ref = uploaderMap.get(row.uploadedById) ?? null;
      return {
        id: row.id,
        title: row.title,
        description: row.description ?? null,
        category: row.category,
        mimeType: row.mimeType,
        sizeBytes: Number(row.sizeBytes),
        uploadedBy: ref
          ? { id: ref.id, firstName: ref.firstName, lastName: ref.lastName, employeeCode: ref.employeeCode }
          : null,
        version: row.version,
        isPublic: row.isPublic,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    });
  }
}
