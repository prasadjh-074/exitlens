import {
  candidate,
  classify,
  extractTerms,
  statusSignals,
} from '../../../extension/src/detectors'
import { discover, mergeEdges, nextStep } from '../../../extension/src/graph'
import { addEvidence, newRecord } from '../../../extension/src/storage'
import { ratio, verify } from '../../../extension/src/verification'

export type Phase = 'remember' | 'reverse' | 'verify'

type Scene = {
  id: string
  phase: Phase
  path: string
  title: string
  detail: string
  action?: string
  kind?: 'link' | 'button'
  barrier?: string
  note: string
}

const trialTerms =
  '7-day free trial. ₹0 today, then ₹799 per month. Your subscription automatically renews.'
const activeSignal = 'Your free trial is active.'
const receiptSignal = 'Your subscription is cancelled.'
export const trialSource = trialTerms
export const siteName = 'Stillframe'
const origin = 'https://stillframe.test'

export const scenes: readonly Scene[] = [
  {
    id: 'home',
    phase: 'remember',
    path: '/',
    title: 'Quiet Orbit',
    detail: 'A signal from the past. One last night to answer it.',
    action: 'View trial offer',
    note: 'A trial starts here. ExitLens keeps the price, the renewal terms, and the evidence that explains them.',
  },
  {
    id: 'offer',
    phase: 'remember',
    path: '/trial',
    title: 'The first week is yours.',
    detail: trialTerms,
    action: 'Start free trial',
    note: 'The offer is seven days free, then ₹799 a month. These terms come from the visible offer text.',
  },
  {
    id: 'active',
    phase: 'remember',
    path: '/welcome',
    title: activeSignal,
    detail:
      'Your Stillframe Plus trial is active. It renews after the first seven days.',
    action: 'Find undo path',
    note: 'The welcome screen confirms that the trial started. Now let’s find our way back out.',
  },
  {
    id: 'guide',
    phase: 'reverse',
    path: '/welcome',
    title: 'Your free trial is active.',
    detail:
      'Use Account settings to review or change your Stillframe Plus membership.',
    action: 'Account settings',
    kind: 'link',
    note: 'ExitLens highlights the visible account settings link. The rest of the path is still ahead.',
  },
  {
    id: 'account',
    phase: 'reverse',
    path: '/account',
    title: 'Account settings',
    detail: 'Review your membership and the next renewal.',
    action: 'Manage subscription',
    kind: 'link',
    note: 'After each click, the path records the transition and points to the next visible control.',
  },
  {
    id: 'membership',
    phase: 'reverse',
    path: '/subscription',
    title: 'Manage subscription',
    detail:
      'Stillframe Plus renews after your trial. You can cancel before the renewal.',
    action: 'Cancel plan',
    kind: 'link',
    note: 'The original offer and renewal terms stay attached to the same trial while we look for cancellation.',
  },
  {
    id: 'retention',
    phase: 'reverse',
    path: '/retention',
    title: 'Stay for the next premiere?',
    detail:
      'Keep your trial and Stillframe will add a bonus screening. You can continue with cancellation.',
    action: 'Continue cancellation',
    kind: 'link',
    note: 'This is a retention offer. The guide points to the choice that continues the cancellation.',
  },
  {
    id: 'challenge',
    phase: 'reverse',
    path: '/verify',
    title: 'Human verification',
    detail: 'Stillframe shows a fictional checkpoint before the final review.',
    action: 'Use accessible verification',
    kind: 'button',
    barrier:
      'Human verification required. An accessible alternative is visible.',
    note: 'ExitLens pauses here. I choose the site’s accessible option and complete the fictional checkpoint myself.',
  },
  {
    id: 'alternative',
    phase: 'reverse',
    path: '/verify',
    title: 'Accessible verification',
    detail:
      'Stillframe provides an input-free alternative for this fictional checkpoint.',
    action: 'Complete human verification',
    kind: 'button',
    barrier:
      'Human verification required. An accessible alternative is visible.',
    note: 'The available alternative is part of Stillframe’s own workflow.',
  },
  {
    id: 'cleared',
    phase: 'reverse',
    path: '/verify',
    title: 'Checkpoint complete',
    detail: 'Stillframe lets you proceed to the final cancellation review.',
    action: 'Continue to confirmation',
    kind: 'link',
    note: 'The guide resumes once the site shows that verification is complete.',
  },
  {
    id: 'confirm',
    phase: 'reverse',
    path: '/confirm',
    title: 'End your membership?',
    detail:
      'Confirming ends the fictional trial and switches off its simulated renewal.',
    action: 'Confirm cancellation',
    kind: 'button',
    note: 'I confirm the cancellation. ExitLens waits for a receipt before changing the status.',
  },
  {
    id: 'receipt',
    phase: 'verify',
    path: '/cancelled',
    title: receiptSignal,
    detail: 'Auto-renewal is off. No further simulated charges will be made.',
    note: 'The receipt verifies the cancellation. We can now compare eight reversal actions with two entry actions and inspect the saved evidence.',
  },
]

