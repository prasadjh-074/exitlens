import React, { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  AudioLines,
  CheckCheck,
  FileText,
  Flag,
  GitBranch,
  ShieldCheck,
} from 'lucide-react'
import type { RecordItem } from '../types'
import { ratio } from '../verification'
import { nextStep } from '../graph'
import { nativeSpeech } from '../providers'
import { PathGraph, nodeTitle } from './PathGraph'
export const fmt = (ms: number) =>
  new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(ms)
export const price = (r: RecordItem) =>
  r.terms.recurring
    ? r.terms.recurring + (r.terms.frequency ? ' / ' + r.terms.frequency : '')
    : 'Unknown'
type Props = {
  r: RecordItem
  initial: 'Evidence' | 'Undo path' | 'Report' | 'Resolve'
  back: () => void
  call: (type: string, id: string) => Promise<boolean>
}
export function Detail({ r, initial, back, call }: Props) {
  const [tab, setTab] = useState(initial === 'Resolve' ? 'Evidence' : initial),
    [error, setError] = useState(''),
    [confirm, setConfirm] = useState(initial === 'Resolve')
  const resolution = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (confirm) resolution.current?.focus()
  }, [confirm])
  const step = nextStep(r.edges, r.current),
    drr = ratio(r),
    finished = r.status === 'Reversed' || r.status === 'Resolved'
  const termRows = [
    ['Initial charge', r.terms.initial],
    ['Recurring charge', price(r)],
    ['Trial duration', r.terms.trialDays ? r.terms.trialDays + ' days' : null],
    ['Renewal date', r.terms.renewal],
    ['Cancel by', r.terms.deadline],
    ['Auto-renewal', r.terms.autoRenew],
    ['Cancellation terms', r.terms.cancellation],
    ['Refund conditions', r.terms.refund],
  ]
  const say = async () => {
    try {
      await nativeSpeech.speak(
        r.action +
          '. ' +
          r.verification +
          '. ' +
          (step ? 'Next visible step. ' + step.label + '. ' : '') +
          r.terms.source.join('. '),
      )
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
    }
  }
  const entries = (items: RecordItem['entry']) => (
    <ol className="event-list">
      {items.map((e, i) => (
        <li key={i}>
          <span className="event-dot" />
          <div>
            {e.text}
            <small>{fmt(e.at)}</small>
          </div>
        </li>
      ))}
    </ol>
  )
  return (
    <>
      <button className="back" onClick={back}>
        <ArrowLeft size={16} /> Commitment memory
      </button>
      <div className="section-top">
        <div>
          <div className="eyebrow">
            {r.category === 'subscription'
              ? 'MEMBERSHIP RECORD'
              : 'CONSENT RECORD'}
            {r.simulated ? ' / FICTIONAL DEMO' : ''}
          </div>
          <h1>{r.action}</h1>
          <p>
            {r.domain} <span className="sep">/</span> {fmt(r.at)}
          </p>
        </div>
        <span className="pill">{r.status}</span>
      </div>
      <div className="tabs" role="group" aria-label="Record view">
        {(['Evidence', 'Undo path', 'Report'] as const).map((k) => (
          <button
            aria-pressed={tab === k}
            className={tab === k ? 'selected' : ''}
            key={k}
            onClick={() => setTab(k)}
          >
            {k}
          </button>
        ))}
      </div>
      {tab === 'Evidence' && (
        <>
          <section className="box">
            <div className="box-title">
              <FileText />
              <h2>Evidence ledger</h2>
            </div>
            {entries(r.evidence)}
            <div className="facts">
              <span>Detection confidence</span>
              <strong>{r.confidence}</strong>
              <span>Page observed</span>
              <code>{r.page}</code>
              <span>Known reversal link</span>
              <code>{r.undoUrl ?? 'Unknown'}</code>
            </div>
          </section>
          {r.category === 'subscription' ? (
            <section className="box">
              <h2>Subscription timeline</h2>
              <ol className="event-list">
                <li>
                  <span className="event-dot" />
                  <div>
                    Commitment observed<small>{fmt(r.at)}</small>
                  </div>
                </li>
                <li>
                  <span className="event-dot" />
                  <div>
                    Published renewal
                    <small>{r.terms.renewal ?? 'Unknown'}</small>
                  </div>
                </li>
                <li>
                  <span className="event-dot" />
                  <div>
                    Current status
                    <small>
                      {r.status} · {r.verification}
                    </small>
                  </div>
                </li>
              </ol>
              <h2>Subscription terms</h2>
              <dl className="facts">
                {termRows.map(([a, b]) => (
                  <React.Fragment key={a}>
                    <dt>{a}</dt>
                    <dd>{b ?? 'Unknown'}</dd>
                  </React.Fragment>
                ))}
              </dl>
              <h3>Source excerpts</h3>
              {r.terms.source.length ? (
                <blockquote>
                  {r.terms.source.map((t) => (
                    <span key={t}>“{t}” </span>
                  ))}
                </blockquote>
              ) : (
                <p>No recognised billing terms were visible.</p>
              )}
            </section>
          ) : (
            <section className="box">
              <h2>Consent audit</h2>
              <p>
                Only permitted traffic and selected cookie names are visible.
                The observation window lasts 30 seconds after a choice.
              </p>
              {r.inconsistent && (
                <p className="notice">
                  Potential consent inconsistency. A classified request followed
                  rejection or withdrawal. This observation alone cannot
                  establish unlawful processing.
                </p>
              )}
              <dl className="facts">
                {(['before', 'after'] as const).map((k) => (
                  <React.Fragment key={k}>
                    <dt>Cookie names {k}</dt>
                    <dd>
                      {r.cookies[k]?.join(', ') ||
                        (r.cookies[k] ? 'None in selected set' : 'Unavailable')}
                    </dd>
                  </React.Fragment>
                ))}
                {['Added', 'Removed'].map((k, i) => (
                  <React.Fragment key={k}>
                    <dt>{k}</dt>
                    <dd>
                      {r.cookies.before && r.cookies.after
                        ? (i
                            ? r.cookies.before.filter(
                                (n) => !r.cookies.after!.includes(n),
                              )
                            : r.cookies.after.filter(
                                (n) => !r.cookies.before!.includes(n),
                              )
                          ).join(', ') || 'None'
                        : 'Unknown'}
                    </dd>
                  </React.Fragment>
                ))}
              </dl>
              <h3>Observed request destinations</h3>
              {r.domains.length ? (
                r.domains.map((d) => (
                  <p key={d.host}>
                    {d.host} ·{' '}
                    {d.simulated
                      ? 'Simulated advertising'
                      : d.tracker
                        ? 'Known tracker'
                        : 'Unclassified'}{' '}
                    · {fmt(d.at)}
                  </p>
                ))
              ) : (
                <p>No permitted third-party requests recorded.</p>
              )}
            </section>
          )}
        </>
      )}
      {tab === 'Undo path' && (
        <section className="box">
          <div className="box-title">
            <GitBranch />
            <h2>Reversal graph</h2>
          </div>
          <p>
            {finished
              ? 'Review the evidence collected on this journey.'
              : step
                ? 'Follow the highlighted control on the website. Each newly inspected screen can reveal the next step.'
                : 'No known next step yet. Start the guide on the original site to inspect its visible controls.'}
          </p>
          <PathGraph record={r} />
          <div className="next">
            <small>{finished ? 'OUTCOME' : 'NEXT VISIBLE STEP'}</small>
            <strong>
              {finished
                ? r.verification
                : (step?.label ?? 'Inspect current page')}
            </strong>
            <span>
              {finished
                ? ''
                : r.current.endsWith('[private path]')
                  ? 'Page path protected'
                  : nodeTitle(r.current)}
            </span>
          </div>
          {!finished && (
            <div className="actions">
              <button
                className="primary"
                onClick={() => void call('GUIDE', r.id)}
              >
                Start or resume guide
              </button>
              <button onClick={() => void call('STOP_GUIDE', r.id)}>
                End attempt
              </button>
            </div>
          )}
        </section>
      )}
      {tab === 'Report' && (
        <section className="box">
          <div className="box-title">
            <Flag />
            <h2>Reversibility report</h2>
          </div>
          <p>
            {r.action} on {r.domain}.{' '}
            {r.simulated ? 'Fictional demo workflow.' : ''}
          </p>
          <div className="facts">
            <span>Verification</span>
            <strong>{r.verification}</strong>
            <span>Financial commitment</span>
            <strong>
              {r.category === 'subscription' ? price(r) : 'Not applicable'}
            </strong>
            <span>Entry / reversal actions</span>
            <strong>
              {r.entry.length} / {r.reversal.length}
            </strong>
            <span>Reversibility ratio</span>
            <strong>
              {drr === null
                ? 'Insufficient journey coverage'
                : drr.toFixed(2) + '×'}
            </strong>
          </div>
          <p className="note">
            The ratio divides observed reversal actions by observed entry
            actions. It is a prototype usability metric, independent of legal
            and accessibility standards.
          </p>
          <h3>Entry journey</h3>
          {entries(r.entry)}
          <h3>Reversal journey</h3>
          {r.reversal.length ? (
            entries(r.reversal)
          ) : (
            <p>No guided steps recorded.</p>
          )}
          <h3>Accessibility barriers</h3>
          {r.barriers.length ? (
            <ul>
              {r.barriers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          ) : (
            <p>No barriers recorded by the selected checks.</p>
          )}
          <h3>Supporting evidence</h3>
          {entries(r.evidence)}
        </section>
      )}
      <section className="box">
        <div className="box-title">
          <ShieldCheck />
          <h2>Verification</h2>
        </div>
        <strong>{r.verification}</strong>
        <p>
          {r.verifiedAt
            ? 'Last checked ' + fmt(r.verifiedAt)
            : 'Awaiting a relevant change in the website’s visible status.'}
        </p>
        <div className="actions">
          <button onClick={say}>
            <AudioLines size={15} /> Read aloud
          </button>
          {!finished && (
            <button onClick={() => setConfirm(true)}>
              <CheckCheck size={15} /> Mark as resolved
            </button>
          )}
        </div>
        {confirm && (
          <p className="notice">
            Record your own resolution for this commitment?{' '}
            <button
              ref={resolution}
              onClick={() => {
                void call('RESOLVE', r.id)
                setConfirm(false)
              }}
            >
              Confirm manual resolution
            </button>{' '}
            <button onClick={() => setConfirm(false)}>Keep open</button>
          </p>
        )}
        {error && <p role="status">{error}</p>}
      </section>
    </>
  )
}
