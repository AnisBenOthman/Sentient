import { Injectable } from '@nestjs/common';

@Injectable()
export class ConversationTitleService {
  titleFrom(message: string): string {
    const sanitized = this.sanitize(message);
    const title = sanitized.length > 0 ? sanitized : 'AI conversation';
    return title.length > 70 ? `${title.slice(0, 67)}...` : title;
  }

  previewFrom(message: string): string {
    const preview = this.sanitize(message).replace(/\s+/g, ' ');
    return preview.length > 140 ? `${preview.slice(0, 137)}...` : preview;
  }

  private sanitize(value: string): string {
    return value
      .replace(/\b[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, '[email]')
      .replace(/\b\d{3,}\b/g, '[number]')
      .trim();
  }
}
