# Sentient Competitive Benchmark Report

> **Date:** 2026-04-03
> **Scope:** Sentient vs. ServiceNow HRSD vs. Cornerstone OnDemand vs. Deel AI
> **Purpose:** Inform Sentient's feature roadmap with evidence-based competitive intelligence

---

## 1. Comparative Benchmark Table

| Capability | Sentient (Current Architecture) | ServiceNow HRSD | Cornerstone OnDemand | Deel AI |
|---|---|---|---|---|
| **Platform Type** | Integrated HRIS + AI Agent Platform | HR Service Delivery Layer (not core HRIS) | Talent/Learning Management Suite | Global Payroll & Compliance Platform |
| | | | | |
| **Core HRIS** | ✅ Full (Employee, Dept, Team, Position, JobHistory, SalaryHistory, ContractAmendment) | ❌ Service delivery only — integrates with Workday/SAP for HRIS | ❌ No core HRIS — integrates with external HRIS | ⚠️ Partial (global payroll focus, basic employee records) |
| **Leave Management** | ✅ Native (LeaveType, LeaveBalance, LeaveRequest + AI risk assessment) | ❌ Delegates to external HRIS | ❌ Not available | ✅ Native (Deel PTO — per-country policies, accruals) |
| **Onboarding** | ✅ Onboarding Companion Agent + Probation lifecycle (ProbationPolicy, ProbationPeriod, ProbationEvaluation) | ✅ Lifecycle Events (cross-dept task orchestration) | ⚠️ Basic (learning-path onboarding only) | ✅ Automated flows (doc collection, equipment via Deel IT, compliance) |
| **Performance Reviews** | ✅ Native (PerformanceReview — multi-dimensional ratings, self + manager) | ❌ Not native | ✅ Strong (goals, 360 feedback, calibration, succession planning) | ✅ Via Deel Engage (OKRs, review cycles, feedback) |
| **Contract Amendments** | ✅ Native (à-la-carte delta: position, salary, contract type, transfer — Manager→HR approval) | ❌ Not available | ❌ Not available | ⚠️ AI contract generation, but for new hires — no amendment workflow |
| **Engagement** | ✅ Native (Feedback, EngagementSnapshot + AI Engagement Agent for anonymous synthesis) | ❌ Not native | ⚠️ Basic pulse surveys | ✅ Pulse surveys via Deel Engage |
| | | | | |
| **AI Architecture** | **LangGraph Stateful Agents** (7 agents with ToolRegistry, multi-step reasoning, state machines) | **Now Assist** (GenAI layer) + Virtual Agent (NLU chatbot) + Predictive Intelligence (ML classification) | **Galaxy AI** (ML recommendations, skills inference, content matching) | **Deel AI Assistant** (conversational AI, compliance-trained) |
| **Agentic / Autonomous AI** | ✅ **True agentic** — agents reason, plan, call tools, take multi-step actions (e.g., Leave Agent checks balance → team availability → risk assessment → submits) | ❌ Not agentic — Virtual Agent is reactive chatbot; workflows are rule-triggered | ❌ Not agentic — ML recommendation/nudge model only | ❌ Not agentic — reactive Q&A assistant |
| **Push Model (Proactive)** | ✅ Designed from day 1 — Engagement Agent synthesizes post-event, Onboarding Companion schedules check-ins, Leave Agent alerts on overlap | ⚠️ Rule-based reminders only (enrollment deadlines, task nudges) | ⚠️ ML-triggered learning nudges and compliance reminders | ⚠️ Rule-based compliance alerts (law changes, visa deadlines) |
| **Conversational AI** | ✅ HR Assistant (RAG Q&A), Linguistic Agent (reformulation), Career Agent (profile analysis) | ✅ Virtual Agent with pre-built HR topics + Now Assist response drafting | ❌ No conversational AI | ✅ Deel AI Chat for payslips, PTO, compliance questions |
| **RAG Pipeline** | ✅ Native (pgvector embeddings, document chunking, VectorDocument entity, hybrid SQL+vector queries) | ✅ Now Assist grounded generation from KB + AI Search (semantic/vector search, Washington DC release) | ❌ No RAG — uses structured metadata matching | ⚠️ Likely RAG over compliance KB (cited sources), but unconfirmed architecture |
| **Text-to-SQL Analytics** | ✅ Analytics Agent generates SQL from natural language, scope-wrapped, read-only role, result limits | ❌ Not available (uses Performance Analytics dashboards) | ❌ Not available | ❌ Not available |
| **Multi-Channel** | ✅ Designed for Web, Slack, WhatsApp (via Twilio), Email, In-App — with Session.channel tracking | ✅ Web Portal, Slack, Teams — no native WhatsApp | ⚠️ Web + Mobile app only | ⚠️ Web + Slack only |
| | | | | |
| **RBAC** | ✅ Granular (Resource + Action + Scope: OWN/TEAM/DEPARTMENT/GLOBAL) with row-level filtering | ✅ ACLs on every table/record, Before Business Rules for row-level security | ✅ Granular per org-unit/user/content | ✅ Admin/Manager/Finance/Employee roles, per-country permissions |
| **AI Governance** | ✅ Agents inherit user JWT scope, AgentTaskLog audit trail, Text-to-SQL guardrails (read-only role, scope wrapping, PII masking, result limits) | ✅ Prompt grounding, PII masking, audit logs, per-module AI feature toggles | ⚠️ Limited public documentation on AI explainability | ⚠️ Disclaimers on AI output, legal team review — limited formal framework |
| **Data Privacy** | ✅ Per-schema DB isolation, per-service PostgreSQL roles, field-level classification (CONFIDENTIAL/PII/RESTRICTED), response sanitization interceptor | ✅ Field-level encryption, data classification | ✅ GDPR, SOC 2, data residency | ✅ GDPR, SOC 2 Type II, ISO 27001, SCCs for cross-border |
| | | | | |
| **Skills Management** | ✅ Native (Skill, EmployeeSkill) — Career Agent analyzes profiles | ❌ Not native (integrates with talent platforms) | ✅ **Industry-leading** (Skills Graph, skills inference, gap analysis, Opportunity Marketplace, career pathing) | ❌ Not available |
| **Learning / LMS** | ❌ Not in scope | ❌ Not native | ✅ **Industry-leading** (LMS, content curation, AI recommendations, compliance training) | ❌ Not available |
| **Global Compliance** | ❌ Not in scope (single-org focus) | ⚠️ Basic (US-centric HR policies) | ❌ Not a focus | ✅ **Industry-leading** (150+ countries, auto-classification, local labor law, visa tracking) |
| **Payroll** | ❌ Not in scope | ❌ Delegates to external systems | ❌ Not available | ✅ **Industry-leading** (100+ countries, tax calculations, currency conversion) |

