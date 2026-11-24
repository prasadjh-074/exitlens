import { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Aperture,
  AudioLines,
  BadgeCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  ExternalLink,
  FileText,
  GitBranch,
  Github,
  History,
  LockKeyhole,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import '@fontsource-variable/geist/wght.css'
import '@fontsource/instrument-serif/latin-400-italic.css'
import '@fontsource/instrument-serif/latin-400.css'
import mark from '../../../extension/public/icons/icon48.png'
import { STILLFRAME_PATH } from '../../../extension/src/types'
import {
  buildReplay,
  guideStart,
  lastScene,
  phaseStart,
  routeStages,
  scenes,
  siteName,
  trialSource,
} from './scenario'
import './studio.css'

const phases = [
  {
    id: 'remember',
    label: 'Remember',
    detail: 'Capture the terms',
    icon: History,
  },
  {
    id: 'reverse',
    label: 'Reverse',
    detail: 'Follow the undo path',
    icon: GitBranch,
  },
  {
    id: 'verify',
    label: 'Verify',
    detail: 'Check the receipt',
    icon: BadgeCheck,
  },
] as const

type Replay = ReturnType<typeof buildReplay>
type Scene = (typeof scenes)[number]

function BrowserPane({
  scene,
  playback,
  advance,
}: {
  scene: Scene
  playback: boolean
  advance: () => void
}) {
  const poster = scene.id === 'home' || scene.id === 'offer'
  const receipt = scene.id === 'receipt'
  const renderStatusIcon =
    scene.barrier ||
    receipt ||
    ['active', 'guide', 'cleared'].includes(scene.id)
  const StatusIcon = scene.barrier
    ? scene.id === 'alternative'
      ? AudioLines
      : ShieldAlert
    : ShieldCheck
  const providerDetails =
    scene.id === 'account' || scene.id === 'membership' || receipt
  return (
    <section
      className="studio-browser"
      aria-label="Fictional Stillframe browser"
    >
      <div className="pane-toolbar">
        <span className="stillframe-logo">
          <Aperture size={18} aria-hidden="true" />
          Stillframe
        </span>
        <span className="browser-address">
          <LockKeyhole size={12} aria-hidden="true" />
          stillframe.test{scene.path === '/' ? '' : scene.path}
        </span>
      </div>
      <div
        className={
          'browser-page' +
          (poster ? ' poster-page ' + scene.id : '') +
          (receipt ? ' receipt-page' : '')
        }
      >
        <div className="browser-scene" key={scene.id}>
          {renderStatusIcon && (
            <span
              className={
                'browser-symbol' + (scene.barrier ? ' warning' : ' success')
              }
            >
              <StatusIcon size={24} aria-hidden="true" />
            </span>
          )}
          <p className="scene-label">
            {scene.id === 'home'
              ? 'STILLFRAME ORIGINAL'
              : receipt
                ? 'CANCELLATION RECEIPT'
                : scene.barrier || scene.id === 'cleared'
                  ? 'FICTIONAL CHECKPOINT'
                  : scene.id === 'retention'
                    ? 'RETENTION OFFER'
                    : 'STILLFRAME PLUS'}
          </p>
          <h2>{scene.title}</h2>
          <p className="scene-detail">{scene.detail}</p>
          {providerDetails && (
            <div className="browser-membership">
              <span className="membership-icon">
                <Aperture size={19} aria-hidden="true" />
              </span>
              <div>
                <strong>Stillframe Plus</strong>
                <small>
                  {receipt
                    ? 'Auto-renewal off'
                    : '₹799 per month after the trial'}
                </small>
              </div>
              <span
                className={'membership-status' + (receipt ? ' cancelled' : '')}
              >
                {receipt ? 'Cancelled' : 'Trial active'}
              </span>
            </div>
          )}
          {scene.action && scene.id !== 'active' && (
            <button
              className={
                'stage-action' +
                (scene.phase === 'reverse' && !scene.barrier
                  ? ' guided-action'
                  : '')
              }
              onClick={advance}
            >
              {scene.barrier && scene.id === 'challenge' && (
                <AudioLines size={17} aria-hidden="true" />
              )}
              {scene.action}
            </button>
          )}
          {scene.id === 'home' && (
            <span className="poster-caption">
              7 days free · Then ₹799/month
            </span>
          )}
          {scene.id === 'confirm' && (
            <span className="confirmation-caption">
              <LockKeyhole size={13} aria-hidden="true" />
              {playback ? 'Fictional confirmation' : 'You confirm this step'}
            </span>
          )}
        </div>
      </div>
    </section>
  )
}

function TermsPanel({
  replay,
  advance,
}: {
  replay: Replay
  advance: () => void
}) {
  const { terms, record } = replay
  return (
    <>
      <div className="panel-heading">
        <div>
          <p className="stage-kicker">COMMITMENT MEMORY</p>
          <h2>Stillframe Plus</h2>
        </div>
        <span className={'stage-badge' + (record ? ' success' : '')}>
          {record ? (
            <Check size={13} aria-hidden="true" />
          ) : (
            <CircleDot size={13} aria-hidden="true" />
          )}
          {record ? 'Trial recorded' : 'Offer visible'}
        </span>
      </div>
      <dl className="term-grid" aria-label="Trial terms">
        <div>
          <dt>Trial length</dt>
          <dd>
            {terms.trialDays} <span>days</span>
          </dd>
        </div>
        <div>
          <dt>Due today</dt>
          <dd>{terms.initial}</dd>
        </div>
        <div>
          <dt>Then monthly</dt>
          <dd>{terms.recurring}</dd>
        </div>
      </dl>
      <details className="evidence-source" open={!record}>
        <summary>
          <FileText size={15} aria-hidden="true" />{' '}
          {record ? 'Captured evidence' : 'Source on the page'}
        </summary>
        <blockquote>“{trialSource}”</blockquote>
        {record && (
          <blockquote>
            “
            {
              record.evidence.find((item) => item.text.endsWith('is active.'))
                ?.text
            }
            ”
          </blockquote>
        )}
      </details>
      {record && (
        <button className="studio-primary panel-action" onClick={advance}>
          <GitBranch size={17} aria-hidden="true" />
          Find undo path
        </button>
      )}
    </>
  )
}

function RoutePanel({
  scene,
  index,
  replay,
}: {
  scene: Scene
  index: number
  replay: Replay
}) {
  const routeDone = replay.record?.reversal.length ?? 0
  const currentIndex = routeStages.findIndex((step) => step.arrivesAt > index)
  return (
    <>
      <div className="panel-heading">
        <div>
          <p className="stage-kicker">GUIDED REVERSAL</p>
          <h2>Undo path</h2>
        </div>
        <span className={'stage-badge' + (scene.barrier ? ' warning' : '')}>
          {scene.barrier ? (
            <Pause size={12} aria-hidden="true" />
          ) : (
            <GitBranch size={13} aria-hidden="true" />
          )}
          {scene.barrier ? 'Guide paused' : routeDone + ' observed'}
        </span>
      </div>
      <ol className="route-steps" aria-label="Reversal path">
        {routeStages.map((step, position) => {
          const done = index >= step.arrivesAt
          const current = currentIndex === position
          return (
            <li
              key={step.label}
              className={done ? 'done' : current ? 'current' : ''}
              aria-current={current ? 'step' : undefined}
            >
              <span className="route-node">
                {done ? (
                  <Check size={13} aria-hidden="true" />
                ) : current ? (
                  <CircleDot size={13} aria-hidden="true" />
                ) : (
                  <span />
                )}
              </span>
              <span>{step.label}</span>
              <small>
                {done
                  ? 'Observed'
                  : current
                    ? scene.barrier
                      ? 'Paused'
                      : 'Next'
                    : 'Ahead'}
              </small>
            </li>
          )
        })}
      </ol>
      <p className={'guide-line' + (scene.barrier ? ' warning' : '')}>
        {scene.barrier
          ? 'Stillframe’s accessible option is available.'
          : replay.next
            ? 'Visible control: ' + (scene.action ?? replay.next.label)
            : 'Waiting for the next screen.'}
      </p>
    </>
  )
}

function ReceiptPanel({ replay }: { replay: Replay }) {
  const { record, ratio } = replay
  return (
    <>
      <div className="panel-heading">
        <div>
          <p className="stage-kicker">REVERSIBILITY REPORT</p>
          <h2>Cancellation verified</h2>
        </div>
        <span className="stage-badge success">
          <BadgeCheck size={14} aria-hidden="true" /> Verified
        </span>
      </div>
      <p className="verified-evidence">
        <ShieldCheck size={17} aria-hidden="true" /> {record?.verification}
      </p>
      <dl
        className="term-grid receipt-metrics"
        aria-label="Reversibility report metrics"
      >
        <div>
          <dt>Signup actions</dt>
          <dd>{record?.entry.length}</dd>
        </div>
        <div>
          <dt>Reversal actions</dt>
          <dd>{record?.reversal.length}</dd>
        </div>
        <div>
          <dt>Reversal ratio</dt>
          <dd>
            {ratio?.toFixed(2)}
            <span>×</span>
          </dd>
        </div>
      </dl>
      <blockquote className="receipt-quote">
        <FileText size={17} aria-hidden="true" />
        <span>
          “Your subscription is cancelled.”
          <small>Stillframe cancellation receipt</small>
        </span>
      </blockquote>
    </>
  )
}

function EvidencePane({
  scene,
  index,
  replay,
  advance,
}: {
  scene: Scene
  index: number
  replay: Replay
  advance: () => void
}) {
  return (
    <section className="studio-evidence" aria-label="ExitLens evidence">
      <div className="pane-toolbar">
        <span className="panel-brand">
          <img src={mark} width="21" height="21" alt="" /> ExitLens
        </span>
        <span className="pane-label">Fictional replay</span>
      </div>
      <div className="evidence-content" key={scene.phase}>
        {scene.phase === 'remember' ? (
          <TermsPanel replay={replay} advance={advance} />
        ) : scene.phase === 'reverse' ? (
          <RoutePanel scene={scene} index={index} replay={replay} />
        ) : (
          <ReceiptPanel replay={replay} />
        )}
      </div>
    </section>
  )
}

function Studio() {
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [presenting, setPresenting] = useState(false)
  const stage = useRef<HTMLElement>(null)
  const scene = scenes[index]
  const replay = useMemo(() => buildReplay(index), [index])
  const playback = playing && index < lastScene

  const visit = (step: number) => {
    setPlaying(false)
    setIndex(Math.max(0, Math.min(step, lastScene)))
  }
  const play = () => {
    if (index === lastScene) setIndex(0)
    setPlaying(!playback)
  }
  const advance = () => visit(index + 1)

  useEffect(() => {
    if (!playback) return
    const delay = scene.barrier ? 5300 : index <= guideStart ? 5000 : 3500
    const timer = window.setTimeout(() => setIndex(index + 1), delay)
    return () => window.clearTimeout(timer)
  }, [index, playback, scene.barrier])

  useEffect(() => {
    const sync = () =>
      setPresenting(document.fullscreenElement === stage.current)
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        (event.target instanceof HTMLElement &&
          event.target.closest('input, textarea, select, [contenteditable]'))
      )
        return

      if (event.key === 'Escape' && !document.fullscreenElement)
        setPresenting(false)
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      event.preventDefault()
      setPlaying(false)
      const increment = event.key === 'ArrowRight' ? 1 : -1
      setIndex((previous) =>
        Math.max(0, Math.min(previous + increment, lastScene)),
      )
    }
    document.addEventListener('keydown', shortcut)
    return () => document.removeEventListener('keydown', shortcut)
  }, [])

  async function togglePresentation() {
    const target = stage.current
    if (!target) return
    if (document.fullscreenElement === target) {
      await document.exitFullscreen()
      return
    }
    setPresenting(!presenting)
    if (!presenting) {
      try {
        await target.requestFullscreen?.()
      } catch {
        // The expanded layout also works in browsers that disallow fullscreen.
      }
    }
  }

  return (
    <div className="studio">
      <a className="studio-skip" href="#demo">
        Skip to walkthrough
      </a>
      <header className="studio-header">
        <div className="studio-wrap studio-nav">
          <a className="studio-wordmark" href="/">
            <img src={mark} width="36" height="36" alt="" />
            ExitLens
          </a>
          <nav aria-label="Demo links">
            <a className="live-link" href={STILLFRAME_PATH}>
              Live sandbox <ExternalLink size={14} aria-hidden="true" />
            </a>
            <a
              className="source-link"
              aria-label="GitHub repository"
              href="https://github.com/prasadjh-074/exitlens"
              target="_blank"
              rel="noreferrer"
            >
              <Github size={18} aria-hidden="true" /> <span>GitHub</span>
            </a>
            <button
              className="present-link"
              onClick={() => void togglePresentation()}
            >
              <Maximize size={16} aria-hidden="true" /> Present
            </button>
          </nav>
        </div>
      </header>

      <main className="studio-wrap">
        <section className="studio-hero" aria-labelledby="studio-title">
          <div className="hero-heading">
            <p className="studio-kicker">
              <Sparkles size={15} aria-hidden="true" /> INTERACTIVE DEMO
            </p>
            <h1 id="studio-title">
              The web’s missing <em>undo button.</em>
            </h1>
          </div>
          <div className="hero-support">
            <p>Follow a free trial from signup to a verified cancellation.</p>
            <button className="studio-primary" onClick={play}>
              {playback ? (
                <Pause size={17} fill="currentColor" aria-hidden="true" />
              ) : (
                <Play size={17} fill="currentColor" aria-hidden="true" />
              )}
              {playback ? 'Pause walkthrough' : 'Play walkthrough'}
            </button>
            <span>Fictional scenario · No installation needed</span>
          </div>
          <div className="studio-lens" aria-hidden="true" />
        </section>

        <section
          id="demo"
          ref={stage}
          className={'studio-stage' + (presenting ? ' is-presenting' : '')}
          aria-label="Interactive ExitLens walkthrough"
        >
          <div className="stage-wrap">
            <div className="stage-heading">
              <nav className="phase-tabs" aria-label="Walkthrough stages">
                {phases.map(({ id, label, detail, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => visit(phaseStart[id])}
                    aria-current={scene.phase === id ? 'step' : undefined}
                  >
                    <span className="phase-icon">
                      <Icon size={19} aria-hidden="true" />
                    </span>
                    <span>
                      <strong>{label}</strong>
                      <small>{detail}</small>
                    </span>
                  </button>
                ))}
              </nav>
              {presenting && (
                <button
                  className="presentation-exit"
                  onClick={() => void togglePresentation()}
                >
                  <Minimize size={17} aria-hidden="true" /> Exit presentation
                </button>
              )}
            </div>

            <div className="studio-frame">
              <div className="frame-panes">
                <BrowserPane
                  scene={scene}
                  playback={playback}
                  advance={advance}
                />
                <EvidencePane
                  scene={scene}
                  index={index}
                  replay={replay}
                  advance={advance}
                />
              </div>
              <div className="transport">
                <div className="transport-left">
                  <button
                    className="icon-control"
                    onClick={() => visit(0)}
                    aria-label="Reset walkthrough"
                    title="Reset walkthrough"
                  >
                    <RotateCcw size={17} aria-hidden="true" />
                  </button>
                  <button
                    className="icon-control transport-play"
                    onClick={play}
                    aria-label={
                      playback ? 'Pause playback' : 'Play from this step'
                    }
                    title={playback ? 'Pause' : 'Play'}
                  >
                    {playback ? (
                      <Pause size={17} aria-hidden="true" />
                    ) : (
                      <Play size={17} aria-hidden="true" />
                    )}
                  </button>
                  <span className="step-number">
                    Step {index + 1} / {scenes.length}
                  </span>
                </div>
                <progress
                  className="stage-progress"
                  value={index + 1}
                  max={scenes.length}
                  aria-label="Walkthrough progress"
                />
                <div className="transport-right">
                  <button
                    className="icon-control"
                    onClick={() => visit(index - 1)}
                    disabled={index === 0}
                    aria-label="Previous step"
                    title="Previous step"
                  >
                    <ChevronLeft size={19} aria-hidden="true" />
                  </button>
                  <button
                    className="icon-control next-control"
                    onClick={advance}
                    disabled={index === lastScene}
                    aria-label="Next step"
                    title="Next step"
                  >
                    <ChevronRight size={19} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
            <p className="sr-only" role="status">
              {scene.title} · Step {index + 1} of {scenes.length}
            </p>
            <div className="studio-understage">
              <details className="presenter-notes">
                <summary>
                  <FileText size={16} aria-hidden="true" /> Presenter notes
                </summary>
                <p>{scene.note}</p>
              </details>
              <p>
                <kbd>←</kbd> <kbd>→</kbd> Step through the walkthrough
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="studio-wrap studio-footer">
        <p>
          Fictional {siteName} walkthrough. The live sandbox runs with the
          Chrome extension.
        </p>
        <a href={STILLFRAME_PATH}>
          Open live sandbox <ExternalLink size={14} aria-hidden="true" />
        </a>
      </footer>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<Studio />)
