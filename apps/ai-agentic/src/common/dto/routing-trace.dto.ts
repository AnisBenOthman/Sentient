import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AgentNodeType, AgentRunStatus, AgentType } from '../../generated/prisma';

export class RoutingTraceNodeDto {
  @ApiProperty({ enum: AgentNodeType })
  nodeType!: AgentNodeType;

  @ApiProperty({ enum: AgentType })
  agentType!: AgentType;

  @ApiProperty({ enum: AgentRunStatus })
  status!: AgentRunStatus;

  @ApiPropertyOptional()
  summary?: string | null;
}

export class RoutingTraceDto {
  @ApiProperty({ enum: AgentRunStatus })
  status!: AgentRunStatus;

  @ApiProperty({ type: [RoutingTraceNodeDto] })
  nodes!: RoutingTraceNodeDto[];
}

export interface RoutingTraceNode {
  nodeType: AgentNodeType;
  agentType: AgentType;
  status: AgentRunStatus;
  summary?: string | null;
}

export interface RoutingTrace {
  status: AgentRunStatus;
  nodes: RoutingTraceNode[];
}
