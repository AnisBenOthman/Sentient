import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ActorContextFactory } from '../../common/graph';
import { AgentGuardrailService, DraftPolicyService, FinalAnswerPolicyService } from '../../common/safety';
import { AiAgenticConfig } from '../../config';
import {
  HrCoreAiClient,
  HttpJsonClient,
  SocialAiClient,
} from '../../common/clients';
import { KnowledgeModule } from '../knowledge';
import { AgentHandoffService } from './agent-handoff.service';
import { AgentNodeRunService } from './agent-node-run.service';
import { AgentRegistryService } from './agent-registry.service';
import { AgentTaskLogService } from './agent-task-log.service';
import { AiHealthService } from './ai-health.service';
import { GeminiIntentClassifierService } from './gemini-intent-classifier.service';
import { GreetingAgentService } from './greeting-agent.service';
import { HumanEscalationRecorderService } from './human-escalation-recorder.service';
import { INTENT_CLASSIFIER, IntentClassifier } from './intent-classifier.types';
import { ClarificationNodeService } from './nodes/clarification-node.service';
import { FinalAnswerNodeService } from './nodes/final-answer-node.service';
import { PermissionDecisionService } from './permission-decision.service';
import { AnalyticsAgentService } from './specialists/analytics-agent.service';
import { CareerAgentService } from './specialists/career-agent.service';
import { GeneralHelpAgentService } from './specialists/general-help-agent.service';
import { HumanEscalationAgentService } from './specialists/human-escalation-agent.service';
import { LanguageAgentService } from './specialists/language-agent.service';
import { LeaveAgentService } from './specialists/leave-agent.service';
import { OkrAgentService } from './specialists/okr-agent.service';
import { OnboardingAgentService } from './specialists/onboarding-agent.service';
import { SupervisorAgentService } from './supervisor-agent.service';
import { SupervisorLangGraphRunnerService } from './supervisor-langgraph-runner.service';
import { SupervisorIntentClassifierService } from './supervisor-intent-classifier.service';
import { GeminiToolCallerService } from './tools/gemini-tool-caller.service';
import { LlmFallbackOrchestratorService } from './tools/llm-fallback-orchestrator.service';
import { LlmToolCallerAdapter } from './tools/llm-tool-caller.interface';
import {
  GROK_TOOL_CALLER,
  GROQ_TOOL_CALLER,
  OPENROUTER_TOOL_CALLER,
  OpenAiCompatibleToolCallerService,
} from './tools/openai-compatible-tool-caller.service';
import { ToolRegistryService } from './tools/tool-registry.service';

@Module({
  imports: [KnowledgeModule],
  providers: [
    ActorContextFactory,
    AgentGuardrailService,
    AgentHandoffService,
    AgentNodeRunService,
    AgentRegistryService,
    AgentTaskLogService,
    AiHealthService,
    AnalyticsAgentService,
    CareerAgentService,
    ClarificationNodeService,
    DraftPolicyService,
    FinalAnswerPolicyService,
    FinalAnswerNodeService,
    GeminiIntentClassifierService,
    GeminiToolCallerService,
    GeneralHelpAgentService,
    GreetingAgentService,
    HrCoreAiClient,
    HttpJsonClient,
    HumanEscalationAgentService,
    HumanEscalationRecorderService,
    LanguageAgentService,
    LeaveAgentService,
    LlmFallbackOrchestratorService,
    OkrAgentService,
    OnboardingAgentService,
    PermissionDecisionService,
    SocialAiClient,
    SupervisorAgentService,
    SupervisorLangGraphRunnerService,
    SupervisorIntentClassifierService,
    ToolRegistryService,
    {
      provide: OPENROUTER_TOOL_CALLER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): LlmToolCallerAdapter =>
        new OpenAiCompatibleToolCallerService(config, 'OPENROUTER'),
    },
    {
      provide: GROQ_TOOL_CALLER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): LlmToolCallerAdapter =>
        new OpenAiCompatibleToolCallerService(config, 'GROQ'),
    },
    {
      provide: GROK_TOOL_CALLER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): LlmToolCallerAdapter =>
        new OpenAiCompatibleToolCallerService(config, 'GROK'),
    },
    {
      provide: INTENT_CLASSIFIER,
      inject: [ConfigService, SupervisorIntentClassifierService, GeminiIntentClassifierService],
      useFactory: (
        config: ConfigService,
        rulesClassifier: SupervisorIntentClassifierService,
        geminiClassifier: GeminiIntentClassifierService,
      ): IntentClassifier => {
        const aiConfig = config.get<AiAgenticConfig>('aiAgentic');
        return aiConfig?.intentClassifierProvider === 'gemini' ||
          aiConfig?.intentClassifierProvider === 'openrouter' ||
          aiConfig?.intentClassifierProvider === 'groq'
          ? geminiClassifier
          : rulesClassifier;
      },
    },
  ],
  exports: [
    ActorContextFactory,
    AgentGuardrailService,
    AgentHandoffService,
    AgentNodeRunService,
    AgentRegistryService,
    AgentTaskLogService,
    AiHealthService,
    AnalyticsAgentService,
    CareerAgentService,
    ClarificationNodeService,
    DraftPolicyService,
    FinalAnswerPolicyService,
    FinalAnswerNodeService,
    GeminiIntentClassifierService,
    GeminiToolCallerService,
    GeneralHelpAgentService,
    GreetingAgentService,
    HrCoreAiClient,
    HumanEscalationAgentService,
    HumanEscalationRecorderService,
    LanguageAgentService,
    LeaveAgentService,
    LlmFallbackOrchestratorService,
    OkrAgentService,
    OnboardingAgentService,
    PermissionDecisionService,
    SocialAiClient,
    SupervisorAgentService,
    SupervisorLangGraphRunnerService,
    SupervisorIntentClassifierService,
    ToolRegistryService,
    INTENT_CLASSIFIER,
  ],
})
export class AgentsModule {}
