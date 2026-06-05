import { Injectable } from '@nestjs/common';
import { AgentType } from '../../../generated/prisma';
import { SpecialistAgent, SpecialistInput, SpecialistResult } from '../../../common/graph';
import { KnowledgeRepository } from '../../knowledge';
import { deterministicResult } from './specialist-response.helpers';

@Injectable()
export class GeneralHelpAgentService implements SpecialistAgent {
  readonly agentType = AgentType.GENERAL_HELP_AGENT;

  constructor(private readonly knowledgeRepository: KnowledgeRepository) {}

  async execute(input: SpecialistInput): Promise<SpecialistResult> {
    const matches = await this.knowledgeRepository.searchApproved(input.normalizedIntent, 3);
    const sourceText = matches.length > 0
      ? `I found ${matches.length} approved knowledge source(s) that can support this answer.`
      : 'No approved knowledge article matched this prompt yet, so I will stay at high-level Sentient guidance and avoid inventing policy.';
    const lower = input.normalizedIntent.toLowerCase();
    const draftType = lower.includes('announcement') ? 'HR announcement' : 'policy summary';
    const content = input.isDraftRequest
      ? `Draft ${draftType}: ${sourceText} Review the final wording with People team before publishing or relying on it as official policy.`
      : sourceText;
    return deterministicResult(input, this.agentType, 'General help knowledge checked.', content, 'POLICY', 'Approved knowledge', {
      draftLabel: 'Policy or announcement draft',
    });
  }
}