---

## 2. Gap Analysis

### High Priority — Strategic Gaps That Strengthen Sentient's Core

| Gap | Present In | Priority | Rationale |
|---|---|---|---|
| **Skills Intelligence & Career Pathing** | Cornerstone (Skills Graph, Opportunity Marketplace) | 🔴 High | Sentient has Skill/EmployeeSkill entities and a Career Agent — but lacks automated skills gap detection, skills inference from job history, and internal opportunity matching. This is a natural extension of the existing Career Agent. |
| **Compliance / Policy Change Tracking** | Deel (auto-detect regulatory changes, contract updates) | 🔴 High | Sentient's HR Assistant answers policy questions via RAG, but has no mechanism to detect when source policies change and proactively notify affected employees or trigger contract amendments. This is a true agentic opportunity. |
| **Knowledge Article Lifecycle** | ServiceNow (AI-generated KB articles, contextual surfacing, freshness tracking) | 🟡 Medium | Sentient's RAG pipeline ingests documents, but there's no feedback loop: no tracking of which documents are stale, no auto-generation of knowledge articles from resolved cases, no citation scoring. |
| **Case Management / Ticketing** | ServiceNow (tiered case model, SLAs, escalation) | 🟡 Medium | Sentient has Complaint entity and Notification, but no formal HR case/ticket lifecycle with SLA tracking and tiered escalation. Complaints and leave escalations would benefit from this. |
| **Learning Management Integration** | Cornerstone (LMS, content recommendations) | 🟡 Medium | Not core to Sentient's HRIS mission, but a Document entity in Social + RAG pipeline could serve as a lightweight training content recommender without building a full LMS. |
| **Workflow Builder / No-Code Automation** | ServiceNow (Flow Designer) | 🟠 Low | Sentient's EventBus + agents handle workflows, but HR admins cannot create custom workflows without code. Low priority for FYP scope — code-defined workflows are sufficient. |
| **Global Multi-Jurisdiction Support** | Deel (150+ countries) | 🟠 Low | Sentient is single-org focused. Global compliance is a different product category entirely. Not relevant for FYP. |

