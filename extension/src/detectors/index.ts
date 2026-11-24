import { DEMO, FIXTURE, STILLFRAME_PATH } from '../types'
import type { Action, Candidate, Terms } from '../types'
const contextualConsent = /\b(cookies?|tracking|advertising|consent)\b/i
const contextualPlan =
  /\b(trial|billed|billing|subscription|per month|per year|renewal)\b/i
export const categoryOf = (action: Action) =>
  /cookies|consent|preferences/i.test(action) ? 'consent' : 'subscription'

export function classify(name: string, context: string): Action | null {
  const text = name.trim().replace(/\s+/g, ' ')
  if (
    /^(withdraw|revoke) (my |all )?(cookie |tracking |advertising )?consent$/i.test(
      text,
    )
  )
    return 'Withdraw consent'
  if (/^(accept|allow)$/i.test(text) && contextualConsent.test(context))
    return 'Accept cookies'
  if (/^(reject|decline)$/i.test(text) && contextualConsent.test(context))
    return 'Reject cookies'
  if (
    /^(accept|allow) (all( cookies)?|cookies|(?:optional|additional) cookies)$/i.test(
      text,
    ) &&
    contextualConsent.test(text + ' ' + context)
  )
    return 'Accept cookies'
  if (
    /^(reject|decline|refuse) (all( cookies)?|cookies|(?:optional|additional) cookies|advertising cookies)$/i.test(
      text,
    ) &&
    contextualConsent.test(text + ' ' + context)
  )
    return 'Reject cookies'
  if (
    /^(customi[sz]e|manage|save) (cookie |privacy )?preferences$/i.test(text) &&
    contextualConsent.test(context)
  )
    return 'Customise preferences'
  if (
    /^(start|activate|begin) (my |your |a )?(\d+[- ]day )?(free )?trial$/i.test(
      text,
    )
  )
    return 'Start free trial'
  if (
    /^subscribe( now)?$/i.test(text) &&
    contextualPlan.test(context) &&
    !/newsletter/i.test(context)
  )
    return 'Subscribe'
  if (/^(enable|turn on) auto[- ]renewal$/i.test(text))
    return 'Enable auto-renewal'
  if (
    /^(confirm cancellation|cancel (my |your )?(subscription|membership|plan))$/i.test(
      text,
    )
  )
    return 'Cancel subscription'
  return null
}
// A restricted vocabulary keeps free-form labels, account identifiers, search strings and fragment tokens out of history.
const allowedSegment =
  /^(?:[a-z]{2}(?:-[a-z]{2})?|accounts?|settings|preferences|manage|management|subscriptions?|memberships?|plans?|billing|privacy|cookies?|consent|tracking|trial|offer|terms|checkout|welcome|dashboard|cancel|cancellation|retention|verify|verification|confirm|confirmation|cancelled|canceled|status|success|complete|profile|home|legal|premium|join|free-trial|account-settings|manage-subscription|privacy-settings|cookie-settings)$/i
export function safeUrl(raw: string, origin: string): string | null {
  try {
    const u = new URL(raw, origin)
    if (
      !/^https?:$/.test(u.protocol) ||
      u.origin !== origin ||
      u.username ||
      u.password ||
      u.search ||
      u.hash ||
      !(
        u.pathname.split('/').every((s) => !s || allowedSegment.test(s)) ||
        ((origin === DEMO || origin === FIXTURE) && u.pathname === STILLFRAME_PATH)
      )
    )
      return null
    return u.origin + u.pathname
  } catch {
    return null
  }
}
export const pageKey = (url: string, origin: string) =>
  safeUrl(url, origin) ?? origin + '/[private path]'
