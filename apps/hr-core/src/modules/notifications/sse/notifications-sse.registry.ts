import { Injectable, MessageEvent } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';

@Injectable()
export class NotificationsSseRegistry {
  private readonly streams = new Map<string, Set<Subject<MessageEvent>>>();

  subscribe(userId: string): Observable<MessageEvent> {
    const subject = new Subject<MessageEvent>();
    const userStreams = this.streams.get(userId) ?? new Set<Subject<MessageEvent>>();
    userStreams.add(subject);
    this.streams.set(userId, userStreams);
    subject.subscribe({
      complete: () => this.unsubscribe(userId, subject),
      error: () => this.unsubscribe(userId, subject),
    });
    return subject.asObservable();
  }

  unsubscribe(userId: string, subject: Subject<MessageEvent>): void {
    const userStreams = this.streams.get(userId);
    if (!userStreams) return;
    userStreams.delete(subject);
    if (userStreams.size === 0) this.streams.delete(userId);
  }

  push(userId: string, event: MessageEvent): void {
    const userStreams = this.streams.get(userId);
    if (!userStreams) return;
    for (const subject of userStreams) {
      subject.next(event);
    }
  }
}
