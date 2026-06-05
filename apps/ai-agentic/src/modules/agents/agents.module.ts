import { Module } from '@nestjs/common';
import { ActorContextFactory } from '../../common/graph';
import { AgentGuardrailService, DraftPolicyService, FinalAnswerPolicyService } from '../../common/safety';
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
import { HumanEscalationRecorderService } from './human-escalation-recorder.service';
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
import { SupervisorIntentClassifierService } from './supervisor-intent-classifier.service';

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
    GeneralHelpAgentService,
    HrCoreAiClient,
    HttpJsonClient,
    HumanEscalationAgentService,
    HumanEscalationRecorderService,
    LanguageAgentService,
    LeaveAgentService,
    OkrAgentService,
    OnboardingAgentService,
    PermissionDecisionService,
    SocialAiClient,
    SupervisorAgentService,
    SupervisorIntentClassifierService,
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
    GeneralHelpAgentService,
    HrCoreAiClient,
    HumanEscalationAgentService,
    HumanEscalationRecorderService,
    LanguageAgentService,
    LeaveAgentService,
    OkrAgentService,
    OnboardingAgentService,
    PermissionDecisionService,
    SocialAiClient,
    SupervisorAgentService,
    SupervisorIntentClassifierService,
  ],
})
export class AgentsModule {}