export const guideStart = scenes.findIndex((scene) => scene.id === 'guide')
export const lastScene = scenes.length - 1

export const phaseStart: Record<Phase, number> = {
  remember: 0,
  reverse: guideStart,
  verify: lastScene,
}

export const routeStages = [
  { label: 'Account settings', arrivesAt: guideStart + 1 },
  { label: 'Manage subscription', arrivesAt: guideStart + 2 },
  { label: 'Continue past offer', arrivesAt: guideStart + 4 },
  { label: 'Human verification', arrivesAt: guideStart + 6 },
  { label: 'Final confirmation', arrivesAt: guideStart + 7 },
  { label: 'Verified receipt', arrivesAt: lastScene },
] as const

function pageFor(scene: Scene) {
  // The three /verify screens are different states of the same fictional page.
  const state = scene.path === '/verify' ? '#' + scene.id : ''
  return origin + scene.path + state
}

export function buildReplay(index: number) {
  const terms = extractTerms(trialTerms)
  if (index < scenes.findIndex((scene) => scene.id === 'active')) {
    return { terms, record: null, ratio: null, next: null }
  }

  const offer = scenes[1]
  const action = 'Start free trial'
  const record = newRecord(
    {
      label: action,
      action: classify(action, trialTerms),
      page: pageFor(offer),
      terms,
      choice: null,
      simulated: true,
      entry: false,
    },
    origin,
    1,
    'stillframe-replay',
    { at: 0, text: 'Opened the Stillframe trial offer.' },
  )

  record.status = 'Active'
  record.confidence = 'Confirmed by page'
  record.completeEntry = true
  record.continuous = true
  record.current = pageFor(scenes[index])
  addEvidence(record.evidence, activeSignal, 2)

  for (let step = guideStart; step <= index && step < lastScene; step += 1) {
    const scene = scenes[step]
    const { action, kind } = scene
    if (!action || !kind) continue

    const destination = pageFor(scenes[step + 1])
    const control = candidate(
      action,
      kind,
      kind === 'link' ? destination : null,
    )
    if (!control) continue

    const [edge] = discover(
      {
        page: pageFor(scene),
        candidates: [control],
        signals: [],
        barriers: scene.barrier ? [scene.barrier] : [],
        simulated: true,
      },
      'subscription',
    )
    if (!edge) continue
    record.edges = mergeEdges(record.edges, [edge])
    if (scene.barrier && !record.barriers.includes(scene.barrier))
      record.barriers.push(scene.barrier)

    if (step < index) {
      addEvidence(record.reversal, action, step)
      record.edges = mergeEdges(record.edges, [
        {
          ...edge,
          to: destination,
          proof: 'Observed',
          confidence: 1,
          evidence:
            'Fictional click followed by the next screen in the walkthrough.',
        },
      ])
    }
  }

  if (index === lastScene) {
    const signals = statusSignals([receiptSignal, 'Auto-renewal is off.'])
    const finalAction = record.reversal.at(-1)?.text
    record.verification = verify(
      'subscription',
      signals,
      finalAction === 'Confirm cancellation',
    )
    if (record.verification === 'Verified by observable evidence') {
      record.status = 'Reversed'
      record.verifiedAt = index
      signals.forEach((signal) => addEvidence(record.evidence, signal, index))
    }
  }

  return {
    terms,
    record,
    ratio: ratio(record),
    next: nextStep(record.edges, record.current),
  }
}