### Capabilities Where Sentient Already Leads

| Capability | Sentient's Advantage | Competitors' Status |
|---|---|---|
| **True Agentic AI** | 7 LangGraph agents with multi-step reasoning, tool calling, state machines, and push model | None have autonomous agents — all are reactive (chatbot) or rule-based (workflow triggers) |
| **Push Model / Proactive AI** | Agents act before employees ask (engagement synthesis, onboarding check-ins, leave overlap alerts) | All three rely on rule-based reminders, not AI-driven proactive actions |
| **Unified HRIS + AI Platform** | Single platform with core HR, social/intranet, and AI agents sharing one database | ServiceNow and Cornerstone require external HRIS integration; Deel lacks AI depth |
| **Text-to-SQL Analytics** | Natural language → SQL with scope wrapping, read-only role, PII masking | None of the three offer this |
| **AI Governance by Design** | JWT scope inheritance, AgentTaskLog audit, per-field data classification, sanitization interceptor | ServiceNow approaches this but others are weak |
| **Contract Amendment Workflow** | À-la-carte delta model with Manager→HR approval chain | None of the three have a comparable structured amendment workflow |
| **WhatsApp Channel** | Native via Twilio + Session.channel tracking | None offer native WhatsApp for HR AI |

---

## 3. Recommended Features to Add

### Tier 1 — High Impact, Fits Existing Architecture

#### 3.1 Skills Intelligence Engine (Extend Career Agent)

**What:** Enhance the existing Career Agent and Skill/EmployeeSkill entities with:
- **Automated skills inference** from JobHistory transitions and PerformanceReview ratings
- **Skills gap detection** comparing current EmployeeSkill records against Position requirements
- **Internal opportunity matching** based on skills adjacency scores

**Why:** Cornerstone's Skills Graph is their #1 differentiator. Sentient already has the data model (Skill, EmployeeSkill, Position, JobHistory, PerformanceReview) and the Career Agent. Adding inference logic in the AI Agentic service makes this achievable without new entities.

**How it fits:**
- **Service:** AI Agentic (Career Agent extension)
- **Data source:** HR Core REST calls (GET /api/hr/employees/:id/skills, GET /api/hr/positions/:id)
- **Storage:** VectorDocument for skills embeddings, or a new `SkillRecommendation` log in AgentTaskLog
- **Push model:** Career Agent proactively alerts employees: *"Based on your 2 years as Senior Dev and recent performance ratings, you're 85% matched for the Tech Lead role — here's the skills gap: [System Design, Team Leadership]"*

---

#### 3.2 Policy Change Detection Agent (New Push Capability)

**What:** A new proactive capability for the HR Assistant agent:
- Monitor Document entity for updates (Social emits `document.uploaded` / `document.updated`)
- Diff old vs. new document content using embeddings similarity
- Identify affected employees based on department/role/leave-type
- Proactively notify them: *"The remote work policy was updated yesterday — here's what changed for your department"*

**Why:** Deel auto-detects compliance changes. ServiceNow tracks KB freshness. Neither uses AI to proactively explain changes to affected employees. This is a true agentic differentiator.

**How it fits:**
- **Trigger:** `document.uploaded` event consumed by AI Agentic
- **Agent:** HR Assistant Agent (extended with diff capability)
- **Output:** Targeted Notification via HR Core REST API
- **Domain event:** `agent.policy_change_detected` → HR Core

---

#### 3.3 HR Case Lifecycle (Lightweight Ticketing)

**What:** Evolve the Complaint entity into a general-purpose `HrCase` entity:
- Case types: COMPLAINT, LEAVE_ESCALATION, AMENDMENT_DISPUTE, GENERAL_INQUIRY
- Status lifecycle: OPEN → IN_PROGRESS → PENDING_EMPLOYEE → RESOLVED → CLOSED
- SLA tracking: `dueDate`, `slaBreached` flag
- Assignment: `assignedToId` (HR agent handling the case)

**Why:** ServiceNow's core strength is tiered case management. Sentient handles complaints but lacks a unified case model. When a leave request is escalated or a contract amendment is disputed, there's no formal case tracking.

