const MIME_TO_EXT: Record<string, string> = {
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'text/plain': '.txt',
  'text/markdown': '.md',
  'text/html': '.html',
};

export function mimeToExtension(mimeType: string): string {
  return MIME_TO_EXT[mimeType] ?? '.bin';
}

export function sanitizeFilename(name: string): string {
  const result = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._-]/g, '_')
    .replace(/__+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 100);
  return result.length > 0 ? result : 'document';
}
