import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Activity,
  BellRing,
  BookOpen,
  CalendarDays,
  CheckCheck,
  ChevronRight,
  CircleDot,
  CreditCard,
  Database,
  ExternalLink,
  Eye,
  Fingerprint,
  GitBranch,
  Globe2,
  Layers3,
  LayoutDashboard,
  ListFilter,
  LoaderCircle,
  LockKeyhole,
  Monitor,
  PanelLeftOpen,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react'
import {
  DEMO,
  STILLFRAME_PATH,
  EMPTY,
  FIXTURE,
  sitePattern,
  type Database as DB,
  type RecordItem,
} from '../types'
import { Detail, fmt, price } from '../components/Detail'
import { Mark, Optics } from '../components/Optics'
import './style.css'

const compact = location.pathname.endsWith('sidepanel.html')
const today = () =>
  new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(Date.now())
async function rpc<T>(type: string, data: object = {}): Promise<T> {
  const res = await chrome.runtime.sendMessage({ type, ...data })
  if (!res?.ok) throw Error(res?.error ?? 'Extension worker is unavailable.')
  return res.value
}
const items = [
  { name: 'Overview', icon: LayoutDashboard },
  { name: 'Subscriptions', icon: CreditCard },
  { name: 'Cookie consent', icon: Fingerprint },
  { name: 'Reversed', icon: CheckCheck },
  { name: 'Needs attention', icon: BellRing },
]
const isOpen = (r: RecordItem) => !['Reversed', 'Resolved'].includes(r.status)
const attention = (r: RecordItem) =>
  r.inconsistent ||
  r.status === 'Suspected' ||
  ['Partially verified', 'Unable to verify'].includes(r.verification)