**How it fits:**
- **Service:** HR Core (new `hr-cases/` module, replaces or extends `complaints/`)
- **Entity:** `HrCase` in `hr_core` schema (replaces Complaint or Complaint becomes a case type)
- **AI integration:** Agents auto-create cases on escalation events; HR Assistant can summarize open cases for HR admins
- **Domain events:** `case.opened`, `case.resolved`, `case.sla_breached`

---

### Tier 2 — Medium Impact, Nice-to-Have for FYP

#### 3.4 RAG Feedback Loop (Citation Quality Tracking)

**What:** Track which VectorDocument chunks are cited in HR Assistant responses, and whether employees found them helpful:
- Add `citationCount`, `helpfulCount`, `lastCitedAt` to VectorDocument
- Surface "stale document" alerts when a document hasn't been cited or updated in 90+ days
- Auto-suggest knowledge gaps when the HR Assistant falls back to generic LLM responses (no relevant chunks retrieved)

**Why:** ServiceNow's KB lifecycle management is mature. Sentient's RAG pipeline currently has no feedback signal. This closes the loop.

**How it fits:**
- **Service:** AI Agentic (extend RAG pipeline)
- **Storage:** Update VectorDocument metadata fields
- **Push model:** Alert HR admins about stale/missing knowledge: *"15 employees asked about parental leave policy this month, but no matching documents exist"*

---

#### 3.5 Engagement Pulse Surveys (Structured Collection)

**What:** Add a lightweight survey mechanism to the Social service:
- `Survey` entity (created by HR Admin, contains questions)
- `SurveyResponse` entity (anonymous or attributed, linked to Survey)
- Engagement Agent auto-synthesizes results into EngagementSnapshot

**Why:** Both Cornerstone and Deel offer pulse surveys. Sentient's Feedback entity is event-linked but doesn't support structured, scheduled organization-wide surveys. The Engagement Agent already synthesizes feedback — adding structured surveys gives it richer input.

**How it fits:**
- **Service:** Social (new entities: Survey, SurveyResponse)
- **AI integration:** Engagement Agent consumes `survey.completed` events, generates AI-powered synthesis
- **Push model:** Agent proactively triggers: *"Q1 engagement scores dropped 12% in Engineering — top concern: work-life balance"*

---

### Tier 3 — Low Priority / Out of FYP Scope

| Feature | Inspired By | Why Low Priority |
|---|---|---|
| No-code workflow builder | ServiceNow Flow Designer | Code-defined agents + EventBus sufficient for FYP |
| Global multi-jurisdiction compliance | Deel | Entirely different product scope |
| Full LMS / learning management | Cornerstone | Sentient is HRIS + AI, not a learning platform |
| Succession planning | Cornerstone | Complex module, low ROI for 6-month FYP |

---

## 4. Strategic Positioning Summary

```
                    Reactive ◄────────────────────────► Proactive/Agentic
                         │                                    │
  Cornerstone ●──────────┤                                    │
  (ML recommendations)   │                                    │
                         │                                    │
  Deel AI ●──────────────┤                                    │
  (Reactive Q&A +        │                                    │
   rule-based alerts)    │                                    │
                         │                                    │
  ServiceNow ●───────────┤                                    │
  (Virtual Agent +       │                                    │
   workflow automation)  │                                    │
                         │                                    │
                         │                          ●──────── Sentient
                         │                   (LangGraph agents,
                         │                    push model,
                         │                    autonomous multi-step
                         │                    reasoning)
```

**Sentient's moat is agentic AI.** No competitor has agents that autonomously reason, plan multi-step actions, and proactively push insights. The platforms benchmarked are either:
- **Service delivery layers** (ServiceNow) that require external HRIS
- **Talent/learning suites** (Cornerstone) with ML recommendations but no conversational AI
- **Global compliance engines** (Deel) with reactive Q&A

Sentient is the only platform architected from day one for autonomous HR agents that **inherit user permissions, audit every action, and act before employees ask**.

The recommended additions (Skills Intelligence, Policy Change Detection, HR Case Lifecycle) strengthen this position by giving agents more data to reason over and more actions to take — deepening the moat rather than chasing features that belong to different product categories.

---

*Report generated for Sentient FYP — Stage 1 Architecture & Design*
