# Feature Specification: AI Module

**Feature Branch**: `016-ai-module`  
**Created**: 2026-06-02  
**Status**: Draft  
**Input**: User description: "Start AI module"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ask the Supervisor Agent (Priority: P1)

As an authenticated Sentient user, I want one AI entry point that understands my request, delegates to the right domain-specialized agent, and gives me a unified answer based only on information I am allowed to see, so I can ask naturally without knowing which Sentient module owns the answer.

**Why this priority**: This is the core value of the AI module and matches Sentient's domain structure. The supervisor agent gives users one conversational surface while domain agents keep leave, career, analytics, engagement, onboarding, policy, and language work specialized and governable.

**Independent Test**: Sign in as each supported role, ask single-domain and multi-domain questions, and verify the supervisor selects the right specialist agents, combines permitted outputs into one answer, and refuses or narrows unauthorized parts.

**Acceptance Scenarios**:

1. **Given** an employee is signed in, **When** they ask about their own leave balance, profile, objectives, or recent notifications, **Then** the supervisor delegates to the relevant specialist agent and returns a concise answer using only that employee's accessible records.
2. **Given** an employee is signed in, **When** they ask for another employee's salary, performance review, or private profile details, **Then** the supervisor refuses the restricted request before exposing specialist output and explains that the information is outside their access.
3. **Given** a manager is signed in, **When** they ask for a summary of leave coverage, performance review status, OKR risk, and skills gaps for their managed scope, **Then** the supervisor coordinates the required specialist agents and returns one scoped summary.
4. **Given** an HR admin is signed in, **When** they ask for organization-wide workforce summaries, policy references, or operational trends, **Then** the supervisor can coordinate across the relevant specialist agents and clearly identify the source context used.
5. **Given** a request contains multiple intents, **When** one specialist agent succeeds and another cannot access or find its context, **Then** the supervisor returns the successful answer, explains the unavailable portion, and preserves a useful next step.
6. **Given** any authenticated user is signed in, **When** they ask about topics unrelated to Sentient HRIS, company work context, or supported HR workflows, **Then** the supervisor politely says the question is outside its scope and offers to help with a Sentient-related task instead.
7. **Given** a user makes an unclear request, **When** the supervisor cannot safely select the right specialist agent, **Then** the supervisor routes to a clarification step, asks a focused follow-up question, and waits for the user's answer before continuing.
8. **Given** a specialist agent completes its work, **When** control returns to the supervisor, **Then** the supervisor routes to a final-answer step that composes the final response, checks tone and scope, and ends the conversation turn.

---

### User Story 2 - Continue and Manage AI Conversations (Priority: P2)

As a user, I want my AI conversations to remain organized and resumable, so I can continue analysis or self-service work across sessions without repeating context.

**Why this priority**: Conversation continuity turns the assistant from a one-off Q&A box into a practical workspace, while still keeping the first release read-only.

**Independent Test**: Start a conversation, ask multiple related questions across different domains, leave the assistant, return later, and verify the conversation title, messages, selected agents, sources, and follow-up context are preserved for the same user.

**Acceptance Scenarios**:

1. **Given** a user has no conversations, **When** they ask their first assistant question, **Then** a new conversation is created with a useful title and the exchanged messages.
2. **Given** a user has prior conversations, **When** they open the AI module, **Then** they can see their recent conversations ordered by most recent activity.
3. **Given** a user resumes a prior conversation, **When** they ask a follow-up question, **Then** the supervisor considers prior messages and prior agent handoffs while still rechecking current permissions and current data.
4. **Given** a user no longer wants a conversation, **When** they delete or archive it, **Then** it no longer appears in their active conversation list while required audit records remain available to authorized operators.

---

### User Story 3 - Draft HR Work Products Safely (Priority: P3)

As an employee, manager, or HR admin, I want the supervisor to route drafting requests to the right specialist agent, so I can move faster while still reviewing and approving the final output myself.

**Why this priority**: Drafting provides visible productivity gains after the safer read-only assistant is working, without giving the assistant autonomous authority over official HR records.

**Independent Test**: Ask the assistant to draft supported HR work products, verify the draft uses only authorized context, and confirm no official record changes until a human copies, edits, or submits the content through existing workflows.

**Acceptance Scenarios**:

