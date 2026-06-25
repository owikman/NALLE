# NALLE — Technical Architecture & Project Structure

## Overview

NALLE is a full-stack AI-powered financial management platform for Finnish entrepreneurs and small business owners. It is built as a monorepo housing a Next.js web app, a React Native mobile app, and shared packages — all backed by Supabase.

---

## Monorepo Structure

```
nalle/
├── apps/
│   ├── web/                        # Next.js 14 (App Router)
│   └── mobile/                     # React Native (Expo)
├── packages/
│   ├── types/                      # Shared TypeScript types & interfaces
│   ├── ui/                         # Shared UI primitives (web + RN variants)
│   ├── api-client/                 # Typed Supabase query helpers
│   └── financial-utils/            # Calculations, formatters, Finnish tax logic
├── supabase/
│   ├── migrations/                 # SQL migration files
│   ├── seed.sql                    # Dev seed data
│   └── functions/                  # Supabase Edge Functions
├── turbo.json                      # Turborepo pipeline config
├── package.json                    # Workspace root
└── .env.example
```

**Tooling:** Turborepo for build orchestration, pnpm workspaces, TypeScript project references across all packages.

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Web frontend | Next.js 14 App Router | Server components, API routes, SSR for reports |
| Mobile | Expo (React Native) | Managed workflow, OTA updates, push notifications |
| Backend / DB | Supabase (PostgreSQL) | Auth, RLS, Realtime, Storage, Edge Functions |
| AI bot | Anthropic Claude API | Streaming chat, tool use for report generation |
| Styling (web) | Tailwind CSS + shadcn/ui | Rapid, accessible component library |
| Styling (mobile) | NativeWind | Tailwind-compatible classes in React Native |
| State management | Zustand (local) + TanStack Query (server) | Lightweight, works across web and mobile |
| Charts | Recharts (web) / Victory Native (mobile) | Finnish-friendly number formatting |
| File exports | xlsx + pdf-lib | Excel and PDF report generation |
| Notifications | Supabase Realtime + Expo Push | Compliance deadline reminders |

---

## Database Schema

All tables implement Row Level Security (RLS). Users only ever access their own rows.

### `profiles`
Extends Supabase `auth.users`. Stores business context.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | References auth.users |
| business_name | text | |
| business_type | enum | sole_trader, oy, ky, toiminimi |
| industry | text | |
| founding_date | date | |
| employee_count | integer | |
| is_salary_payer | boolean | Triggers compliance reminders |
| tyel_registered | boolean | |
| yel_registered | boolean | |
| vat_registered | boolean | |
| onboarding_completed | boolean | |
| created_at | timestamptz | |

### `intake_sessions`
Tracks progress through the guided financial questionnaire.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| status | enum | in_progress, completed |
| current_step | integer | |
| completed_at | timestamptz | |

### `intake_responses`
Individual answers within an intake session.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| session_id | uuid FK | |
| user_id | uuid FK | |
| question_key | text | e.g. "bank_balance_current" |
| response_value | jsonb | Flexible: number, text, array |
| answered_at | timestamptz | |

### `financial_snapshots`
Aggregated financial state computed after each intake completion.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| snapshot_date | date | |
| bank_balance | numeric | |
| monthly_revenue | numeric | |
| monthly_costs | numeric | |
| accounts_receivable | numeric | |
| accounts_payable | numeric | |
| cash_runway_months | numeric | Calculated |
| net_profit_margin | numeric | Calculated |
| raw_data | jsonb | Full intake response dump |

### `expense_templates`
Reusable templates for fast expense logging.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | Null = system template |
| name | text | e.g. "Vehicle — Business Trip" |
| category | enum | vehicle, equipment, travel, software, personnel, other |
| default_amount | numeric | Optional |
| vat_rate | numeric | Finnish VAT: 0, 10, 14, 25.5 |
| description_template | text | Pre-filled description |
| is_system | boolean | |

### `expense_logs`
Individual expense entries.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| template_id | uuid FK | Nullable |
| amount | numeric | |
| vat_amount | numeric | |
| category | enum | |
| description | text | |
| date | date | |
| receipt_url | text | Supabase Storage path |
| created_at | timestamptz | |

### `checklist_definitions`
Master list of checklist items (seeded, not user-created).

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| module | enum | balance_sheet, pnl, debt, bookkeeping, compliance |
| title | text | |
| description | text | |
| applicable_business_types | text[] | Filter by business type |
| requires_salary_payer | boolean | Conditional display |
| sort_order | integer | |

### `checklist_progress`
Per-user completion state for each checklist item.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| checklist_id | uuid FK | |
| status | enum | pending, in_progress, completed, skipped |
| notes | text | |
| completed_at | timestamptz | |

