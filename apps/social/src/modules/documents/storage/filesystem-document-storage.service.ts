import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { createReadStream } from 'fs';
import { Readable } from 'stream';

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { DocumentStorage } from './document-storage.interface';

export class StorageWriteError extends Error {
  constructor(key: string, readonly cause: unknown) {
    super(`Storage write failed for key "${key}"`);
    this.name = 'StorageWriteError';
  }
}

export class StorageKeyNotFound extends Error {
  constructor(key: string) {
    super(`Storage key not found: "${key}"`);
    this.name = 'StorageKeyNotFound';
  }
}

@Injectable()
export class FilesystemDocumentStorage implements DocumentStorage, OnModuleInit {
  private readonly logger = new Logger(FilesystemDocumentStorage.name);
  private readonly root: string;

  constructor(private readonly config: ConfigService) {
    this.root = path.resolve(
      config.get<string>('DOCUMENT_STORAGE_PATH') ?? './storage/documents',
    );
  }

  onModuleInit(): void {
    fs.mkdirSync(this.root, { recursive: true });
  }

  private resolveSafe(key: string): string {
    const resolved = path.resolve(this.root, key);
    const rootPrefix = path.resolve(this.root) + path.sep;
    if (resolved !== path.resolve(this.root) && !resolved.startsWith(rootPrefix)) {
      throw new StorageWriteError(key, new Error('Path traversal detected'));
    }
    return resolved;
  }

  async put(key: string, buffer: Buffer, _mimeType: string): Promise<void> {
    const filePath = this.resolveSafe(key);
    try {
      await fsp.mkdir(path.dirname(filePath), { recursive: true });
      await fsp.writeFile(filePath, buffer);
    } catch (err) {
      this.logger.error(`Failed to write storage key "${key}"`, err);
      throw new StorageWriteError(key, err);
    }
  }

  async get(key: string): Promise<Readable> {
    const filePath = this.resolveSafe(key);
    return createReadStream(filePath);
  }

  async delete(key: string): Promise<void> {
    const filePath = this.resolveSafe(key);
    try {
      await fsp.unlink(filePath);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw err;
    }
  }

  async exists(key: string): Promise<boolean> {
    const filePath = this.resolveSafe(key);
    try {
      await fsp.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
