# Data Model: AI Module

## Storage Scope

All AI module records live in PostgreSQL schema `ai_agent`. References to HR Core or Social records are logical string IDs and metadata only; there are no cross-schema foreign keys.

## Enums

### AgentType

Expected values:

- `SUPERVISOR_AGENT`
- `OKR_AGENT`
- `CAREER_AGENT`
- `ANALYTICS_AGENT`
- `ONBOARDING_AGENT`
- `LEAVE_AGENT`
- `LANGUAGE_AGENT`
- `GENERAL_HELP_AGENT`
- `HUMAN_ESCALATION_AGENT`

Shared compatibility note: existing values such as `LINGUISTIC_AGENT` and `ONBOARDING_COMPANION` should either be retained as aliases or migrated carefully. The scaffold may extend the enum without removing existing values.

### ConversationStatus

- `ACTIVE`
- `ARCHIVED`
- `DELETED`

### MessageRole

- `USER`
- `ASSISTANT`
- `SYSTEM`
- `AGENT`

### AgentNodeType

- `SUPERVISOR`
- `CLARIFICATION`
- `SPECIALIST`
- `HUMAN_ESCALATION`
- `FINAL_ANSWER`

### AgentRunStatus

- `PENDING`
- `RUNNING`
- `SUCCESS`
- `FAILED`
- `DEGRADED`
- `PARTIAL`
- `ESCALATED`
- `REFUSED`
- `OUT_OF_SCOPE`

### PermissionDecision

- `ALLOWED`
- `PARTIAL`
- `DENIED`
- `UNAVAILABLE`

### FeedbackRating

- `POSITIVE`
- `NEGATIVE`

### KnowledgeSourceType

- `HANDBOOK`
- `POLICY`
- `SOCIAL_DOCUMENT`
- `FAQ`
- `SYSTEM_GUIDE`

## Entities

### Conversation

Represents a user-owned assistant thread.

Fields:

- `id`: UUID
- `ownerUserId`: string
- `ownerEmployeeId`: string nullable
- `title`: string, sanitized and never containing sensitive inferred data
- `status`: ConversationStatus
- `lastAgentType`: AgentType nullable
- `lastMessagePreview`: string nullable, redacted/sanitized
- `createdAt`: datetime
- `updatedAt`: datetime
- `archivedAt`: datetime nullable
- `deletedAt`: datetime nullable

Relationships:

- One conversation has many messages.
- One conversation has many agent task logs.
- One conversation has many handoffs.
- One conversation may have many escalation records.

Validation:

- Only the owner or privileged governance role can read conversation content.
- Deleted conversations are excluded from active lists but audit logs remain retained.

### Message

Represents a visible utterance or system-visible state-machine event.

Fields:

- `id`: UUID
- `conversationId`: UUID
- `role`: MessageRole
- `content`: text
- `agentType`: AgentType nullable
- `nodeType`: AgentNodeType nullable
- `sourceSummary`: JSON nullable
- `status`: AgentRunStatus
- `createdAt`: datetime

Validation:

- User content is stored as entered.
- Assistant content must pass scope/tone/final-answer guardrails.
- Internal-only details are stored in task logs, not user-facing message content.

### AgentTaskLog

Parent-child audit record for each supervisor, specialist, clarification, final answer, or escalation action.

Fields:

- `id`: UUID
- `conversationId`: UUID nullable
- `parentLogId`: UUID nullable
- `agentType`: AgentType
- `nodeType`: AgentNodeType
- `taskType`: string
- `trigger`: TaskTrigger
- `actorUserId`: string nullable
- `actorEmployeeId`: string nullable
- `status`: AgentRunStatus
- `permissionDecision`: PermissionDecision nullable
- `sourceCategories`: string array
- `inputSummary`: string nullable
- `outputSummary`: string nullable
- `errorCode`: string nullable
- `errorMessage`: string nullable
- `correlationId`: string
- `startedAt`: datetime
- `finishedAt`: datetime nullable

Relationships:

- Self-referencing parent-child chain.
- Belongs to a conversation when user initiated.

Validation:

- Every specialist handoff must have a parent supervisor task.
- Failed/degraded tasks must store a safe error summary.

### AgentHandoff

Represents a supervisor delegation to a specialist or escalation node.

Fields:

- `id`: UUID
- `conversationId`: UUID
- `parentTaskLogId`: UUID
- `specialistTaskLogId`: UUID nullable
- `fromAgentType`: AgentType
- `toAgentType`: AgentType
- `reason`: string
- `requestedIntent`: string
- `permissionDecision`: PermissionDecision
- `status`: AgentRunStatus
- `summary`: string nullable
- `createdAt`: datetime
- `completedAt`: datetime nullable

Validation:

- `fromAgentType` is normally `SUPERVISOR_AGENT`.
- `toAgentType` must be a registered specialist or human escalation agent.

### AgentNodeRun

Optional run-level trace for each state-machine node execution.

Fields:

- `id`: UUID
- `conversationId`: UUID
- `taskLogId`: UUID
- `nodeType`: AgentNodeType
- `agentType`: AgentType
- `sequence`: integer
- `stateBefore`: JSON nullable
- `stateAfter`: JSON nullable
- `status`: AgentRunStatus
- `createdAt`: datetime

Validation:

- Sequence increases within a conversation turn.
- State snapshots must be redacted to avoid sensitive leakage.

### ClarificationRequest

Represents a focused follow-up question from the clarification node.

Fields:

- `id`: UUID
- `conversationId`: UUID
- `taskLogId`: UUID
- `question`: string
- `reason`: string
- `status`: `OPEN` or `RESOLVED`
- `resolvedMessageId`: UUID nullable
- `createdAt`: datetime
- `resolvedAt`: datetime nullable

Validation:

- Questions must be focused and necessary.
- Open clarification pauses specialist routing for that turn.

### HumanEscalation

Represents handoff to a human support channel.

Fields:

- `id`: UUID
- `conversationId`: UUID
- `taskLogId`: UUID
- `requestedByUserId`: string
- `targetType`: `MANAGER`, `HR_BUSINESS_PARTNER`, `PEOPLE_TEAM`, `EMERGENCY_PROCESS`, `OTHER`
- `targetLabel`: string
- `reason`: string
- `summaryForHuman`: text
- `status`: `RECORDED`, `SENT`, `CANCELLED`, `RESOLVED`
- `createdAt`: datetime
- `updatedAt`: datetime

Validation:

- Summary must be neutral and avoid assigning blame.
- Safety-risk cases use `EMERGENCY_PROCESS` when indicated by the user.

### ResponseFeedback

Represents a user's feedback on an assistant response.

Fields:

- `id`: UUID
- `conversationId`: UUID
- `messageId`: UUID
- `userId`: string
- `rating`: FeedbackRating
- `comment`: string nullable
- `createdAt`: datetime

Validation:

- One feedback record per `(messageId, userId)` unless updates are explicitly supported.

### KnowledgeItem

Represents approved knowledge content available to General Help.

Fields:

- `id`: UUID
- `sourceType`: KnowledgeSourceType
- `sourceId`: string nullable
- `title`: string
- `contentHash`: string
- `status`: `ACTIVE`, `STALE`, `DELETED`
- `metadata`: JSON
- `createdAt`: datetime
- `updatedAt`: datetime

Relationships:

- One knowledge item has many vector documents/chunks.

Validation:

- Only approved company content is indexed.
- Deleted source documents mark related knowledge as deleted or stale.

### VectorDocument

Represents searchable chunks for handbook, policy, FAQ, or document-grounded answers.

Fields:

- `id`: UUID
- `knowledgeItemId`: UUID nullable
- `sourceType`: KnowledgeSourceType
- `sourceId`: string nullable
- `chunkIndex`: integer
- `content`: text
- `embedding`: vector-compatible field
- `metadata`: JSON
- `createdAt`: datetime

Validation:

- Chunk metadata must include source title and source version when available.
- General Help responses must cite source metadata, not raw internal IDs.

### PermissionDecisionRecord

Represents a routing or source-access decision for audit.

Fields:

- `id`: UUID
- `conversationId`: UUID nullable
- `taskLogId`: UUID
- `agentType`: AgentType
- `decision`: PermissionDecision
- `resourceType`: string
- `resourceId`: string nullable
- `reason`: string
- `createdAt`: datetime

Validation:

- Denied or partial decisions must be available to governance review.

## State Transitions

### Conversation

```text
ACTIVE -> ARCHIVED
ACTIVE -> DELETED
ARCHIVED -> ACTIVE
ARCHIVED -> DELETED
```

### Agent Run

```text
PENDING -> RUNNING -> SUCCESS
PENDING -> RUNNING -> PARTIAL
PENDING -> RUNNING -> DEGRADED
PENDING -> RUNNING -> ESCALATED
PENDING -> RUNNING -> REFUSED
PENDING -> RUNNING -> OUT_OF_SCOPE
PENDING -> RUNNING -> FAILED
```

### Human Escalation

```text
RECORDED -> SENT
RECORDED -> CANCELLED
SENT -> RESOLVED
```

## Indexes

- `conversations(ownerUserId, updatedAt desc)`
- `messages(conversationId, createdAt asc)`
- `agent_task_logs(conversationId, startedAt desc)`
- `agent_task_logs(parentLogId)`
- `agent_handoffs(conversationId, createdAt desc)`
- `response_feedback(messageId, userId)` unique
- `knowledge_items(sourceType, sourceId)`
- `vector_documents(knowledgeItemId, chunkIndex)`
- Vector similarity index on `vector_documents.embedding` when embeddings are enabled

## Retention and Privacy

- Conversation deletion removes the thread from user lists but keeps required audit records.
- Conversation titles and previews must be sanitized.
- Governance views use aggregate usage and safe summaries by default.
- Source summaries and graph state snapshots must not include sensitive data beyond the user's authorized context.