### `compliance_obligations`
Finnish regulatory deadlines and reminders.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| obligation_type | enum | tyel, yel, vat_filing, tax_prepayment, salary_payer_reg, annual_accounts |
| due_date | date | |
| status | enum | upcoming, due_soon, overdue, completed |
| notified_at | timestamptz | |
| notes | text | |

### `ai_conversations`
Persistent chat history for the AI CFO bot.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| title | text | Auto-generated from first message |
| created_at | timestamptz | |
| last_message_at | timestamptz | |

### `ai_messages`
Individual messages within a conversation.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| conversation_id | uuid FK | |
| user_id | uuid FK | |
| role | enum | user, assistant |
| content | text | |
| tool_calls | jsonb | For report generation tool results |
| created_at | timestamptz | |

### `reports`
Generated financial documents.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| report_type | enum | balance_sheet, pnl, cash_flow, custom |
| period_start | date | |
| period_end | date | |
| file_url | text | Supabase Storage |
| generated_by | enum | system, ai_bot, user |
| created_at | timestamptz | |

### `consultation_requests`
Premium advisory booking.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| topic | text | |
| preferred_date | timestamptz | |
| status | enum | pending, confirmed, completed, cancelled |
| notes | text | |
| created_at | timestamptz | |

---

## Supabase Edge Functions

| Function | Trigger | Purpose |
|---|---|---|
| `intake-complete` | HTTP POST | Computes and stores a financial snapshot after intake |
| `generate-report` | HTTP POST | Builds Excel/PDF, uploads to Storage, returns URL |
| `ai-chat` | HTTP POST (streaming) | Proxies Claude API with user financial context injected |
| `compliance-scheduler` | Cron (daily) | Checks upcoming Finnish deadlines, inserts obligations |
| `send-push-notification` | DB trigger | Fires Expo push on new compliance_obligation row |

---

## Web App Structure (`apps/web`)

```
apps/web/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── signup/
│   ├── (dashboard)/
│   │   ├── layout.tsx              # Sidebar navigation shell
│   │   ├── page.tsx                # Dashboard home / KPI overview
│   │   ├── intake/
│   │   │   └── [step]/page.tsx     # Step-by-step questionnaire
│   │   ├── expenses/
│   │   │   ├── page.tsx            # Expense log list
│   │   │   └── new/page.tsx        # Log expense (template picker)
│   │   ├── checklists/
│   │   │   └── [module]/page.tsx   # Checklist per module
│   │   ├── reports/
│   │   │   ├── page.tsx            # Report history
│   │   │   └── [id]/page.tsx       # Report viewer
│   │   ├── compliance/
│   │   │   └── page.tsx            # Finnish obligations tracker
│   │   ├── chat/
│   │   │   ├── page.tsx            # Conversation list
│   │   │   └── [id]/page.tsx       # AI CFO chat
│   │   └── consultation/
│   │       └── page.tsx            # Book an advisor
│   └── api/
│       ├── intake/route.ts
│       ├── expenses/route.ts
│       ├── reports/route.ts
│       └── chat/route.ts           # Streaming SSE to Claude
├── components/
│   ├── intake/
│   │   ├── QuestionnaireShell.tsx
│   │   ├── QuestionStep.tsx
│   │   └── ProgressBar.tsx
│   ├── expenses/
│   │   ├── TemplateGrid.tsx
│   │   └── ExpenseForm.tsx
│   ├── dashboard/
│   │   ├── KPICard.tsx
│   │   ├── CashRunwayChart.tsx
│   │   ├── PnLChart.tsx
│   │   └── HealthScore.tsx
│   ├── chat/
│   │   ├── ChatWindow.tsx
│   │   ├── MessageBubble.tsx
│   │   └── StreamingCursor.tsx
│   └── shared/
│       ├── Sidebar.tsx
│       └── NotificationBell.tsx
└── lib/
    ├── supabase/
    │   ├── client.ts               # Browser client
    │   └── server.ts               # Server component client
    ├── ai/
    │   └── context-builder.ts      # Assembles financial context for Claude
    └── reports/
        ├── excel.ts
        └── pdf.ts
```

---

## Mobile App Structure (`apps/mobile`)

