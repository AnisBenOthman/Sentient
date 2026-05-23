import { Controller, Get, Header, Inject } from '@nestjs/common';
import type { DownstreamOpenApiDocument } from './openapi-aggregation.service';
import { OpenApiAggregationService } from './openapi-aggregation.service';

export const GATEWAY_OPENAPI_DOCUMENT = Symbol('GATEWAY_OPENAPI_DOCUMENT');

type DocumentationSection = Omit<DownstreamOpenApiDocument, 'key'> & { key: string };

@Controller('api')
export class DocsController {
  constructor(
    private readonly aggregationService: OpenApiAggregationService,
    @Inject(GATEWAY_OPENAPI_DOCUMENT)
    private readonly gatewayDocument: Record<string, unknown>,
  ) {}

  @Get('docs')
  @Header('content-type', 'text/html; charset=utf-8')
  async docs(): Promise<string> {
    const aggregate = await this.aggregationService.aggregate(this.gatewayDocument);
    const downstreams = Array.isArray(aggregate.downstreams)
      ? (aggregate.downstreams as DownstreamOpenApiDocument[])
      : [];
    return `<!doctype html>
<html lang="en">
<head>
  <title>Sentient API Gateway Docs</title>
  <style>
    body { font-family: Inter, system-ui, sans-serif; margin: 0; background: #f8fafc; color: #0f172a; }
    main { max-width: 1100px; margin: 0 auto; padding: 40px 24px; }
    h1 { margin: 0 0 8px; font-size: 32px; }
    h2 { margin: 0 0 16px; font-size: 20px; }
    .intro { margin: 0 0 28px; color: #475569; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; }
    section { border: 1px solid #e2e8f0; border-radius: 8px; background: white; padding: 18px; }
    .meta { color: #64748b; font-size: 13px; margin-bottom: 12px; }
    .unavailable { color: #b91c1c; }
    ul { margin: 0; padding-left: 18px; }
    li { margin: 6px 0; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; }
    a { color: #2563eb; }
  </style>
</head>
<body>
  <main>
    <h1>Sentient API Gateway Docs</h1>
    <p class="intro">Gateway and downstream endpoints grouped by service. Raw aggregate JSON is available at <a href="/api/docs-json">/api/docs-json</a>.</p>
    <div class="grid">
      ${this.renderService('Gateway', { key: 'gateway', url: '/api/gateway-docs-json', status: 'available', document: this.gatewayDocument })}
      ${downstreams.map((downstream) => this.renderService(this.serviceLabel(downstream.key), downstream)).join('')}
    </div>
  </main>
</body>
</html>`;
  }

  @Get('docs-json')
  docsJson(): Promise<Record<string, unknown>> {
    return this.aggregationService.aggregate(this.gatewayDocument);
  }

  private renderService(label: string, service: DocumentationSection): string {
    if (service.status !== 'available') {
      return `<section>
        <h2>${this.escapeHtml(label)}</h2>
        <div class="meta unavailable">Unavailable: ${this.escapeHtml(service.error ?? 'OpenAPI document unavailable')}</div>
        <div class="meta">${this.escapeHtml(service.url)}</div>
      </section>`;
    }

    const paths = this.extractPaths(service.document);
    return `<section>
      <h2>${this.escapeHtml(label)}</h2>
      <div class="meta">${paths.length} endpoint${paths.length === 1 ? '' : 's'} from ${this.escapeHtml(service.url)}</div>
      ${paths.length > 0 ? `<ul>${paths.map((path) => `<li>${this.escapeHtml(path)}</li>`).join('')}</ul>` : '<div class="meta">No paths declared.</div>'}
    </section>`;
  }

  private extractPaths(document: unknown): string[] {
    if (typeof document !== 'object' || document === null) return [];
    const paths = (document as { paths?: unknown }).paths;
    if (typeof paths !== 'object' || paths === null) return [];
    return Object.entries(paths as Record<string, unknown>)
      .flatMap(([path, methods]) => this.extractMethods(path, methods))
      .sort();
  }

  private extractMethods(path: string, methods: unknown): string[] {
    if (typeof methods !== 'object' || methods === null) return [path];
    return Object.keys(methods as Record<string, unknown>).map((method) => `${method.toUpperCase()} ${path}`);
  }

  private serviceLabel(key: string): string {
    const labels: Record<string, string> = {
      hr: 'HR Core',
      social: 'Social',
      ai: 'AI Agentic',
    };
    return labels[key] ?? key;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
