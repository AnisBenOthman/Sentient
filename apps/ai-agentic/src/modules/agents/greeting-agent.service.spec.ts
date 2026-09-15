import { GreetingAgentService } from './greeting-agent.service';

describe('GreetingAgentService', () => {
  it('answers English greetings in English', () => {
    const result = new GreetingAgentService().compose('hello');

    expect(result.content).toContain('How can I help you with Sentient today?');
  });

  it('answers French greetings in French', () => {
    const result = new GreetingAgentService().compose('bonjour');

    expect(result.content).toContain('Comment puis-je vous aider');
  });
});
