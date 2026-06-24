export type BusinessType = 'sole_trader' | 'oy' | 'ky' | 'toiminimi'

export type ExpenseCategory =
  | 'vehicle'
  | 'equipment'
  | 'travel'
  | 'software'
  | 'personnel'
  | 'other'

export type ChecklistModule =
  | 'balance_sheet'
  | 'pnl'
  | 'debt'
  | 'bookkeeping'
  | 'compliance'

export type ComplianceObligationType =
  | 'tyel'
  | 'yel'
  | 'vat_filing'
  | 'tax_prepayment'
  | 'salary_payer_reg'
  | 'annual_accounts'

export type ObligationStatus = 'upcoming' | 'due_soon' | 'overdue' | 'completed'

export type ChecklistStatus = 'pending' | 'in_progress' | 'completed' | 'skipped'

export type ReportType = 'balance_sheet' | 'pnl' | 'cash_flow' | 'custom'

export type AIRole = 'user' | 'assistant'

export type ConsultationStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled'

export type IntakeSessionStatus = 'in_progress' | 'completed'

export interface Profile {
  id: string
  business_name: string | null
  business_type: BusinessType | null
  industry: string | null
  founding_date: string | null
  employee_count: number | null
  is_salary_payer: boolean
  tyel_registered: boolean
  yel_registered: boolean
  vat_registered: boolean
  onboarding_completed: boolean
  created_at: string
}

export interface IntakeSession {
  id: string
  user_id: string
  status: IntakeSessionStatus
  current_step: number
  completed_at: string | null
}

export interface IntakeResponse {
  id: string
  session_id: string
  user_id: string
  question_key: string
  response_value: unknown
  answered_at: string
}

export interface FinancialSnapshot {
  id: string
  user_id: string
  snapshot_date: string
  bank_balance: number
  monthly_revenue: number
  monthly_costs: number
  accounts_receivable: number
  accounts_payable: number
  cash_runway_months: number
  net_profit_margin: number
  raw_data: Record<string, unknown>
}

export interface ExpenseTemplate {
  id: string
  user_id: string | null
  name: string
  category: ExpenseCategory
  default_amount: number | null
  vat_rate: number
  description_template: string | null
  is_system: boolean
}

export interface ExpenseLog {
  id: string
  user_id: string
  template_id: string | null
  amount: number
  vat_amount: number
  category: ExpenseCategory
  description: string
  date: string
  receipt_url: string | null
  created_at: string
}

export interface ChecklistDefinition {
  id: string
  module: ChecklistModule
  title: string
  description: string
  applicable_business_types: BusinessType[]
  requires_salary_payer: boolean
  sort_order: number
}

export interface ChecklistProgress {
  id: string
  user_id: string
  checklist_id: string
  status: ChecklistStatus
  notes: string | null
  completed_at: string | null
}

export interface ComplianceObligation {
  id: string
  user_id: string
  obligation_type: ComplianceObligationType
  due_date: string
  status: ObligationStatus
  notified_at: string | null
  notes: string | null
}

export interface AIConversation {
  id: string
  user_id: string
  title: string | null
  created_at: string
  last_message_at: string
}

export interface AIMessage {
  id: string
  conversation_id: string
  user_id: string
  role: AIRole
  content: string
  tool_calls: unknown | null
  created_at: string
}

export interface Report {
  id: string
  user_id: string
  report_type: ReportType
  period_start: string
  period_end: string
  file_url: string | null
  generated_by: 'system' | 'ai_bot' | 'user'
  created_at: string
}

export interface ConsultationRequest {
  id: string
  user_id: string
  topic: string
  preferred_date: string | null
  status: ConsultationStatus
  notes: string | null
  created_at: string
}
