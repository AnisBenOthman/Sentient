import { AgentType } from '../../generated/prisma';
import { SupervisorIntentClassifierService } from './supervisor-intent-classifier.service';

describe('SupervisorIntentClassifierService', () => {
  let service: SupervisorIntentClassifierService;

  beforeEach(() => {
    service = new SupervisorIntentClassifierService();
  });

  it('routes a leave prompt to the Leave Agent', async () => {
    const result = await service.classify('What is my leave balance?');

    expect(result.requiresClarification).toBe(false);
    expect(result.requiredAgents).toEqual([AgentType.LEAVE_AGENT]);
    expect(result.source).toBe('rules');
  });

  it('routes manager multi-domain prompts to multiple specialists', async () => {
    const result = await service.classify('Summarize leave coverage, OKR risk, and dashboard trends for my team.');

    expect(result.requiredAgents).toEqual([
      AgentType.LEAVE_AGENT,
      AgentType.OKR_AGENT,
      AgentType.ANALYTICS_AGENT,
    ]);
  });

  it('detects draft intent', async () => {
    const result = await service.classify('Draft an objective and key result for my next quarter.');

    expect(result.isDraftIntent).toBe(true);
    expect(result.requiredAgents).toContain(AgentType.OKR_AGENT);
  });

  it('marks simple greetings without asking for clarification', async () => {
    const result = await service.classify('hello');

    expect(result.isGreeting).toBe(true);
    expect(result.requiresClarification).toBe(false);
    expect(result.requiredAgents).toEqual([]);
  });

  it('marks short conversational greetings without asking for clarification', async () => {
    const result = await service.classify("haw're you ?");

    expect(result.isGreeting).toBe(true);
    expect(result.requiresClarification).toBe(false);
    expect(result.requiredAgents).toEqual([]);
  });

  it('asks for clarification when no safe route is obvious', async () => {
    const result = await service.classify('Can you help me with my objective?');

    expect(result.requiresClarification).toBe(true);
    expect(result.requiredAgents).toEqual([]);
  });

  it('routes keyword-free follow-ups to the most recent specialist handoff', async () => {
    const result = await service.classify('And what about last year?', {
      recentMessages: [
        { id: 'message-1', role: 'USER', content: 'What is my leave balance?' },
        { id: 'message-2', role: 'ASSISTANT', content: 'You have 15 days remaining.' },
      ],
      priorHandoffAgents: [AgentType.LEAVE_AGENT],
    });

    expect(result.requiresClarification).toBe(false);
    expect(result.requiredAgents).toEqual([AgentType.LEAVE_AGENT]);
    expect(result.confidence).toBeGreaterThanOrEqual(0.4);
  });

  it('still asks for clarification on keyword-free messages without prior handoffs', async () => {
    const result = await service.classify('And what about last year?', {
      recentMessages: [],
      priorHandoffAgents: [],
    });

    expect(result.requiresClarification).toBe(true);
    expect(result.requiredAgents).toEqual([]);
  });

  it('detects explicit human-support requests as escalation intents', async () => {
    const result = await service.classify('I want to talk to a human about my situation.');

    expect(result.isHumanEscalationIntent).toBe(true);
    expect(result.requiresClarification).toBe(false);
  });

  it('does not treat ordinary manager mentions as escalation intents', async () => {
    const result = await service.classify('What is the leave approval status from my manager?');

    expect(result.isHumanEscalationIntent).toBe(false);
    expect(result.requiredAgents).toContain(AgentType.LEAVE_AGENT);
  });
});