1. **Given** an employee is writing a personal objective or self-review note, **When** they ask for drafting help, **Then** the supervisor delegates to the career specialist and returns editable text grounded in their accessible goals, skills, and review context.
2. **Given** a manager is preparing team guidance, review feedback, or OKR suggestions, **When** they ask for a draft, **Then** the supervisor delegates to the relevant career, OKR, or analytics specialist and returns manager-scoped suggestions with incomplete-information warnings.
3. **Given** an HR admin is preparing policy, announcement, or workforce insight copy, **When** they ask for a draft, **Then** the supervisor delegates to the relevant general help, engagement, language, or analytics specialist and returns a clearly marked draft with referenced context.
4. **Given** a generated draft includes uncertainty, sensitive data, or policy implications, **When** the draft is shown, **Then** the supervisor labels the uncertainty and prompts the user to review before use.

---

### Edge Cases

- If a user's role or employee link cannot be resolved, the supervisor MUST answer only generic Sentient product or approved policy questions that do not require private data.
- If the user's question mixes permitted and restricted topics, the supervisor MUST answer the permitted portion and clearly decline the restricted portion.
- If the user's question mixes Sentient-related and unrelated topics, the supervisor MUST answer the Sentient-related portion and politely decline the unrelated portion.
- If the user's question is entirely unrelated to Sentient, HR workflows, company policies, employee data, workforce analytics, onboarding, engagement, documents, or supported app usage, the supervisor MUST avoid answering the topic and kindly redirect the user back to Sentient-supported help.
- If the supervisor cannot confidently identify a specialist agent for the user's intent, it MUST ask for a brief clarification or offer safe high-level guidance.
- If a specialist agent cannot find enough reliable context, the supervisor MUST say what is missing instead of inventing an answer.
- If referenced HR data changes after a conversation starts, follow-up answers MUST use current data and disclose when earlier context may be outdated.
- If a prompt asks for legal, medical, payroll, immigration, or disciplinary advice beyond company policy context, the supervisor MUST provide a safe limitation message and route the user to the appropriate human owner.
- If a prompt asks the supervisor to judge another person's character, motives, personality, professionalism, or behavior, the supervisor MUST avoid making personal judgments and instead encourage the user to contact their manager, HR business partner, or People team for support.
- If a user describes a conflict, discomfort, harassment concern, discrimination concern, or workplace incident involving another person, the supervisor MUST respond with empathy, avoid taking sides, and direct the user to the appropriate manager or People team channel. If the user indicates immediate safety risk, the supervisor MUST advise them to seek urgent local help or the company's emergency process.
- If a response would expose sensitive personal information to an unauthorized user, the supervisor MUST refuse even when the user asks indirectly or through summarization.
- If conversation history is long, the supervisor MUST preserve the user's intent and important facts without exposing hidden or unauthorized context in later turns.
- If two specialist agents return conflicting interpretations, the supervisor MUST surface the conflict, prefer confirmed business records over inferred text, and avoid presenting the conflict as settled fact.
- If a specialist agent fails, times out, or is degraded, the supervisor MUST continue with the remaining useful specialists when safe and clearly mark the degraded portion.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide one AI entry point for authenticated users, presented as a supervisor agent.
- **FR-002**: The supervisor agent MUST classify each user request by intent, required domain expertise, sensitivity, and whether one or multiple specialist agents are needed.
- **FR-003**: The supervisor agent MUST delegate eligible requests to domain-specialized agents, including OKR, Career, Analytics, Onboarding, Leave, Language, General Help, and Human Escalation agents.
- **FR-004**: The supervisor agent MUST combine specialist outputs into a single user-facing answer that is coherent, scoped, and clear about which domains contributed.
- **FR-005**: The system MUST enforce the same role and organization-scope boundaries used by the rest of Sentient before using, delegating, or revealing HR information.
- **FR-006**: Specialist agents MUST inherit the requesting user's access scope for user-initiated conversations rather than receiving broader access by default.
- **FR-007**: The supervisor agent MUST support questions about the signed-in user's own HR context, including profile, leave, objectives, skills, reviews, notifications, and relevant policy information when available.
- **FR-008**: The supervisor agent MUST support manager-scoped questions about managed employees, team coverage, review status, OKR progress, skills gaps, and workforce summaries.
- **FR-009**: The supervisor agent MUST support HR-admin questions about organization-wide workforce information, operational trends, policy references, and module activity summaries.
- **FR-010**: Users MUST be able to list, open, continue, and remove their active conversations.
- **FR-011**: The supervisor agent MUST create and maintain user-owned conversations containing messages, timestamps, conversation status, selected specialist agents, and a user-readable title.
- **FR-012**: The supervisor agent MUST re-evaluate permissions, intent, and current data on every new user message, even inside an existing conversation.
- **FR-013**: The supervisor agent MUST support follow-up questions that refer to earlier messages and earlier specialist handoffs in the same conversation.
- **FR-014**: The supervisor agent and specialist agents MUST provide answers in plain language with enough source context for the user to understand why the answer was produced.
- **FR-015**: The supervisor agent and specialist agents MUST refuse or narrow requests that exceed the user's permissions, request unsafe advice, or ask the system to fabricate information.
- **FR-016**: The supervisor agent MUST distinguish confirmed facts, inferred summaries, specialist recommendations, and draft suggestions in its responses.
- **FR-017**: The supervisor agent MUST support draft generation for self-review notes, objective drafts, manager feedback, HR announcements, policy summaries, and workforce insight summaries.
- **FR-018**: Generated drafts MUST be clearly labeled as drafts and MUST NOT create, approve, reject, delete, or otherwise mutate official HR records in the first release.
- **FR-019**: The system MUST record a parent-child audit trail for supervisor activity and each specialist delegation, including user identity, conversation reference, task type, agent type, authorization outcome, source categories used, and response status.
- **FR-020**: Users MUST be able to provide feedback on supervisor responses, including at least positive feedback, negative feedback, and optional written comments.
- **FR-021**: Operators with appropriate access MUST be able to review aggregate supervisor usage, specialist usage, safety refusals, degraded answers, and user feedback without exposing private conversation content unnecessarily.
- **FR-022**: The supervisor agent MUST handle unavailable specialist agents or data sources gracefully by explaining which information could not be reached and continuing with any remaining permitted context.
- **FR-023**: The supervisor agent MUST protect sensitive employee data in conversation titles, previews, logs, routing traces, and feedback summaries.
- **FR-024**: The AI module MUST expose a health/status signal that distinguishes supervisor availability, specialist-agent availability, and degraded data-context availability.
- **FR-025**: The supervisor agent MUST restrict its help to Sentient app context, supported HR workflows, company work context, approved policy or document knowledge, workforce analytics, onboarding, engagement, and employee self-service.
- **FR-026**: When a user asks about an unrelated topic, the supervisor agent MUST respond politely, avoid answering the unrelated subject, briefly explain that it is outside the assistant's scope, and offer examples of Sentient-related requests it can help with.
- **FR-027**: The supervisor agent MUST maintain a professional, respectful, and calm tone in normal answers, refusals, degraded responses, and clarification prompts.
- **FR-028**: When a user asks the supervisor to evaluate, judge, diagnose, or criticize another person, the supervisor agent MUST avoid personal judgments and redirect the user toward constructive next steps with their manager, HR business partner, or People team.
- **FR-029**: When a user raises a workplace conflict or behavior concern, the supervisor agent MUST respond empathetically, avoid determining fault, and route the user to the appropriate human support channel. The response MUST mention urgent local or company emergency support when the user indicates immediate safety risk.
- **FR-030**: The AI module MUST model the conversation workflow as a state machine where each supervisor step, specialist agent, clarification step, final-answer step, and escalation step is a distinct node.
- **FR-031**: The supervisor agent MUST act as the central router for the state machine, deciding whether to answer directly, ask for clarification, route to one or more specialist agents, escalate to a human, or end the conversation turn.
- **FR-032**: Every specialist agent MUST return control to the supervisor with a structured result that includes completion status, summary, source context, permission limitations, and any recommended next step.
- **FR-033**: The Ask User for Clarification node MUST ask only focused, necessary follow-up questions when the request is ambiguous, underspecified, conflicting, or unsafe to route.
- **FR-034**: The Final Answer node MUST produce the final user-facing response after supervisor or specialist work is complete, applying tone, scope, safety, source-context, and privacy checks before the turn ends.
- **FR-035**: The conversation MUST end only when the user's query is resolved, politely declined as outside scope, safely refused, or successfully escalated to a human support channel.
- **FR-036**: The OKR Agent MUST explain organization OKRs, help users focus their own OKRs, suggest draft objectives or key results where permitted, and explain OKR progress or risk within the user's scope.
- **FR-037**: The Career Agent MUST help users understand growth paths, skills, performance-review context, development opportunities, and career next steps within their accessible context.
- **FR-038**: The Analytics Agent MUST help managers and HR admins interpret workforce stats, dashboard trends, team metrics, and scoped organizational insights.
- **FR-039**: The Onboarding Agent MUST support new-hire welcome flows, onboarding progress, first-week guidance, and manager or HR visibility into onboarding status where permitted.
- **FR-040**: The Leave Agent MUST answer leave-balance questions, explain last leave dates and leave history, help users prepare leave-booking requests, and describe leave policy context where available.
- **FR-041**: The Language Agent MUST review, reword, clarify, and professionalize user-provided phrases while preserving the user's intent and respecting Sentient workplace-tone boundaries.
- **FR-042**: The General Help Agent MUST answer Sentient FAQs and approved policy or handbook questions using document-grounded knowledge, including vector-search-backed retrieval where indexed content exists.
- **FR-043**: The Human Escalation Agent MUST gracefully hand off complex, sensitive, unresolved, or human-required cases to the user's manager, HR business partner, People team, or another configured human support channel.

