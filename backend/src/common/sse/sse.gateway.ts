import { Injectable } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';

interface SseClient {
  id: string;
  subject: Subject<any>;
  createdAt: Date;
}

interface SseMessage {
  type: string;
  data: any;
  timestamp: Date;
}

@Injectable()
export class SseGateway {
  private clients: Map<string, SseClient> = new Map();
  private readonly MAX_CLIENTS_PER_USER = 5;
  private readonly CLIENT_TIMEOUT_MS = 5 * 60 * 1000;

  subscribe(clientId: string): Observable<SseMessage> {
    if (this.clients.has(clientId)) {
      const existing = this.clients.get(clientId)!;
      existing.subject.complete();
      this.clients.delete(clientId);
    }

    const subject = new Subject<SseMessage>();
    this.clients.set(clientId, {
      id: clientId,
      subject,
      createdAt: new Date(),
    });

    // Auto-cleanup after timeout
    setTimeout(() => {
      if (this.clients.has(clientId)) {
        this.disconnect(clientId);
      }
    }, this.CLIENT_TIMEOUT_MS);

    return subject.asObservable();
  }

  publish(clientId: string, message: SseMessage): boolean {
    const client = this.clients.get(clientId);
    if (!client) {
      return false;
    }
    client.subject.next(message);
    return true;
  }

  disconnect(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.subject.complete();
      this.clients.delete(clientId);
    }
  }

  getActiveClientCount(): number {
    return this.clients.size;
  }

  getClientsByPrefix(prefix: string): string[] {
    return Array.from(this.clients.keys()).filter((id) =>
      id.startsWith(prefix),
    );
  }
}
