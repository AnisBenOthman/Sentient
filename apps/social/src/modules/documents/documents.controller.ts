import {
  ArgumentsHost,
  Body,
  Catch,
  Controller,
  Delete,
  ExceptionFilter,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, JwtPayload, Roles } from '@sentient/shared';
import { Request, Response } from 'express';
import { MulterError } from 'multer';

import { HrCoreCallContext } from '../../common/clients/employee-ref.interface';
import { DocumentListResponse, DocumentResponse, DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { ListDocumentsQueryDto } from './dto/list-documents-query.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';

interface AuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>;
  correlationId?: string;
}

@Catch(MulterError)
class DocumentMulterExceptionFilter implements ExceptionFilter {
  catch(exception: MulterError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request & { correlationId?: string }>();
    const res = ctx.getResponse<Response>();
    if (exception.code === 'LIMIT_FILE_SIZE') {
      res.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'FileTooLarge',
        error: 'BAD_REQUEST',
        correlationId: req.correlationId ?? 'unknown',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    res.status(HttpStatus.BAD_REQUEST).json({
      statusCode: HttpStatus.BAD_REQUEST,
      message: exception.message,
      error: 'BAD_REQUEST',
      correlationId: req.correlationId ?? 'unknown',
      timestamp: new Date().toISOString(),
    });
  }
}

@Controller('documents')
@ApiTags('Documents')
@UseFilters(DocumentMulterExceptionFilter)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  @Roles('HR_ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'title', 'category'],
      properties: {
        file: { type: 'string', format: 'binary' },
        title: { type: 'string' },
        category: {
          type: 'string',
          enum: ['INTERNAL_POLICY', 'HANDBOOK', 'REGULATION', 'TEMPLATE', 'GUIDE', 'OTHER'],
        },
        description: { type: 'string' },
        isPublic: { type: 'boolean' },
      },
    },
  })
  @ApiOperation({ summary: 'Upload a new document (HR_ADMIN only)' })
  @ApiResponse({ status: 201, description: 'Document uploaded' })
  @ApiResponse({ status: 400, description: 'MissingFile | EmptyFile | FileTooLarge | UnsupportedMimeType' })
  @ApiResponse({ status: 403, description: 'HR_ADMIN role required' })
  @ApiResponse({ status: 503, description: 'StorageUnavailable' })
  create(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: CreateDocumentDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<DocumentResponse> {
    const context = this.buildHrCoreContext(req);
    return this.documentsService.create(user, dto, file, context.correlationId ?? '', context);
  }

  @Get()
  @Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'EXECUTIVE')
  @ApiOperation({ summary: 'List documents visible to the caller' })
  @ApiResponse({ status: 200, description: 'Paginated document list' })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListDocumentsQueryDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<DocumentListResponse> {
    return this.documentsService.findAll(user, query, this.buildHrCoreContext(req));
  }

  @Get(':id')
  @Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'EXECUTIVE')
  @ApiOperation({ summary: 'Get a single document by ID' })
  @ApiResponse({ status: 200, description: 'Document metadata' })
  @ApiResponse({ status: 404, description: 'DocumentNotFound' })
  findOne(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<DocumentResponse> {
    return this.documentsService.findOne(user, id, this.buildHrCoreContext(req));
  }

  @Get(':id/download')
  @Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'EXECUTIVE', 'SYSTEM')
  @ApiOperation({ summary: 'Download a document file' })
  @ApiResponse({ status: 200, description: 'File stream' })
  @ApiResponse({ status: 404, description: 'DocumentNotFound' })
  @ApiResponse({ status: 410, description: 'DocumentFileMissing' })
  async download(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res({ passthrough: false }) res: Response,
  ): Promise<void> {
    const { stream, mimeType, sizeBytes, filename } = await this.documentsService.download(user, id);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', sizeBytes);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    (stream as NodeJS.ReadableStream).pipe(res);
  }

  @Patch(':id')
  @Roles('HR_ADMIN')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        title: { type: 'string' },
        category: {
          type: 'string',
          enum: ['INTERNAL_POLICY', 'HANDBOOK', 'REGULATION', 'TEMPLATE', 'GUIDE', 'OTHER'],
        },
        description: { type: 'string' },
        isPublic: { type: 'boolean' },
      },
    },
  })
  @ApiOperation({ summary: 'Update document metadata or replace file (HR_ADMIN only)' })
  @ApiResponse({ status: 200, description: 'Document updated' })
  @ApiResponse({ status: 400, description: 'EmptyFile | FileTooLarge | UnsupportedMimeType' })
  @ApiResponse({ status: 403, description: 'HR_ADMIN role required' })
  @ApiResponse({ status: 404, description: 'DocumentNotFound' })
  @ApiResponse({ status: 503, description: 'StorageUnavailable' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UpdateDocumentDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<DocumentResponse> {
    const context = this.buildHrCoreContext(req);
    return this.documentsService.update(user, id, dto, file, context.correlationId ?? '', context);
  }

  @Delete(':id')
  @Roles('HR_ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Hard-delete a document and its storage file (HR_ADMIN only)' })
  @ApiResponse({ status: 204, description: 'Document deleted' })
  @ApiResponse({ status: 403, description: 'HR_ADMIN role required' })
  @ApiResponse({ status: 404, description: 'DocumentNotFound' })
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    const context = this.buildHrCoreContext(req);
    return this.documentsService.remove(user, id, context.correlationId ?? '');
  }

  private buildHrCoreContext(req: AuthenticatedRequest): HrCoreCallContext {
    return {
      jwt: this.extractBearerToken(req.headers['authorization']),
      correlationId: req.correlationId ?? '',
    };
  }

  private extractBearerToken(header: string | string[] | undefined): string {
    const value = Array.isArray(header) ? header[0] : header;
    if (!value?.startsWith('Bearer ')) return '';
    return value.slice(7);
  }
}
