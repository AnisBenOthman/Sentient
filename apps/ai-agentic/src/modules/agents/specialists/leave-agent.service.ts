import { Injectable } from '@nestjs/common';
import { AgentType } from '../../../generated/prisma';
import { HrCoreAiClient } from '../../../common/clients';
import { SpecialistAgent, SpecialistInput, SpecialistResult } from '../../../common/graph';
import { downstreamResult } from './specialist-response.helpers';

@Injectable()
export class LeaveAgentService implements SpecialistAgent {
  readonly agentType = AgentType.LEAVE_AGENT;

  constructor(private readonly hrCore: HrCoreAiClient) {}

  async execute(input: SpecialistInput): Promise<SpecialistResult> {
    const context = await this.hrCore.getLeaveContext({
      jwt: input.actorContext.jwt,
      correlationId: input.actorContext.correlationId,
    });
    const draft = input.isDraftRequest
      ? 'Draft leave request: dates, leave type, coverage plan, and manager note should be reviewed in the Leaves module before submission.'
      : 'I can help with leave balance, recent leave history, policy context, and leave-booking preparation. This scaffold keeps official leave records read-only and directs booking actions back to the Leaves module.';
    return downstreamResult(
      input,
      this.agentType,
      context,
      'Leave context prepared.',
      draft,
      { draftLabel: 'Leave request draft' },
    );
  }
}
