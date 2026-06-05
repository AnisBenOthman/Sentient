import { Injectable } from '@nestjs/common';
import { AgentType } from '../../../generated/prisma';
import { SpecialistAgent, SpecialistInput, SpecialistResult } from '../../../common/graph';
import { deterministicResult } from './specialist-response.helpers';

@Injectable()
export class LanguageAgentService implements SpecialistAgent {
  readonly agentType = AgentType.LANGUAGE_AGENT;

  async execute(input: SpecialistInput): Promise<SpecialistResult> {
    const phrase = input.userMessage.replace(/^.*?(reword|rewrite|phrase|wording|professional)/i, '').trim();
    const content = phrase.length > 0
      ? `Professional version: ${phrase}`
      : 'Share the exact phrase you want to improve, and I will keep the intent while making the wording clearer, respectful, and workplace-appropriate.';
    return deterministicResult(input, this.agentType, 'Language support prepared.', content, 'LANGUAGE', 'Workplace tone guidance', {
      draftLabel: 'Phrase rewrite draft',
    });
  }
}
