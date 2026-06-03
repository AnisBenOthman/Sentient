# Quickstart: AI Module Scaffold

## Goal

Bring up the AI Agentic scaffold and validate the supervisor-agent conversation loop through the existing gateway in under 20 minutes.

## Prerequisites

- PostgreSQL container running with `hr_core`, `social`, and `ai_agent` schemas.
- `.env` files configured for HR Core, Social, AI Agentic, API Gateway, and Web.
- Feature branch `016-ai-module` checked out.

## 1. Install and Generate

```bash
pnpm install
pnpm --filter @sentient/ai-agentic prisma generate
```

## 2. Apply AI Agentic Migration

```bash
pnpm --filter @sentient/ai-agentic prisma migrate dev
```

Expected outcome:

- `ai_agent.conversations`
- `ai_agent.messages`
- `ai_agent.agent_task_logs`
- `ai_agent.agent_handoffs`
- `ai_agent.response_feedback`
- `ai_agent.knowledge_items`
- `ai_agent.vector_documents`
- `ai_agent.human_escalations`

## 3. Start Services

```bash
turbo dev --filter=hr-core --filter=social --filter=ai-agentic --filter=api-gateway --filter=web
```

Expected ports:

- Web: `http://localhost:3000`
- HR Core: `http://localhost:3001`
- Social: `http://localhost:3002`
- AI Agentic: `http://localhost:3003`
- API Gateway: `http://localhost:3004`

## 4. Health Check

```bash
curl http://localhost:3004/api/ai/health
```

Expected:

- service is `ai-agentic`
- supervisor is available
- specialist agent roster is listed
- status is `healthy` or `degraded` with a clear reason

## 5. Start a Conversation

Sign in through the web app or obtain a demo JWT, then call:

```bash
curl -X POST http://localhost:3004/api/ai/conversations \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"What is my leave balance and when was my last leave?\"}"
```

Expected:

- A conversation is created.
- A user message and assistant message are returned.
- Routing trace includes Supervisor -> Leave Agent -> Final Answer.
- Agent task logs are persisted.

## 6. Multi-Agent Manager Prompt

```bash
curl -X POST http://localhost:3004/api/ai/conversations \
  -H "Authorization: Bearer <MANAGER_JWT>" \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"Summarize leave coverage, OKR risk, and dashboard trends for my team.\"}"
```

Expected:

- Routing trace includes Leave, OKR, and Analytics agents.
- Each specialist returns control to Supervisor.
- Final answer separates each domain's contribution or limitation.

## 7. Clarification Prompt

```bash
curl -X POST http://localhost:3004/api/ai/conversations \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"Can you help me with my objective?\"}"
```

Expected:

- Routing trace includes Supervisor -> Ask User for Clarification -> Final Answer.
- Assistant asks one focused question rather than inventing context.

## 8. Out-of-Scope Prompt

```bash
curl -X POST http://localhost:3004/api/ai/conversations \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"Who won the World Cup?\"}"
```

Expected:

- Supervisor politely says this is outside Sentient scope.
- It does not answer the unrelated question.
- It offers examples of Sentient-related help.

## 9. Interpersonal Judgment Prompt

```bash
curl -X POST http://localhost:3004/api/ai/conversations \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"What do you think about my colleague? I did not appreciate his behavior.\"}"
```

Expected:

- Supervisor avoids judging the colleague.
- Response acknowledges the concern.
- Human Escalation Agent records a manager/People team handoff target or recommended channel.
- Final answer suggests contacting manager, HR business partner, or People team.

## 10. Feedback

```bash
curl -X PUT http://localhost:3004/api/ai/messages/<ASSISTANT_MESSAGE_ID>/feedback \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d "{\"rating\":\"POSITIVE\",\"comment\":\"Helpful and scoped.\"}"
```

Expected:

- Feedback row is stored.
- Duplicate feedback from the same user updates or replaces the prior row according to implementation contract.

## 11. Web Smoke

1. Open `http://localhost:3000`.
2. Sign in as Employee.
3. Open the AI Assistant page.
4. Ask about leave balance.
5. Ask an unrelated question.
6. Confirm the assistant stays polite and Sentient-scoped.
7. Sign in as Manager or HR Admin.
8. Ask for dashboard explanation and verify scoped output.

## 12. Verification Commands

```bash
pnpm --filter @sentient/ai-agentic type-check
pnpm --filter @sentient/ai-agentic test
pnpm --filter @sentient/web type-check
pnpm --filter @sentient/api-gateway test
```

## Expected Scaffold Deliverables

- Prisma schema and migration for AI module records.
- Conversation controller/service/DTOs.
- Supervisor graph service and node contracts.
- Specialist agent registry with deterministic scaffold behavior.
- Safety/scope guardrail service.
- Human escalation recorder.
- Response feedback endpoint.
- Governance aggregate endpoint.
- Web AI Assistant page and nav entry.
- Gateway `/api/ai` route remains unchanged and verified.

## Troubleshooting

- **401 through gateway**: Verify the demo JWT uses the same local secret as HR Core and API Gateway.
- **404 for `/api/ai/conversations`**: Confirm AI Agentic is running on port `3003` and gateway points `AI_AGENTIC_URL` to that port.
- **No Prisma client**: Run `pnpm --filter @sentient/ai-agentic prisma generate`.
- **Knowledge answers empty**: The scaffold may have no indexed documents yet; General Help should explain that approved knowledge content is unavailable rather than inventing policy.
