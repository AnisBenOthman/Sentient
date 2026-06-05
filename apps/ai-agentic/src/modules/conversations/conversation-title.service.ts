import { Injectable } from '@nestjs/common';

@Injectable()
export class ConversationTitleService {
  initialTitle(): string {
    return 'Sentient AI conversation';
  }

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
      .replace(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}\b/g, '[person]')
      .replace(/\b(salary|compensation|pay|performance|review|private profile|disciplinary|medical|legal)\b/gi, '[sensitive]')
      .replace(/\b\d{3,}\b/g, '[number]')
      .trim();
  }
}