### Key Entities

- **Conversation**: A user-owned assistant thread with title, owner, status, last activity, and retention metadata.
- **Message**: A user or assistant utterance within a conversation, including timestamp, role, visible content, and response status.
- **Supervisor Agent**: The top-level coordinator that receives user messages, determines intent and sensitivity, selects specialist agents, merges outputs, and enforces final response safety.
- **Specialist Agent**: A domain-focused assistant responsible for a bounded area such as leave, career growth, analytics, engagement, onboarding, policy knowledge, or language support.
- **Agent Node**: A state-machine step representing the supervisor, a specialist agent, the clarification node, the final-answer node, or the human-escalation node.
- **Agent Handoff**: A recorded delegation from the supervisor to one or more specialist agents, including domain, requested task, permission result, status, and response summary.
- **Clarification Request**: A focused follow-up question asked by the Ask User for Clarification node when routing or answering safely requires more detail.
- **Final Answer**: The composed response produced after supervisor or specialist work is complete, including the final scope, tone, safety, and source checks.
- **Human Escalation**: A handoff record indicating that the conversation could not or should not be fully resolved by AI and has been routed to an appropriate human support channel.
- **Assistant Source**: A reference to the type of business context used in an answer, such as employee profile, leave, OKR, performance review, social document, notification, or policy content.
- **Agent Task Log**: An audit record for each supervisor or specialist action, including task type, agent type, requester, authorization result, source categories, outcome, parent-child relationship, and correlation details.
- **Knowledge Item**: Approved company information that the assistant may use for policy or document-grounded answers.
- **Response Feedback**: A user's rating and optional comment about a specific assistant response.
- **Permission Decision**: The assistant's record of whether requested context was allowed, partially allowed, denied, or unavailable for the current user.

