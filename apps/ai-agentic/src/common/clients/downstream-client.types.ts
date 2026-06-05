import { PermissionDecision } from '../../generated/prisma';

export interface DownstreamRequestContext {
  jwt: string;
  correlationId: string;
}

export interface DownstreamResult<TData> {
  data: TData | null;
  permissionDecision: PermissionDecision;
  degradedReason: string | null;
  sourceType: string;
  sourceTitle: string;
}

export interface DownstreamSummary {
  id?: string;
  title?: string;
  status?: string;
  summary?: string;
  metadata?: Record<string, unknown>;
}