type View = 'Evidence' | 'Undo path' | 'Report' | 'Resolve'
function App() {
  const [db, setDB] = useState<DB>(EMPTY),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [view, setView] = useState('Overview'),
    [filter, setFilter] = useState('All statuses'),
    [search, setSearch] = useState(''),
    [id, setId] = useState(''),
    [detail, setDetail] = useState<View>('Evidence'),
    [input, setInput] = useState(DEMO),
    [audit, setAudit] = useState(true),
    [deleting, setDeleting] = useState(false),
    [menu, setMenu] = useState(false)
  const [message, setMessage] = useState('')
  const record = db.records.find((r) => r.id === id)
  useEffect(() => {
    let live = true
    const load = () =>
      rpc<DB>('GET')
        .then((d) => {
          if (live) {
            setDB(d)
            setLoading(false)
          }
        })
        .catch((e) => {
          if (live) {
            setError(e.message)
            setLoading(false)
          }
        })
    void load()
    const change = (
      c: { [key: string]: chrome.storage.StorageChange },
      area: string,
    ) => {
      if (c.memory && area === 'local')
        setDB((c.memory.newValue as DB | undefined) ?? EMPTY)
    }
    chrome.storage.onChanged.addListener(change)
    if (compact)
      void chrome.tabs
        .query({ active: true, currentWindow: true })
        .then(([t]) => {
          if (t.url && /^https?:/.test(t.url)) setInput(new URL(t.url).origin)
        })
    return () => {
      live = false
      chrome.storage.onChanged.removeListener(change)
    }
  }, [])
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await fn()
      return true
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Could not complete this action.',
      )
      return false
    } finally {
      setBusy(false)
    }
  }
  const call = (type: string, id: string) =>
    run(async () => {
      await rpc(type, { id })
      if (type === 'GUIDE')
        setMessage(
          'Guide attached to the website. Follow the highlighted controls.',
        )
    })
  const nav = (name: string) => {
    setView(name)
    setId('')
    setFilter('All statuses')
    setSearch('')
    setMenu(false)
    setError('')
    setMessage('')
    setDeleting(false)
  }
  const open = (r: RecordItem, d: View) => {
    setDetail(d)
    setId(r.id)
    window.scrollTo(0, 0)
  }
  const allow = () =>
    run(async () => {
      const u = new URL(input)
      if (!/^https?:$/.test(u.protocol) || u.username || u.password)
        throw Error('Enter an HTTP or HTTPS website address.')
      const withAudit = u.origin === DEMO && audit
      const granted = await chrome.permissions.request({
        permissions: ['webRequest'],
        origins: [
          sitePattern(u.origin),
          ...(withAudit ? [sitePattern(FIXTURE)] : []),
        ],
      })
      if (!granted)
        throw Error(
          'Site access was declined. You can enable it here when ready.',
        )
      await rpc('ALLOW', { origin: u.origin, auditDemo: withAudit })
      setMessage('Recording enabled for ' + u.origin + '.')
    })
  const latestConsent = new Map<string, string>()
  for (const r of db.records)
    if (
      r.category === 'consent' &&
      r.action !== 'Customise preferences' &&
      !latestConsent.has(r.origin)
    )
      latestConsent.set(r.origin, r.id)
  const active = db.records.filter(
      (r) =>
        r.status === 'Active' ||
        (r.status === 'Recorded' &&
          r.action === 'Accept cookies' &&
          latestConsent.get(r.origin) === r.id),
    ),
    reversed = db.records.filter((r) => r.status === 'Reversed'),
    flagged = db.records.filter(attention)
  const renewals = active
    .filter(
      (r) =>
        r.terms.renewal &&
        r.terms.renewal >= new Date().toISOString().slice(0, 10),
    )
    .sort((a, b) => a.terms.renewal!.localeCompare(b.terms.renewal!))
  const filtered = db.records.filter(
    (r) =>
      (view === 'Overview' ||
        (view === 'Subscriptions' && r.category === 'subscription') ||
        (view === 'Cookie consent' && r.category === 'consent') ||
        (view === 'Reversed' && r.status === 'Reversed') ||
        (view === 'Needs attention' && attention(r))) &&
      (filter === 'All statuses' || r.status === filter) &&
      (r.domain + ' ' + r.action + ' ' + r.origin + ' ' + r.verification)
        .toLowerCase()
        .includes(search.toLowerCase()),
  )
  const access = view === 'Site access'
  const full = () =>
    void chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') })
  const accessForm = (
    <section className="box access-box">
      <div className="box-title">
        <Globe2 />
        <h2>Enable a website</h2>
      </div>
      <p>
        ExitLens can observe commitment controls, selected cookie names and
        permitted request domains on websites you enable.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void allow()
        }}
      >
        <label className="field">
          Website origin
          <input
            type="url"
            value={input}
            required
            onChange={(e) => setInput(e.target.value)}
            placeholder="https://example.com"
          />
        </label>
        {input.replace(/\/$/, '') === DEMO && (
          <label className="check">
            <input
              type="checkbox"
              checked={audit}
              onChange={(e) => setAudit(e.target.checked)}
            />{' '}
            Include the simulated tracker at localhost:4173
          </label>
        )}
        <div className="actions">
          <button className="primary" disabled={busy} type="submit">
            <Plus size={16} /> Enable recording
          </button>
          <a className="btn" href={DEMO + STILLFRAME_PATH} target="_blank" rel="noreferrer">
            Open demo <ExternalLink size={14} />
          </a>
        </div>
      </form>
    </section>
  )
  return (
    <div className={'shell ' + (compact ? 'compact' : '')}>
      <aside className={'sidebar ' + (menu ? 'expanded' : '')}>
        <div className="brand">
          <Mark />
          ExitLens
        </div>
        <div className="nav-group">WORKSPACE</div>
        <nav>
          {items.map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={view === name ? 'on' : ''}
              onClick={() => nav(name)}
            >
              <Icon size={18} />
              {name}
              {name === 'Needs attention' && flagged.length > 0 && (
                <b>{flagged.length}</b>
              )}
            </button>
          ))}
        </nav>
        <div className="nav-group">PREFERENCES</div>
        <nav>
          <button
            className={access ? 'on' : ''}
            onClick={() => nav('Site access')}
          >
            <ShieldCheck size={18} />
            Site access
          </button>
        </nav>
        <div className="side-foot">
          <span className="local-icon">
            <LockKeyhole size={18} />
          </span>
          <div>
            <strong>Local workspace</strong>
            <small>On this device</small>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              aria-label="Toggle navigation"
              aria-expanded={menu}
              className="menu"
              onClick={() => setMenu(!menu)}
            >
              <PanelLeftOpen size={18} />
            </button>
            <span className="crumb-brand">ExitLens</span>
            <span className="wide-crumb">Workspace</span>
            <ChevronRight size={13} />
            <strong>{view}</strong>
          </div>
          <span className="local">
            <i />
            Local only
          </span>
          {compact && (
            <button aria-label="Open full dashboard" onClick={full}>
              <ExternalLink size={16} />
            </button>
          )}
        </header>
        <main>
          {error && (
            <div role="alert" className="notice error">
              {error}
              <button aria-label="Dismiss error" onClick={() => setError('')}>
                <X size={14} />
              </button>
            </div>
          )}
          {message && (
            <div role="status" className="notice">
              {message}
              <button
                aria-label="Dismiss message"
                onClick={() => setMessage('')}
              >
                <X size={14} />
              </button>
            </div>
          )}
          {loading ? (
            <div className="box">
              <LoaderCircle /> Loading local memory…
            </div>
          ) : record ? (
            <Detail
              key={record.id + detail}
              r={record}
              initial={detail}
              back={() => setId('')}
              call={call}
            />
          ) : access ? (
            <>
              <div className="eyebrow">
                <ShieldCheck size={14} /> PRIVACY CONTROLS
              </div>
              <h1>Site access</h1>
              <p className="intro">
                Choose where ExitLens can observe your interactions.
              </p>
              {accessForm}
              <section className="box">
                <h2>Authorised websites</h2>
                {db.sites.length ? (
                  db.sites.map((s) => (
                    <div className="site-row" key={s.origin}>
                      <div>
                        <strong>{s.origin}</strong>
                        <small>
                          {s.auditDemo
                            ? 'Local tracker fixture enabled'
                            : 'Site observation enabled'}
                        </small>
                      </div>
                      <button
                        disabled={busy}
                        onClick={() =>
                          void run(() => rpc('REVOKE', { origin: s.origin }))
                        }
                      >
                        Remove access
                      </button>
                    </div>
                  ))
                ) : (
                  <p>No websites enabled.</p>
                )}
              </section>
              <section className="box">
                <div className="box-title">
                  <Database />
                  <h2>Local data</h2>
                </div>
                <p>
                  {db.records.length} saved records. Clearing memory removes
                  commitments, graphs and evidence from this device.
                </p>
                <button
                  disabled={!db.records.length || busy}
                  onClick={() => setDeleting(true)}
                >
                  <Trash2 size={15} /> Clear memory
                </button>
                {deleting && (
                  <p className="notice">
                    Permanently erase all saved records?{' '}
                    <button
                      onClick={() =>
                        void run(async () => {
                          await rpc('CLEAR')
                          setDeleting(false)
                        })
                      }
                    >
                      Erase all records
                    </button>
                    <button onClick={() => setDeleting(false)}>
                      Keep records
                    </button>
                  </p>
                )}
              </section>
            </>
          ) : (
            <>
              <div className="eyebrow">
                <CircleDot size={14} /> COMMITMENT MEMORY
              </div>
              <div className="section-top">
                <div>
                  <h1>{view === 'Overview' ? 'Commitment overview' : view}</h1>
                  <p className="intro">
                    {view === 'Overview'
                      ? 'Your digital commitments, reversal paths and evidence in one place.'
                      : view === 'Reversed'
                        ? 'Commitments with observable evidence of reversal.'
                        : view === 'Needs attention'
                          ? 'Suspected commitments, incomplete checks and consent inconsistencies.'
                          : view === 'Subscriptions'
                            ? 'Memberships, trial terms and upcoming renewals.'
                            : 'Consent choices and the activity observed afterwards.'}
                  </p>
                </div>
                <button
                  className="head-access"
                  onClick={() => nav('Site access')}
                >
                  <ShieldCheck size={15} /> Site access
                </button>
              </div>
              {view === 'Overview' && (
                <>
                  <div className="stats">
                    {[
                      {
                        label: 'Active commitments',
                        n: active.length,
                        icon: Layers3,
                        tone: 'lilac',
                      },
                      {
                        label: 'Upcoming renewals',
                        n: renewals.length,
                        icon: CalendarDays,
                        tone: 'amber',
                      },
                      {
                        label: 'Needs attention',
                        n: flagged.length,
                        icon: Activity,
                        tone: 'rose',
                      },
                      {
                        label: 'Verified reversals',
                        n: reversed.length,
                        icon: CheckCheck,
                        tone: 'mint',
                      },
                    ].map(({ label, n, icon: Icon, tone }) => (
                      <div className={'stat ' + tone} key={label}>
                        <div>
                          <Icon size={17} />
                          <span>{label}</span>
                        </div>
                        <strong>{n.toString().padStart(2, '0')}</strong>
                      </div>
                    ))}
                  </div>
                  <section className="feature">
                    <div>
                      <div className="eyebrow">
                        <span className="beam" />
                        {renewals.length
                          ? 'NEXT RENEWAL'
                          : db.sites.length
                            ? 'OBSERVATION ENABLED'
                            : 'GET STARTED'}
                      </div>
                      <h2>
                        {renewals.length
                          ? renewals[0].terms.renewal
                          : db.sites.length
                            ? 'Ready to remember.'
                            : 'Enable your first website.'}
                      </h2>
                      <p>
                        {renewals.length
                          ? renewals[0].domain + ' · ' + price(renewals[0])
                          : db.sites.length
                            ? 'Make a consent choice or start a trial on an authorised site.'
                            : 'Choose a site to start recording consent choices and subscriptions.'}
                      </p>
                      {renewals.length ? (
                        <button onClick={() => open(renewals[0], 'Evidence')}>
                          View renewal
                        </button>
                      ) : db.sites.some((s) => s.origin === DEMO) ? (
                        <a
                          className="btn"
                          href={DEMO + STILLFRAME_PATH}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open fictional demo <ExternalLink size={14} />
                        </a>
                      ) : (
                        <button onClick={() => nav('Site access')}>
                          <Plus size={15} />{' '}
                          {db.sites.length ? 'Manage sites' : 'Enable a site'}
                        </button>
                      )}
                    </div>
                    <Optics />
                  </section>
                </>
              )}
              <section className="ledger">
                <div className="ledger-head">
                  <div>
                    <div className="eyebrow">
                      <span className="beam" /> ACTIVITY
                    </div>
                    <h2>
                      Commitment ledger <span>{filtered.length}</span>
                    </h2>
                  </div>
                  <div className="date">
                    <CalendarDays size={14} />
                    {today()}
                  </div>
                </div>
                <div className="filters">
                  <label className="search">
                    <Search size={16} />
                    <input
                      aria-label="Search commitments"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search commitments…"
                    />
                  </label>
                  <label className="filter">
                    <ListFilter size={15} />
                    <select
                      aria-label="Filter by status"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    >
                      {[
                        'All statuses',
                        'Active',
                        'Recorded',
                        'Suspected',
                        'Reversed',
                        'Resolved',
                      ].map((k) => (
                        <option key={k}>{k}</option>
                      ))}
                    </select>
                  </label>
                </div>
                {filtered.length ? (
                  filtered.map((r) => (
                    <article key={r.id} className="record">
                      <div
                        className={
                          'record-icon ' +
                          (r.category === 'consent' ? 'mint' : 'lilac')
                        }
                      >
                        {r.category === 'consent' ? (
                          <Fingerprint />
                        ) : (
                          <CreditCard />
                        )}
                      </div>
                      <div className="record-main">
                        <div className="record-top">
                          <h3>{r.action}</h3>
                          <span
                            className={
                              'pill ' + (r.status === 'Reversed' ? 'green' : '')
                            }
                          >
                            {r.status}
                          </span>
                        </div>
                        <small>
                          {r.domain} · {fmt(r.at)}
                          {r.simulated ? ' · Simulated' : ''}
                        </small>
                        <p>
                          {r.category === 'subscription'
                            ? price(r) +
                              ' · ' +
                              (r.terms.trialDays
                                ? r.terms.trialDays + '-day trial'
                                : r.confidence)
                            : r.inconsistent
                              ? 'Potential consent inconsistency'
                              : r.confidence}{' '}
                          · {r.verification}
                        </p>
                        <div className="actions">
                          {isOpen(r) && (
                            <button onClick={() => open(r, 'Undo path')}>
                              <GitBranch size={14} />
                              Find Undo Path
                            </button>
                          )}
                          <button onClick={() => open(r, 'Evidence')}>
                            <Eye size={14} /> View Evidence
                          </button>
                          {!isOpen(r) ? (
                            <button onClick={() => open(r, 'Report')}>
                              View report
                            </button>
                          ) : (
                            <button onClick={() => open(r, 'Resolve')}>
                              Mark as resolved
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="empty">
                    <div className="empty-icon">
                      <BookOpen size={23} />
                    </div>
                    <h3>
                      {search || filter !== 'All statuses'
                        ? 'No matching commitments'
                        : view === 'Overview'
                          ? 'Your ledger is empty'
                          : 'No records in this view'}
                    </h3>
                    <p>
                      {search || filter !== 'All statuses'
                        ? 'Try another search or status filter.'
                        : view === 'Overview'
                          ? 'Observed commitments will appear here automatically.'
                          : 'Matching commitments will appear here.'}
                    </p>
                  </div>
                )}
              </section>
              <div className="bottom">
                <span>
                  <LockKeyhole size={12} /> Stored on this device
                </span>
                <span>
                  <Monitor size={13} />
                  {db.sites.length} authorised{' '}
                  {db.sites.length === 1 ? 'site' : 'sites'}
                </span>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
createRoot(document.getElementById('root')!).render(<App />)