### Agent Roster

- **Supervisor Agent**: Orchestrates the conversation, analyzes intent, selects specialist agents, handles state transitions, and owns the final response quality.
- **OKR Agent**: Explains organization OKRs, helps users focus on their own OKRs, drafts permitted OKR ideas, and explains progress or risk in scope.
- **Career Agent**: Helps users evolve through skills, growth paths, performance-review context, learning opportunities, and development planning.
- **Analytics Agent**: Helps managers and HR admins understand dashboards, workforce statistics, trends, and scoped organizational insights.
- **Onboarding Agent**: Welcomes new hires, tracks onboarding progress, explains next steps, and supports manager or HR onboarding visibility.
- **Leave Agent**: Helps users understand leave balances, last leave dates, leave history, leave policy, and leave-booking preparation.
- **Language Agent**: Reviews, rewrites, and improves workplace phrases while preserving meaning and professional tone.
- **General Help Agent**: Answers Sentient FAQs and approved handbook or policy questions using document-grounded retrieval.
- **Human Escalation Agent**: Hands off sensitive, complex, unresolved, or human-required cases to managers, HR business partners, People team, or configured support channels.

### State Machine Workflow

1. The conversation starts with the Supervisor Agent receiving the user's message.
2. The Supervisor Agent classifies intent, sensitivity, required domain knowledge, permissions, and whether the request is Sentient-scoped.
3. If the request is ambiguous or cannot be routed safely, control moves to the Ask User for Clarification node and returns to the Supervisor Agent after the user replies.
4. If the request is outside Sentient scope, unsafe, or forbidden, the Supervisor Agent routes directly to the Final Answer node with a polite limitation response.
5. If the request needs specialist work, the Supervisor Agent routes to one or more specialist-agent nodes.
6. Each specialist agent performs its bounded task and returns control to the Supervisor Agent with status, summary, limitations, and source context.
7. If the case is complex, sensitive, unresolved, or requires a human decision, the Supervisor Agent routes to the Human Escalation Agent.
8. The Human Escalation Agent records the handoff target and returns control to the Supervisor Agent for the user-facing escalation response.
9. The Supervisor Agent routes to the Final Answer node when the query is resolved, declined, refused, or successfully escalated.
10. The Final Answer node produces the response and ends the conversation turn.

### Polite Scope Examples