const options: [RegExp, string, Candidate['category'], number, boolean][] = [
  [/^confirm cancellation$/i, 'Confirm cancellation', 'subscription', 10, true],
  [
    /^cancel (my |your )?(subscription|plan|membership)$/i,
    'Cancel subscription',
    'subscription',
    9,
    true,
  ],
  [
    /^(continue (to |with )?cancellation|decline offer and continue)$/i,
    'Continue cancellation',
    'subscription',
    9,
    false,
  ],
  [
    /^(continue to confirmation|continue after verification)$/i,
    'Continue to confirmation',
    'subscription',
    9,
    false,
  ],
  [
    /^complete human verification$/i,
    'Complete human verification',
    'subscription',
    8,
    false,
  ],
  [
    /^use accessible verification$/i,
    'Use accessible verification',
    'subscription',
    8,
    false,
  ],
  [
    /^(manage (my )?(subscription|plan|membership)|subscription settings|billing settings)$/i,
    'Manage subscription',
    'subscription',
    7,
    false,
  ],
  [
    /^(account settings|my account|manage account)$/i,
    'Account settings',
    'subscription',
    4,
    false,
  ],
  [
    /^(withdraw|revoke) (my |all )?(cookie |advertising |tracking )?consent$/i,
    'Withdraw consent',
    'consent',
    10,
    true,
  ],
  [
    /^(reject|decline) (all( cookies)?|(?:optional|additional) cookies|advertising cookies|cookies)$/i,
    'Reject cookies',
    'consent',
    9,
    true,
  ],
  [
    /^(cookie settings|privacy settings|privacy preferences|manage (cookie|privacy) preferences)$/i,
    'Privacy settings',
    'consent',
    7,
    false,
  ],
]
export function candidate(
  name: string,
  kind: Candidate['kind'],
  url: string | null,
): Candidate | null {
  const opt = options.find(([regex]) => regex.test(name.trim()))
  return opt
    ? {
        label: opt[1],
        category: opt[2],
        rank: opt[3],
        confirm: opt[4],
        kind,
        url,
      }
    : null
}
const money = '(?:₹|\\$|€|£)\\s?\\d{1,6}(?:,\\d{3})*(?:\\.\\d{1,2})?'
export function extractTerms(raw: string): Terms {
  const text = raw.replace(/\s+/g, ' ').slice(0, 12000)
  const trial = text.match(/\b(\d{1,3})[- ]day (?:free )?trial\b/i)
  const recurringMatches = [
    ...text.matchAll(
      new RegExp(
        '(' + money + ')\\s*(?:/|per |a |each |every )(month|year|week)\\b',
        'gi',
      ),
    ),
  ]
  const billingOptions = new Set(
    recurringMatches.map(
      (m) => m[1].replace(/\s/g, '') + '/' + m[2].toLowerCase(),
    ),
  )
  const recurring = billingOptions.size === 1 ? recurringMatches[0] : null
  const initial = text.match(
    new RegExp('(' + money + ') (?:today|initial charge|due now)', 'i'),
  )
  const renewal = text.match(/\brenews on (\d{4}-\d{2}-\d{2})\b/i)
  const deadline = text.match(/\bcancel (?:before|by) (\d{4}-\d{2}-\d{2})\b/i)
  const auto = text.match(
    /\b(?:automatically renews|renews automatically|auto-renewal is (?:enabled|on|off))\b/i,
  )
  const cancel = text.match(
    /\bcancel (?:anytime|at any time|before renewal|before the trial ends)\b/i,
  )
  const refund = text.match(
    /\b(?:charges are non-refundable|no refunds after renewal|refunds (?:are )?available within \d{1,3} days)\b/i,
  )
  const date = (value?: string) =>
    value &&
    !isNaN(Date.parse(value)) &&
    new Date(value).toISOString().startsWith(value + 'T')
      ? value
      : null
  return {
    trialDays: trial ? Number(trial[1]) : null,
    initial: initial?.[1] ?? null,
    recurring: recurring?.[1] ?? null,
    frequency: recurring?.[2]?.toLowerCase() ?? null,
    renewal: date(renewal?.[1]),
    deadline: date(deadline?.[1]),
    autoRenew: auto?.[0] ?? null,
    cancellation: cancel?.[0] ?? null,
    refund: refund?.[0] ?? null,
    source: [
      trial,
      initial,
      ...recurringMatches,
      renewal,
      deadline,
      auto,
      cancel,
      refund,
    ].flatMap((m) => (m ? [m[0]] : [])),
  }
}
export function statusSignals(lines: string[]) {
  const phrases = [
    /^your free trial is active[.!]?$/i,
    /^subscription status\s*[:·]\s*active[.!]?$/i,
    /^your subscription (?:has been|is) cancel(?:l)?ed[.!]?$/i,
    /^subscription status\s*[:·]\s*cancel(?:l)?ed[.!]?$/i,
    /^auto-renewal is off[.!]?$/i,
    /^advertising cookies are disabled[.!]?$/i,
    /^consent withdrawn[.!]?$/i,
  ]
  return [
    ...new Set(
      lines.map((t) => t.trim()).filter((t) => phrases.some((r) => r.test(t))),
    ),
  ].slice(0, 8)
}
