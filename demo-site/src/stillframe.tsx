import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Aperture,
  AudioLines,
  Check,
  Clapperboard,
  Film,
  SlidersHorizontal,
  UserRound,
  X,
} from 'lucide-react'
import { STILLFRAME_PATH } from '../../extension/src/types'
import './style.css'

type Membership = { state: 'none' | 'active' | 'cancelled'; started?: number }
const readPlan = (): Membership => {
  try {
    return JSON.parse(
      localStorage.getItem('stillframe.plan') ?? '{"state":"none"}',
    )
  } catch {
    return { state: 'none' }
  }
}
const path = location.pathname
const go = (p: string) => location.assign(p)
function savePlan(value: Membership) {
  localStorage.setItem('stillframe.plan', JSON.stringify(value))
}
function App() {
  const plan = readPlan(),
    [consent, setConsent] = useState(
      localStorage.getItem('stillframe.consent'),
    ),
    [custom, setCustom] = useState(false),
    [human, setHuman] = useState(false),
    [alternative, setAlternative] = useState(false)
  const [input, setInput] = useState(''),
    [challengeError, setChallengeError] = useState(''),
    [mismatch, setMismatch] = useState(
      localStorage.getItem('stillframe.mismatch') !== 'off',
    )
  const [confirmReset, setConfirmReset] = useState(false)
  const trialDate = new Date((plan.started ?? Date.now()) + 7 * 86400000)
    .toISOString()
    .slice(0, 10)
  function choose(value: string) {
    localStorage.setItem('stillframe.consent', value)
    setConsent(value)
    setCustom(false)
    document.cookie = 'cookie_consent=' + value + '; Path=/; SameSite=Lax'
    document.cookie =
      value === 'accepted'
        ? 'ad_consent=granted; Path=/; SameSite=Lax'
        : 'ad_consent=; Path=/; Max-Age=0; SameSite=Lax'
    if (
      mismatch &&
      value === 'rejected' &&
      location.origin === 'http://127.0.0.1:4173'
    ) {
      setTimeout(() => {
        void fetch('http://localhost:4173/signals/ad.gif', {
          mode: 'no-cors',
          credentials: 'omit',
          cache: 'no-store',
        }).catch(() => {})
      }, 850)
    }
  }
  function reset() {
    for (const k of ['plan', 'consent', 'mismatch'])
      localStorage.removeItem('stillframe.' + k)
    for (const k of ['cookie_consent', 'ad_consent'])
      document.cookie = k + '=; Path=/; Max-Age=0; SameSite=Lax'
    sessionStorage.removeItem('stillframe.human')
    go(STILLFRAME_PATH)
  }
  const link = (href: string, label: string, primary = false) => (
    <a className={primary ? 'button primary' : 'button'} href={href}>
      {label}
    </a>
  )
  const active = plan.state === 'active'
  const status = (
    <p className="status" role="status">
      Subscription status:{' '}
      {active ? 'Active' : plan.state === 'cancelled' ? 'Cancelled' : 'No plan'}
    </p>
  )
  let body: React.ReactNode
  if (path === STILLFRAME_PATH)
    body = (
      <>
        <section className="hero">
          <div className="hero-copy">
            <span className="film-meta">
              <span className="line" /> STILLFRAME ORIGINAL
            </span>
            <h1>
              Quiet
              <br />
              <em>Orbit</em>
            </h1>
            <p>
              At a remote coastal observatory, a night operator picks up a
              signal that should have gone silent years ago.
            </p>
            <div className="film-meta">
              SCIENCE FICTION <b>·</b> 1H 48M
            </div>
            {active
              ? link('/account', 'Account settings', true)
              : link('/trial', 'View trial offer', true)}
          </div>
        </section>
        <section className="program">
          <div>
            <small>MEMBERSHIP</small>
            <h2>One screen. A week of cinema.</h2>
          </div>
          <div>
            <p>
              A 7-day free trial, then ₹799 per month. Cancel before renewal.
            </p>
            <a href="/terms">Read membership terms</a>
          </div>
        </section>
      </>
    )
  else if (path === '/trial')
    body = (
      <article>
        <small>MEMBERSHIP / TRIAL</small>
        <h1>The first week is yours.</h1>
        <p>
          7-day free trial. ₹0 today, then ₹799 per month. Your subscription
          automatically renews.
        </p>
        <p>
          Renews on {trialDate}. Cancel before {trialDate} to avoid the next
          charge.
        </p>
        <a href="/terms">Read the full membership terms</a>
        <div className="actions">
          {active ? (
            link('/account', 'Account settings', true)
          ) : (
            <button
              className="primary"
              onClick={() => {
                savePlan({ state: 'active', started: Date.now() })
                sessionStorage.removeItem('stillframe.human')
                go('/welcome')
              }}
            >
              Start free trial
            </button>
          )}
        </div>
      </article>
    )
  else if (path === '/terms')
    body = (
      <article>
        <small>MEMBERSHIP / TERMS</small>
        <h1>Membership terms</h1>
        <p>
          7-day free trial. ₹0 today, then ₹799 per month. Your subscription
          automatically renews.
        </p>
        <p>
          Cancel before renewal. No refunds after renewal. All charges on this
          fictional service are simulated.
        </p>
        {link('/trial', 'View trial offer', true)}
      </article>
    )
  else if (path === '/privacy')
    body = (
      <article>
        <small>ACCOUNT / PRIVACY</small>
        <h1>Privacy settings</h1>
        <p>
          {consent === 'accepted'
            ? 'Advertising cookies are enabled.'
            : consent === 'rejected'
              ? 'Advertising cookies are disabled.'
              : 'No consent decision recorded.'}
        </p>
        <p>Change the cookie preference for this fictional website.</p>
        <div className="actions">
          <button onClick={() => choose('rejected')}>Withdraw consent</button>
          <button onClick={() => choose('accepted')}>Accept cookies</button>
        </div>
      </article>
    )
  else if (path === '/welcome' && active)
    body = (
      <article>
        <small>MEMBERSHIP</small>
        <h1>Your free trial is active.</h1>
        <p>
          Renews on {trialDate}. Your next simulated charge is ₹799 per month.
        </p>
        {link('/account', 'Account settings', true)}
      </article>
    )
  else if (path === '/account')
    body = (
      <article>
        <small>YOUR ACCOUNT</small>
        <h1>Account settings</h1>
        {status}
        <p>View your plan, billing terms and renewal preferences.</p>
        <div className="actions">
          {link('/subscription', 'Manage subscription', true)}
          {link('/privacy', 'Privacy settings')}
        </div>
      </article>
    )
  else if (path === '/subscription')
    body = (
      <article>
        <small>ACCOUNT / MEMBERSHIP</small>
        <h1>Manage subscription</h1>
        {status}
        <p>
          {active
            ? 'Renews on ' + trialDate + '. ₹799 per month.'
            : 'Auto-renewal is off.'}
        </p>
        <p>Cancel before renewal. No refunds after renewal.</p>
        {active
          ? link('/retention', 'Cancel plan', true)
          : link(STILLFRAME_PATH, 'Back to Stillframe')}
      </article>
    )
  else if (path === '/retention' && active)
    body = (
      <article>
        <small>MEMBERSHIP / CANCELLATION</small>
        <h1>Stay for the next premiere?</h1>
        <p>
          Keep your current trial and we’ll add a simulated bonus screening. You
          can also continue with cancellation.
        </p>
        <div className="actions">
          {link('/verify', 'Continue cancellation', true)}
          {link('/account', 'Keep my plan')}
        </div>
      </article>
    )
  else if (path === '/verify' && active && !human)
    body = (
      <article>
        <small>SIMULATED CHECKPOINT</small>
        <h1>Human verification</h1>
        <p>
          For this demo, enter the word <strong>ORBIT</strong> or use the
          accessible verification option.
        </p>
        <label htmlFor="challenge-answer">Verification word</label>
        <input
          id="challenge-answer"
          autoComplete="off"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <div className="actions">
          <button
            onClick={() => {
              if (input.trim().toUpperCase() === 'ORBIT') {
                setHuman(true)
                sessionStorage.setItem('stillframe.human', 'yes')
              } else
                setChallengeError(
                  'Enter ORBIT or choose the accessible alternative.',
                )
            }}
          >
            Complete human verification
          </button>
          <button onClick={() => setAlternative(true)}>
            <AudioLines size={16} />
            Use accessible verification
          </button>
        </div>
        {challengeError && <p role="alert">{challengeError}</p>}
        {alternative && (
          <div className="alternative">
            <p>
              Accessible alternative for this fictional checkpoint. Confirm the
              step with the button below.
            </p>
            <button
              onClick={() => {
                setHuman(true)
                sessionStorage.setItem('stillframe.human', 'yes')
              }}
            >
              Complete human verification
            </button>
          </div>
        )}
      </article>
    )
  else if (path === '/verify' && active)
    body = (
      <article>
        <small>SIMULATED CHECKPOINT</small>
        <h1>Checkpoint complete</h1>
        <p>You can now review your cancellation.</p>
        {link('/confirm', 'Continue to confirmation', true)}
      </article>
    )
  else if (
    path === '/confirm' &&
    active &&
    sessionStorage.getItem('stillframe.human') === 'yes'
  )
    body = (
      <article>
        <small>MEMBERSHIP / FINAL REVIEW</small>
        <h1>End your membership?</h1>
        <p>
          Confirming ends the fictional subscription and turns off its simulated
          renewal.
        </p>
        <div className="actions">
          <button
            className="primary"
            onClick={() => {
              savePlan({ ...plan, state: 'cancelled' })
              sessionStorage.removeItem('stillframe.human')
              go('/cancelled')
            }}
          >
            Confirm cancellation
          </button>
          {link('/account', 'Keep my plan')}
        </div>
      </article>
    )
  else if (path === '/cancelled' && plan.state === 'cancelled')
    body = (
      <article>
        <small>
          <Check size={15} /> CANCELLATION RECEIPT
        </small>
        <h1>Your subscription is cancelled.</h1>
        <p>Auto-renewal is off.</p>
        <p>No further simulated charges will be made.</p>
        {link('/subscription', 'View subscription status', true)}
      </article>
    )
  else
    body = (
      <article>
        <small>STILLFRAME</small>
        <h1>This screen is unavailable.</h1>
        <p>Your current membership state does not open this screen.</p>
        {link('/account', 'Account settings', true)}
      </article>
    )
  return (
    <>
      <header>
        <a className="brand" href={STILLFRAME_PATH}>
          <Aperture />
          Stillframe
        </a>
        <nav>
          <a href="/">Presentation</a>
          <a href="/terms">Terms</a>
          <a href="/account" aria-label="Account settings">
            <UserRound size={17} /> Account
          </a>
        </nav>
      </header>
      <aside className="sandbox">
        <Clapperboard size={15} /> Fictional streaming service{' '}
        <span>ExitLens demo · No real payments</span>
      </aside>
      <main className={path === STILLFRAME_PATH ? 'home' : 'inner'}>{body}</main>
      {!consent && (
        <section className="cookies" aria-label="Cookie preferences">
          <div>
            <small>PRIVACY</small>
            <h2>
              {custom ? 'Customise privacy preferences' : 'Your cookie choice'}
            </h2>
            <p>
              {custom
                ? 'Essential cookies stay on. Choose whether to allow simulated advertising cookies.'
                : 'Allow or reject advertising cookies for this fictional service.'}
            </p>
          </div>
          <div className="actions">
            <button onClick={() => choose('accepted')}>Accept cookies</button>
            <button onClick={() => choose('rejected')}>Reject cookies</button>
            {!custom && (
              <button onClick={() => setCustom(true)}>
                Customise preferences
              </button>
            )}
          </div>
        </section>
      )}
      <footer>
        <span>
          <Film size={15} /> Stillframe sandbox
        </span>
        <a href="/privacy">Privacy settings</a>
        <details>
          <summary>
            <SlidersHorizontal size={15} /> Demo controls
          </summary>
          <div>
            <label>
              <input
                type="checkbox"
                checked={mismatch}
                onChange={(e) => {
                  setMismatch(e.target.checked)
                  localStorage.setItem(
                    'stillframe.mismatch',
                    e.target.checked ? 'on' : 'off',
                  )
                }}
              />{' '}
              Simulate local ad request after rejection
            </label>
            <button onClick={() => setConfirmReset(true)}>Reset demo</button>
            {confirmReset && (
              <p>
                Clear this fictional membership and cookie choice?{' '}
                <button onClick={reset}>Reset fictional account</button>{' '}
                <button
                  aria-label="Keep demo data"
                  onClick={() => setConfirmReset(false)}
                >
                  <X size={14} />
                </button>
              </p>
            )}
          </div>
        </details>
      </footer>
    </>
  )
}
createRoot(document.getElementById('root')!).render(<App />)
