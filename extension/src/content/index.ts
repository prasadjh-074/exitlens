import {
  candidate,
  classify,
  extractTerms,
  pageKey,
  safeUrl,
  statusSignals,
} from '../detectors'
import { endpoint } from '../graph'
import { challenge, inspectBarriers } from '../accessibility'
import type { Candidate, Click, Snapshot } from '../types'

interface Reply {
  allowed: boolean
  guide?: boolean
  label?: string | null
  destination?: string | null
  blocked?: boolean
  done?: boolean
}
const env = globalThis as typeof globalThis & { __exitLens?: () => void }
const send = async (payload: unknown): Promise<Reply> => {
  try {
    const r = await chrome.runtime.sendMessage(payload)
    return r?.ok ? r.value : { allowed: false }
  } catch {
    return { allowed: false }
  }
}
const visible = (e: Element) =>
  e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden'
const selector =
  'button,a[href],[role="button"],[role="link"],input[type="submit"],input[type="button"]'
function name(e: HTMLElement) {
  const refs = e
    .getAttribute('aria-labelledby')
    ?.split(/\s+/)
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ')
  return (
    refs ||
    e.getAttribute('aria-label') ||
    (e instanceof HTMLInputElement ? e.value : e.innerText) ||
    e.title ||
    ''
  )
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 120)
}
const page = () => pageKey(location.href, location.origin)
function asCandidate(e: HTMLElement): Candidate | null {
  const link = e instanceof HTMLAnchorElement
  const url = link ? safeUrl(e.href, location.origin) : null
  if (link && !url) return null
  return candidate(name(e), link ? 'link' : 'button', url)
}
function relevantText(e: Element) {
  const area =
    e.closest('[role=dialog],dialog,article,section,main,form') ??
    e.parentElement
  return Array.from(area?.querySelectorAll('h1,h2,h3,p,li,small,legend') ?? [])
    .filter(
      (x) =>
        visible(x) &&
        !x.closest('[contenteditable],textarea') &&
        !x.querySelector('input,textarea,[contenteditable]'),
    )
    .slice(0, 55)
    .map((x) => (x as HTMLElement).innerText.slice(0, 550))
    .join(' ')
    .slice(0, 12000)
}
async function start() {
  if (env.__exitLens) {
    env.__exitLens()
    return
  }
  let allowed = false,
    guide = false,
    barriers: string[] = [],
    scanned = '',
    busy = false,
    again = false,
    lastJson = ''
  let timer: ReturnType<typeof setTimeout>,
    marker: HTMLElement | null = null,
    hint: HTMLElement | null = null
  const timers = new Set<ReturnType<typeof setTimeout>>()
  const later = (fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timers.delete(id)
      fn()
    }, ms)
    timers.add(id)
  }
  const simulated = () =>
    !!document.querySelector('meta[name="simulation"][content="fictional"]')
  function clearHint() {
    marker?.removeAttribute('data-exitlens-highlight')
    marker = null
    if (hint) {
      hint.remove()
      hint = null
    }
  }
  function displays(
    label: string | null | undefined,
    destination: string | null | undefined,
    blocked: boolean,
    done: boolean,
    candidates: HTMLElement[],
  ) {
    if (!guide && !done) {
      clearHint()
      return
    }
    const matches = blocked
      ? []
      : candidates.filter((e) => {
          const option = asCandidate(e)
          return (
            option?.label === label &&
            !!option &&
            endpoint(page(), option) === destination
          )
        })
    const target =
      matches.find((e) => e.closest('main,dialog,[role=dialog]')) ??
      matches[0] ??
      null
    const msg = done
      ? 'Verification evidence saved.'
      : blocked
        ? 'Paused for human verification. Use the site’s verification controls.'
        : target
          ? 'Next step · ' + label
          : 'Looking for a visible reversal control. Navigate manually or end the guide in ExitLens.'
    if (marker === target && hint?.textContent === 'ExitLens  ' + msg) return
    clearHint()
    marker = target
    marker?.setAttribute('data-exitlens-highlight', '')
    hint = document.createElement('aside')
    hint.id = 'exitlens-guidance'
    hint.setAttribute('role', 'status')
    hint.textContent = 'ExitLens  ' + msg
    document.documentElement.append(hint)
    if (done) later(clearHint, 4500)
  }
  async function snapshot(force = false) {
    if (!allowed) return
    if (busy) {
      again = true
      return
    }
    busy = true
    try {
      const elements = Array.from(
        document.querySelectorAll<HTMLElement>(selector),
      ).filter(
        (e) =>
          visible(e) &&
          !e.closest('[inert],[hidden],[aria-hidden=true]') &&
          !e.matches(':disabled,[aria-disabled=true]'),
      )
      const candidates = elements
        .map(asCandidate)
        .filter((c): c is Candidate => !!c)
        .slice(0, 40)
      const texts = Array.from(
        document.querySelectorAll<HTMLElement>(
          'h1,h2,h3,[role=status],p,dt,dd,strong',
        ),
      )
        .filter(visible)
        .slice(0, 200)
        .map((e) => e.innerText)
      const checkpoint = challenge()
      const screenKey =
        page() + checkpoint.join() + candidates.map((c) => c.label).join()
      if (guide && scanned !== screenKey) {
        scanned = screenKey
        barriers = await inspectBarriers()
      }
      const billingPage = document.querySelector(
        'main article, main section, main',
      )
      const pageTerms =
        billingPage && candidates.some((c) => c.category === 'subscription')
          ? extractTerms(relevantText(billingPage))
          : undefined
      const snap: Snapshot = {
        page: page(),
        terms: pageTerms,
        signals: statusSignals(texts),
        candidates,
        barriers: [...checkpoint, ...(guide ? barriers : [])],
        simulated: simulated(),
      }
      const key = JSON.stringify(snap)
      if (force || key !== lastJson) {
        lastJson = key
        const r = await send({ type: 'SNAP', snap })
        if (!r.allowed) {
          stop()
          return
        }
        const started = !guide && !!r.guide
        guide = !!r.guide
        displays(r.label, r.destination, !!r.blocked, !!r.done, elements)
        if (started) again = true
      }
    } finally {
      busy = false
      if (again) {
        again = false
        void snapshot(true)
      }
    }
  }
  function onClick(ev: MouseEvent) {
    if (!allowed || !ev.isTrusted) return
    const el = ev
      .composedPath()
      .find((n) => n instanceof HTMLElement && n.matches(selector))
    if (!(el instanceof HTMLElement) || !visible(el)) return
    const label = name(el),
      choice = asCandidate(el)
    const context =
      /accept|reject|decline|allow|refuse|consent|preferences|subscribe|trial|auto.renewal|cancel/i.test(
        label,
      )
        ? relevantText(el)
        : ''
    const action = classify(label, context)
    const entry =
      /^(view|review|explore) (the )?(trial offer|trial terms)$/i.test(label)
    if (!action && !choice && !entry && !guide) return
    const click: Click = {
      label: action ?? choice?.label ?? '',
      page: page(),
      action,
      choice,
      terms: extractTerms(
        action && !/cookies|consent|preferences/i.test(action) ? context : '',
      ),
      simulated: simulated(),
      entry,
    }
    void send({ type: 'CLICK', click }).then((r) => {
      if (!r.allowed) stop()
      else if (allowed) void snapshot(true)
    })
    if (action && /cookies|consent|preferences/i.test(action))
      for (const delay of [400, 1600, 4000])
        later(() => {
          if (allowed) void send({ type: 'AUDIT' })
        }, delay)
  }
  const observer = new MutationObserver((mutations) => {
    if (
      mutations.every(
        (m) =>
          (m.target as Element).closest?.('#exitlens-guidance') ||
          (m.addedNodes.length + m.removedNodes.length > 0 &&
            [...m.addedNodes, ...m.removedNodes].every(
              (n) => n instanceof HTMLElement && n.id === 'exitlens-guidance',
            )),
      )
    )
      return
    clearTimeout(timer)
    timer = setTimeout(() => void snapshot(), 120)
  })
  function stop() {
    allowed = false
    guide = false
    clearHint()
    observer.disconnect()
    document.removeEventListener('click', onClick, true)
    clearTimeout(timer)
    timers.forEach(clearTimeout)
    timers.clear()
    chrome.runtime.onMessage.removeListener(listener)
    delete env.__exitLens
  }
  function listener(msg: { type: string }) {
    if (msg.type === 'REFRESH') void snapshot(true)
    if (msg.type === 'STOP') stop()
  }
  env.__exitLens = () => {
    if (allowed) void snapshot(true)
  }
  const hello = await send({ type: 'HELLO' })
  if (!hello.allowed) {
    delete env.__exitLens
    return
  }
  allowed = true
  guide = !!hello.guide
  chrome.runtime.onMessage.addListener(listener)
  document.addEventListener('click', onClick, true)
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: [
      'hidden',
      'aria-label',
      'aria-disabled',
      'aria-hidden',
      'disabled',
      'class',
    ],
  })
  await snapshot(true)
  void send({ type: 'AUDIT' })
}
void start()
