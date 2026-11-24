import type { Category, RecordItem, Verification } from '../types'
export function verify(
  category: Category,
  signals: string[],
  attempt: boolean,
): Verification {
  if (!attempt) return 'Pending verification'
  const text = signals.join('\n')
  if (category === 'subscription') {
    if (
      /subscription (?:has been|is) cancel(?:l)?ed|subscription status\s*[:·]\s*cancel(?:l)?ed/i.test(
        text,
      )
    )
      return 'Verified by observable evidence'
    if (/auto-renewal is off/i.test(text)) return 'Partially verified'
  } else if (/consent withdrawn|advertising cookies are disabled/i.test(text))
    return 'Verified by observable evidence'
  return 'Pending verification'
}
export function ratio(r: RecordItem): number | null {
  return r.completeEntry &&
    r.continuous &&
    r.verification === 'Verified by observable evidence' &&
    r.entry.length &&
    r.reversal.length
    ? r.reversal.length / r.entry.length
    : null
}
