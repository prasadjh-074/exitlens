export type Category = 'subscription' | 'consent'
export type Action =
  | 'Start free trial'
  | 'Subscribe'
  | 'Enable auto-renewal'
  | 'Accept cookies'
  | 'Reject cookies'
  | 'Customise preferences'
  | 'Withdraw consent'
  | 'Cancel subscription'
export type Verification =
  | 'Pending verification'
  | 'Partially verified'
  | 'Verified by observable evidence'
  | 'Unable to verify'
  | 'User marked as resolved'
export type Status =
  | 'Suspected'
  | 'Active'
  | 'Recorded'
  | 'Reversed'
  | 'Resolved'
export type Evidence = { at: number; text: string }
export interface Terms {
  trialDays: number | null
  initial: string | null
  recurring: string | null
  frequency: string | null
  renewal: string | null
  deadline: string | null
  autoRenew: string | null
  cancellation: string | null
  refund: string | null
  source: string[]
}
export interface Candidate {
  label: string
  url: string | null
  kind: 'link' | 'button'
  category: Category
  rank: number
  confirm: boolean
}
export interface Edge {
  from: string
  to: string
  label: string
  kind: 'link' | 'button'
  proof: 'Observed' | 'Discovered'
  evidence: string
  cost: number
  confidence: number
  obstacles: string[]
  confirm: boolean
}
export interface Snapshot {
  terms?: Terms
  page: string
  candidates: Candidate[]
  signals: string[]
  barriers: string[]
  simulated: boolean
}
export interface Click {
  label: string
  action: Action | null
  page: string
  terms: Terms
  choice: Candidate | null
  simulated: boolean
  entry: boolean
}
export interface RecordItem {
  id: string
  origin: string
  domain: string
  page: string
  category: Category
  action: Action
  at: number
  terms: Terms
  status: Status
  confidence: 'Observed choice' | 'Confirmed by page' | 'Suspected'
  verification: Verification
  verifiedAt: number | null
  simulated: boolean
  evidence: Evidence[]
  entry: Evidence[]
  reversal: Evidence[]
  completeEntry: boolean
  continuous: boolean
  edges: Edge[]
  current: string
  undoUrl: string | null
  barriers: string[]
  cookies: { before: string[] | null; after: string[] | null }
  domains: { host: string; at: number; tracker: boolean; simulated: boolean }[]
  inconsistent: boolean
}
export type Site = { origin: string; auditDemo: boolean }
export interface Database {
  sites: Site[]
  records: RecordItem[]
}
export interface TabMemory {
  origin: string
  record?: string
  guide?: string
  entry?: Evidence
  baseline?: string[]
  consent?: string
  consentAt?: number
  last?: Snapshot
  intent?: { id: string; at: number; category: Category }
  pending?: { page: string; choice: Candidate }
  touched?: number
}
export const EMPTY: Database = { sites: [], records: [] }
export const DEMO = 'http://127.0.0.1:4173'
export const FIXTURE = 'http://localhost:4173'
export function sitePattern(origin: string) {
  const url = new URL(origin)
  return url.protocol + '//' + url.hostname + '/*'
}
