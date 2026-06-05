import { Injectable } from '@nestjs/common';
import { AgentType } from '../../../generated/prisma';
import { SpecialistAgent, SpecialistInput, SpecialistResult } from '../../../common/graph';
import { deterministicResult } from './specialist-response.helpers';

@Injectable()
export class LeaveAgentService implements SpecialistAgent {
  readonly agentType = AgentType.LEAVE_AGENT;

  async execute(input: SpecialistInput): Promise<SpecialistResult> {
    const draft = input.isDraftRequest
      ? 'Draft leave request: dates, leave type, coverage plan, and manager note should be reviewed in the Leaves module before submission.'
      : 'I can help with leave balance, recent leave history, policy context, and leave-booking preparation. This scaffold keeps official leave records read-only and directs booking actions back to the Leaves module.';
    return deterministicResult(
      input,
      this.agentType,
      'Leave context prepared.',
      draft,
      'LEAVE',
      'Leave balance and history',
      { draftLabel: 'Leave request draft' },
    );
  }
}
