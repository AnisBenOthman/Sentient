import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

import { ConfigService } from '@nestjs/config';

import {
  FilesystemDocumentStorage,
  StorageWriteError,
} from './filesystem-document-storage.service';

describe('FilesystemDocumentStorage', () => {
  let root: string;
  let storage: FilesystemDocumentStorage;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'sentient-documents-'));
    storage = new FilesystemDocumentStorage({
      get: jest.fn((key: string) => (key === 'DOCUMENT_STORAGE_PATH' ? root : undefined)),
    } as unknown as ConfigService);
    storage.onModuleInit();
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('put writes to a resolved path inside the storage root', async () => {
    await storage.put('documents/doc-1/v1/policy.pdf', Buffer.from('policy'), 'application/pdf');

    await expect(readFile(join(root, 'documents', 'doc-1', 'v1', 'policy.pdf'), 'utf8'))
      .resolves.toBe('policy');
  });

  it('rejects keys that escape the storage root', async () => {
    await expect(
      storage.put('../escape.pdf', Buffer.from('nope'), 'application/pdf'),
    ).rejects.toThrow(StorageWriteError);
  });

  it('get returns a readable stream for an existing key', async () => {
    await storage.put('documents/doc-1/v1/policy.txt', Buffer.from('hello'), 'text/plain');

    const stream = await storage.get('documents/doc-1/v1/policy.txt');

    await expect(
      new Promise<string>((resolve, reject) => {
        let data = '';
        stream.setEncoding('utf8');
        stream.on('data', (chunk: string) => {
          data += chunk;
        });
        stream.on('end', () => resolve(data));
        stream.on('error', reject);
      }),
    ).resolves.toBe('hello');
  });

  it('exists returns false after delete', async () => {
    const key = 'documents/doc-1/v1/policy.md';
    await storage.put(key, Buffer.from('hello'), 'text/markdown');

    await expect(storage.exists(key)).resolves.toBe(true);
    await storage.delete(key);
    await expect(storage.exists(key)).resolves.toBe(false);
  });

  it('delete of a missing key resolves silently', async () => {
    await expect(storage.delete('documents/missing/v1/file.pdf')).resolves.toBeUndefined();
  });
});
