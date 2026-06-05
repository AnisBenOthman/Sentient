import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DownstreamRequestContext, DownstreamResult, DownstreamSummary } from './downstream-client.types';
import { HttpJsonClient } from './http-json.client';

@Injectable()
export class SocialAiClient {
  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpJsonClient,
  ) {}

  getApprovedDocuments(context: DownstreamRequestContext): Promise<DownstreamResult<DownstreamSummary>> {
    return this.get('/documents?isPublic=true&pageSize=10', context, 'SOCIAL_DOCUMENT', 'Approved documents');
  }

  getFaqContext(context: DownstreamRequestContext): Promise<DownstreamResult<DownstreamSummary>> {
    return this.get('/documents?category=HANDBOOK&pageSize=10', context, 'FAQ', 'FAQ and handbook documents');
  }

  getEventsContext(context: DownstreamRequestContext): Promise<DownstreamResult<DownstreamSummary>> {
    return this.get('/events?pageSize=10', context, 'EVENTS', 'Events');
  }

  getOnboardingContext(context: DownstreamRequestContext): Promise<DownstreamResult<DownstreamSummary>> {
    return this.get('/documents?category=GUIDE&pageSize=10', context, 'ONBOARDING', 'Onboarding guides');
  }

  getPolicyKnowledge(context: DownstreamRequestContext): Promise<DownstreamResult<DownstreamSummary>> {
    return this.get('/documents?category=INTERNAL_POLICY&pageSize=10', context, 'POLICY', 'Policy knowledge');
  }

  private get(
    path: string,
    context: DownstreamRequestContext,
    sourceType: string,
    sourceTitle: string,
  ): Promise<DownstreamResult<DownstreamSummary>> {
    const baseUrl = this.config.get<string>('aiAgentic.socialUrl') ?? 'http://localhost:3002';
    return this.http.get<DownstreamSummary>(baseUrl, path, context, sourceType, sourceTitle);
  }
}