```
apps/mobile/
├── app/                            # Expo Router file-based routing
│   ├── (auth)/
│   │   ├── login.tsx
│   │   └── signup.tsx
│   ├── (tabs)/
│   │   ├── _layout.tsx             # Bottom tab navigator
│   │   ├── index.tsx               # Dashboard
│   │   ├── expenses.tsx            # Quick expense log
│   │   ├── chat.tsx                # AI CFO chat
│   │   └── more.tsx                # Checklists, compliance, settings
│   └── intake/
│       └── [step].tsx
├── components/
│   ├── expenses/
│   │   ├── QuickLogSheet.tsx       # Bottom sheet for fast entry
│   │   └── TemplateCarousel.tsx
│   ├── dashboard/
│   │   ├── MetricCard.tsx
│   │   └── MiniChart.tsx
│   └── chat/
│       ├── ChatBubble.tsx
│       └── VoiceInputButton.tsx    # Native voice to text
├── lib/
│   ├── supabase.ts
│   ├── notifications.ts            # Expo Push setup
│   └── offline-queue.ts            # Queue expense logs when offline
└── app.json
```

---

## Shared Packages

### `packages/types`
Single source of truth for all TypeScript interfaces mirroring the database schema. Both apps import from here — no duplicated types.

Key exports: `Profile`, `IntakeResponse`, `ExpenseLog`, `ExpenseTemplate`, `ChecklistItem`, `ComplianceObligation`, `AIMessage`, `Report`, `FinancialSnapshot`

### `packages/api-client`
Typed wrapper functions over Supabase queries. Both apps call the same functions — no duplicated query logic.

Key modules: `intake`, `expenses`, `checklists`, `compliance`, `reports`, `chat`

### `packages/financial-utils`
Pure calculation functions with no framework dependencies.

Key functions: `computeCashRunway`, `computeNetMargin`, `computeVAT`, `formatEUR`, `generateComplianceDates` (Finnish calendar logic)

### `packages/ui`
Shared design tokens (colors, spacing, typography). Web-specific and native-specific component variants exported from the same import path via package.json `exports` field.

---

## AI Bot Architecture

The CFO bot uses Claude with a structured system prompt that injects the user's live financial context on every request.

**Context assembled per request:**
- Latest `financial_snapshot`
- Last 90 days of `expense_logs` (summarized by category)
- Open `compliance_obligations`
- Incomplete `checklist_progress` items
- Business profile (type, VAT status, employee count)

**Tool definitions exposed to Claude:**
- `generate_report(type, period)` — triggers Edge Function, returns download URL
- `get_expense_breakdown(category, period)` — queries Supabase, returns structured data
- `get_compliance_deadlines()` — returns upcoming Finnish obligations
- `update_checklist_item(id, status)` — marks items complete from chat

**Streaming:** The Edge Function proxies Claude's streaming response via SSE. Both web and mobile consume the same endpoint.

---

## Authentication & Security

- Supabase Auth with email/password and magic link
- JWT stored in httpOnly cookies on web, SecureStore on mobile
- All tables protected by RLS policies: `user_id = auth.uid()`
- Financial data fields encrypted at rest via Supabase Vault for PII columns
- Edge Functions validate JWT before any data access
- No financial data stored in AI message history — context is injected fresh each request, never persisted in Claude

---

## Finnish Compliance Logic

The compliance scheduler runs daily and generates obligations based on:

| Business state | Generated obligation |
|---|---|
| `is_salary_payer = true` | Monthly TyEL payment reminders |
| `yel_registered = false` | YEL registration prompt |
| `vat_registered = true` | Quarterly VAT filing deadlines |
| Any Oy | Annual accounts filing (4 months after fiscal year end) |
| Any business | Quarterly tax prepayment dates |

Dates are computed against the Finnish tax calendar (Vero.fi schedule).

---

## Business Model

NALLE is a three-tier product:

| Tier | What you get |
|---|---|
| **Free** | Dashboard, expenses, checklists, compliance alerts, basic AI chat |
| **Premium** | AI-generated financial plans — growth roadmap, tax optimization strategy, cash flow improvement plan |
| **Add-on** | A human advisor reviews and presents the AI-generated plan to you |

The core insight: NALLE does the analysis. The premium product is the plan itself, not access to a human. Human advisors are optional and additive — they present AI output, they don't replace it.

---

## Development Phases

| Phase | Scope |
|---|---|
| 1 | Monorepo scaffold, Supabase schema, auth, profile creation ✅ |
| 2 | Financial intake questionnaire ✅ |
| 3 | Expense logging with templates ✅ |
| 4 | Dashboard with KPI visualization ✅ |
| 5 | AI CFO bot with streaming chat ✅ |
| 6 | Checklist modules ✅ |
| 7 | Finnish compliance tracker ✅ |
| 8 | Report generation (Excel) ✅ |
| 9 | Premium plans — AI generates personalized financial plans (growth, tax, cash flow); plans gated behind paywall; optional human advisor review layer |
| 10 | Production hardening, RLS audit, performance |