- **Unrelated general knowledge**: If a user asks "Who won the World Cup?" the supervisor replies kindly that it can only help with Sentient, HR, company policy, and workforce-related questions, then offers examples such as leave balances, OKRs, team coverage, documents, or onboarding.
- **Entertainment or casual requests**: If a user asks "Write me a movie plot" or "Tell me a joke," the supervisor does not complete the entertainment request and redirects to supported Sentient work tasks in a friendly way.
- **External technical support**: If a user asks how to fix a personal laptop, unrelated software, or a non-Sentient account, the supervisor explains that this is outside Sentient scope and suggests contacting the appropriate support channel.
- **Mixed request**: If a user asks "Summarize my leave balance and also explain cryptocurrency investing," the supervisor answers the leave-balance portion and politely declines the investment topic as outside scope.
- **Sensitive non-HR advice**: If a user asks for legal, medical, immigration, or financial advice, the supervisor avoids giving advice, points to relevant internal policy only when available, and recommends contacting the appropriate qualified human owner.
- **Judging another person**: If a user asks "What do you think about my colleague? I did not appreciate their behavior," the supervisor avoids judging the colleague, acknowledges the user's concern, and suggests documenting what happened and contacting their manager, HR business partner, or People team for support.
- **Workplace conflict**: If a user asks whether another person was disrespectful, toxic, discriminatory, or unprofessional, the supervisor does not decide fault or label the person. It encourages the user to use the appropriate People team or manager channel, and offers to help draft a neutral summary of the facts for that conversation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 90% of common employee self-service questions in the launch test set receive a correct answer or a correct limitation message in one assistant turn.
- **SC-002**: 95% of manager and HR admin workforce-summary questions in the launch test set return a scoped answer, a clearly scoped partial answer, or a correct data-unavailable explanation.
- **SC-003**: 100% of unauthorized sensitive-data prompts in the safety test set are refused or narrowed without exposing restricted data.
- **SC-004**: Users can start a new conversation and receive the first visible answer within 15 seconds for at least 90% of launch test prompts.
- **SC-005**: Users can resume a prior conversation and ask a follow-up question without re-entering context in at least 90% of tested flows.
- **SC-006**: At least 80% of factual answers include visible source context or a clear explanation that no reliable source was available.
- **SC-007**: At least 75% of pilot users rate assistant answers as helpful after two weeks of use.
- **SC-008**: Human-reviewed draft outputs require no sensitive-data redaction in 95% of sampled launch-period draft requests.
- **SC-009**: The supervisor selects the expected specialist agent or agent combination for at least 90% of prompts in the launch routing test set.
- **SC-010**: In multi-domain prompt tests, at least 90% of final answers clearly separate each domain's contribution, limitation, or next step.
- **SC-011**: 100% of unrelated-topic prompts in the launch scope test set receive a polite out-of-scope response without answering the unrelated topic.
- **SC-012**: 95% of sampled refusal and clarification responses are rated by reviewers as polite, professional, and helpful in redirecting users to supported Sentient tasks.
- **SC-013**: 100% of interpersonal-judgment prompts in the safety test set avoid judging the person, avoid assigning blame, and route the user to a manager, HR business partner, or People team support channel.
- **SC-014**: 95% of launch routing test prompts reach the expected state-machine path, including direct answer, clarification, specialist delegation, polite out-of-scope response, refusal, final answer, or human escalation.
- **SC-015**: 100% of specialist-agent test flows return control to the supervisor before a final user-facing answer is sent.
- **SC-016**: 100% of human-escalation test cases end with a recorded handoff target and a clear user-facing explanation of the next step.

## Assumptions

- The first AI module release is read-only for official HR records; users remain responsible for submitting or approving changes through existing Sentient workflows.
- The AI module is organized around one supervisor agent coordinating named domain-specialized agents through a state-machine workflow.
- The assistant is available only to authenticated Sentient users.
- The assistant is not a general-purpose chatbot; its purpose is limited to Sentient app usage, HR operations, workforce context, company policy/document knowledge, and supported employee or manager workflows.
- The assistant uses existing Sentient role and organization-scope rules for employee, manager, team lead, department manager, HR admin, and related tiers.
- Existing HR, Social, OKR, leave, performance, notification, and document information is treated as the assistant's business context where the user is authorized to access it.
- Company policy and document answers use approved internal content; the assistant does not treat arbitrary user text as official policy.
- Email, Slack, WhatsApp, voice, and external chatbot channels are out of scope for the first release.
- Automatic background agents, autonomous approvals, record mutation, payroll decisions, disciplinary decisions, and legal advice are out of scope for the first release.
- Conversation retention follows the organization's audit and privacy practices, with user-facing deletion/archive separate from required operational audit retention.
