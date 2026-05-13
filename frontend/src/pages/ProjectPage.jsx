import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useProjectStore } from '../stores/projectStore'
import api from '../lib/api'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import toast from 'react-hot-toast'

const STEPS = {
  starting: { label: 'Starting', pct: 5 },
  scraping: { label: 'Scraping website', pct: 20 },
  extracting_keywords: { label: 'Extracting keywords', pct: 45 },
  fetching_seo_data: { label: 'Fetching SEO data', pct: 65 },
  generating_blog: { label: 'Writing blog post', pct: 85 },
  completed: { label: 'Complete!', pct: 100 },
}

export default function ProjectPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { currentProject, setCurrentProject, fetchHistory, history } = useProjectStore()

  const [tab, setTab] = useState('analysis') // analysis | keywords | blog | history
  const [running, setRunning] = useState(false)
  const [step, setStep] = useState('')
  const [logs, setLogs] = useState([])
  const [progress, setProgress] = useState(0)
  const [keywords, setKeywords] = useState([])
  const [blogPost, setBlogPost] = useState(null)
  const [project, setProject] = useState(currentProject)
  const logsRef = useRef(null)
  const esRef = useRef(null)

  useEffect(() => {
    if (!project) {
      api.get(`/projects/${id}`).then(r => setProject(r.data)).catch(() => navigate('/dashboard'))
    }
    fetchHistory(id).then(h => {
      if (h?.keywords?.length) setKeywords(h.keywords)
      if (h?.blogs?.length) setBlogPost(h.blogs[0])
    })
  }, [id])

  useEffect(() => {
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight
    }
  }, [logs])

  const startAnalysis = () => {
    if (running) return
    setRunning(true)
    setStep('starting')
    setProgress(5)
    setLogs([])
    setKeywords([])
    setBlogPost(null)

    const token = localStorage.getItem('access_token')
    const url = `/api/v1/analyze/${id}/run`

    // Use fetch for SSE with auth header
    fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      credentials: 'include',
    }).then(response => {
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      const read = () => {
        reader.read().then(({ done, value }) => {
          if (done) {
            setRunning(false)
            return
          }
          buffer += decoder.decode(value, { stream: true })
          const messages = buffer.split('\n\n')
          buffer = messages.pop() || ''

          for (const message of messages) {
            const line = message.split('\n').find(l => l.startsWith('data: '))
            if (line) {
              try {
                const data = JSON.parse(line.slice(6))
                if (data.type === 'progress') {
                  setStep(data.step)
                  setProgress(prevProg => STEPS[data.step]?.pct || prevProg)
                  if (data.log?.length) {
                    setLogs(prev => {
                      const msgs = data.log.map(l => l.msg)
                      const newMsgs = msgs.filter(m => !prev.includes(m))
                      return [...prev, ...newMsgs]
                    })
                  }
                } else if (data.type === 'completed') {
                  setKeywords(data.keywords || [])
                  setBlogPost(data.blog_post || null)
                  setStep('completed')
                  setProgress(100)
                  setRunning(false)
                  toast.success(`Found ${data.keyword_count} keywords!`)
                  setTab('keywords')
                  fetchHistory(id)
                } else if (data.type === 'error') {
                  toast.error(data.message || 'Analysis failed')
                  setRunning(false)
                  setStep('')
                }
              } catch (e) {
                console.error('SSE parse error:', e)
              }
            }
          }
          read()
        }).catch(err => {
          console.error('SSE stream error:', err)
          setRunning(false)
        })
      }
      read()
    }).catch(err => {
      toast.error('Failed to start analysis')
      setRunning(false)
    })
  }

  const intentColors = {
    transactional: { bg: 'rgba(251,191,36,0.12)', color: '#fbbf24' },
    commercial: { bg: 'rgba(167,139,250,0.12)', color: '#a78bfa' },
    informational: { bg: 'rgba(110,231,183,0.12)', color: '#6ee7b7' },
    navigational: { bg: 'rgba(156,163,175,0.12)', color: '#9ca3af' },
  }

  return (
    <div style={styles.root}>
      {/* Top bar */}
      <header style={styles.topBar}>
        <button style={styles.backBtn} onClick={() => navigate('/dashboard')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M5 12l7 7M5 12l7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Dashboard
        </button>
        <div style={styles.projectInfo}>
          <span style={styles.projectDomain}>{project ? new URL(project.url).hostname : '...'}</span>
          <h1 style={styles.projectName}>{project?.name || 'Loading...'}</h1>
        </div>
        <button
          style={{ ...styles.runBtn, opacity: running ? 0.6 : 1 }}
          onClick={startAnalysis}
          disabled={running}
        >
          {running ? (
            <><span style={styles.spinner} /> Analyzing...</>
          ) : (
            <><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 3l14 9-14 9V3z" fill="currentColor"/></svg> Run Analysis</>
          )}
        </button>
      </header>

      {/* Tabs */}
      <div style={styles.tabs}>
        {[
          { id: 'analysis', label: 'Live Feed' },
          { id: 'keywords', label: `Keywords${keywords.length ? ` (${keywords.length})` : ''}` },
          { id: 'blog', label: 'Blog Post' },
          { id: 'history', label: 'History' },
        ].map(t => (
          <button
            key={t.id}
            style={{ ...styles.tab, ...(tab === t.id ? styles.tabActive : {}) }}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={styles.content}>

        {/* ANALYSIS TAB */}
        {tab === 'analysis' && (
          <div style={styles.analysisPane} className="fade-in">
            {!running && !logs.length ? (
              <div style={styles.startPrompt}>
                <div style={styles.startIcon}>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="var(--accent)" strokeWidth="1.5"/><path d="M10 8l6 4-6 4V8z" fill="var(--accent)"/></svg>
                </div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginBottom: 8 }}>Ready to analyze</h2>
                <p style={{ color: 'var(--text2)', fontSize: 14, maxWidth: 380, textAlign: 'center', marginBottom: 28 }}>
                  Click <strong style={{ color: 'var(--text)' }}>Run Analysis</strong> to scrape{' '}
                  <span style={{ color: 'var(--accent)' }}>{project ? new URL(project.url).hostname : '...'}</span>,
                  extract trending keywords, and generate an SEO blog post — all automatically.
                </p>
                <button style={styles.runBtn} onClick={startAnalysis}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 3l14 9-14 9V3z" fill="currentColor"/></svg>
                  Start Analysis
                </button>
              </div>
            ) : (
              <div style={styles.feedWrap}>
                {/* Progress bar */}
                <div style={styles.progressWrap}>
                  <div style={styles.progressHeader}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: running ? 'var(--accent)' : 'var(--text2)' }}>
                      {running ? (STEPS[step]?.label || 'Processing...') : '✓ Complete'}
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--text2)' }}>{progress}%</span>
                  </div>
                  <div style={styles.progressTrack}>
                    <div style={{ ...styles.progressBar, width: `${progress}%` }} />
                  </div>
                </div>

                {/* Steps */}
                <div style={styles.stepsRow}>
                  {Object.entries(STEPS).filter(([k]) => k !== 'starting').map(([key, val]) => {
                    const done = val.pct <= progress && progress > 5
                    const active = step === key
                    return (
                      <div key={key} style={{ ...styles.stepItem, opacity: done || active ? 1 : 0.3 }}>
                        <div style={{
                          ...styles.stepDot,
                          background: done ? 'var(--accent)' : active ? 'var(--accent-dim)' : 'var(--surface)',
                          border: active ? '2px solid var(--accent)' : '2px solid var(--border)',
                        }}>
                          {done && !active && <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 7" stroke="#0a0a0f" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                          {active && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 1s infinite', display: 'block' }} />}
                        </div>
                        <span style={{ fontSize: 11, color: active ? 'var(--accent)' : done ? 'var(--text2)' : 'var(--text3)' }}>{val.label}</span>
                      </div>
                    )
                  })}
                </div>

                {/* Log feed */}
                <div style={styles.logFeed} ref={logsRef}>
                  {logs.map((log, i) => (
                    <div key={i} style={styles.logLine} className="slide-in">
                      <span style={styles.logBullet}>›</span>
                      <span>{log}</span>
                    </div>
                  ))}
                  {running && (
                    <div style={styles.logLine}>
                      <span style={{ color: 'var(--accent)', animation: 'blink 1s infinite' }}>█</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* KEYWORDS TAB */}
        {tab === 'keywords' && (
          <div className="fade-in">
            {keywords.length === 0 ? (
              <div style={styles.emptyTab}>
                <p style={{ color: 'var(--text2)' }}>No keywords yet. Run an analysis first.</p>
              </div>
            ) : (
              <>
                <div style={styles.kwHeader}>
                  <div>
                    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>SEO Keywords</h2>
                    <p style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>{keywords.length} keywords ranked by opportunity score</p>
                  </div>
                </div>
                <div style={styles.table}>
                  <div style={styles.tableHead}>
                    <div style={{ flex: 3 }}>Keyword</div>
                    <div style={{ flex: 1, textAlign: 'center' }}>Volume</div>
                    <div style={{ flex: 1, textAlign: 'center' }}>Difficulty</div>
                    <div style={{ flex: 1, textAlign: 'center' }}>CPC</div>
                    <div style={{ flex: 1, textAlign: 'center' }}>Intent</div>
                    <div style={{ flex: 1, textAlign: 'center' }}>Score</div>
                  </div>
                  {keywords.map((kw, i) => {
                    const ic = intentColors[kw.intent] || intentColors.informational
                    return (
                      <div key={kw.id || i} style={{ ...styles.tableRow, animationDelay: `${i * 30}ms` }} className="fade-in">
                        <div style={{ flex: 3, display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={styles.kwRank}>#{kw.position || i + 1}</span>
                          <span style={{ fontSize: 14, fontWeight: 500 }}>{kw.keyword}</span>
                        </div>
                        <div style={{ flex: 1, textAlign: 'center', fontSize: 13, color: 'var(--text2)' }}>
                          {(kw.search_volume || 0).toLocaleString()}
                        </div>
                        <div style={{ flex: 1, textAlign: 'center' }}>
                          <div style={{ ...styles.diffBar }}>
                            <div style={{
                              height: '100%', borderRadius: 2,
                              width: `${kw.difficulty || 0}%`,
                              background: kw.difficulty > 70 ? 'var(--red)' : kw.difficulty > 40 ? 'var(--amber)' : 'var(--accent)',
                              transition: 'width 0.5s ease',
                            }} />
                          </div>
                          <span style={{ fontSize: 11, color: 'var(--text3)' }}>{Math.round(kw.difficulty || 0)}</span>
                        </div>
                        <div style={{ flex: 1, textAlign: 'center', fontSize: 13, color: 'var(--text2)' }}>
                          ${(kw.cpc || 0).toFixed(2)}
                        </div>
                        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                          <span style={{ ...styles.intentBadge, background: ic.bg, color: ic.color }}>
                            {kw.intent}
                          </span>
                        </div>
                        <div style={{ flex: 1, textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, color: 'var(--accent)' }}>
                          {Math.round(kw.score || 0)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* BLOG TAB */}
        {tab === 'blog' && (
          <div className="fade-in">
            {!blogPost ? (
              <div style={styles.emptyTab}>
                <p style={{ color: 'var(--text2)' }}>No blog post yet. Run an analysis first.</p>
              </div>
            ) : (
              <div style={styles.blogWrap}>
                <div style={styles.blogMeta}>
                  <div>
                    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, marginBottom: 6 }}>{blogPost.title}</h2>
                    {blogPost.meta_description && (
                      <p style={styles.metaDesc}>
                        <strong style={{ color: 'var(--accent)', fontSize: 11 }}>META</strong> {blogPost.meta_description}
                      </p>
                    )}
                  </div>
                  <div style={styles.blogStats}>
                    <span style={styles.blogStat}>{blogPost.word_count || 0} words</span>
                    <span style={styles.blogStat}>{(blogPost.keywords_used || []).length} keywords</span>
                  </div>
                </div>
                {blogPost.keywords_used?.length > 0 && (
                  <div style={styles.kwPills}>
                    {blogPost.keywords_used.map((kw, i) => (
                      <span key={i} style={styles.kwPill}>{kw}</span>
                    ))}
                  </div>
                )}
                <div style={styles.blogContent}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{blogPost.content}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        )}

        {/* HISTORY TAB */}
        {tab === 'history' && (
          <div className="fade-in">
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 20 }}>Analysis History</h2>
            {!history?.runs?.length ? (
              <div style={styles.emptyTab}><p style={{ color: 'var(--text2)' }}>No history yet.</p></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {history.runs.map((run, i) => (
                  <div key={run.id} style={styles.historyCard} className="fade-in">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                        background: run.status === 'completed' ? 'var(--accent)' : run.status === 'failed' ? 'var(--red)' : 'var(--amber)',
                      }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, textTransform: 'capitalize' }}>{run.status}</div>
                        <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                          {run.started_at ? new Date(run.started_at).toLocaleString() : ''}
                          {run.finished_at ? ` · ${Math.round((new Date(run.finished_at) - new Date(run.started_at)) / 1000)}s` : ''}
                        </div>
                      </div>
                      {run.status === 'completed' && (
                        <span style={{ fontSize: 12, color: 'var(--text3)' }}>Step: {run.current_step}</span>
                      )}
                    </div>
                    {run.error_message && (
                      <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 8, padding: '8px 12px', background: 'var(--red-dim)', borderRadius: 6 }}>
                        {run.error_message}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const styles = {
  root: { minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' },
  topBar: {
    display: 'flex', alignItems: 'center', gap: 20,
    padding: '16px 40px', background: 'var(--bg2)',
    borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 10,
  },
  backBtn: {
    display: 'flex', alignItems: 'center', gap: 6,
    background: 'none', color: 'var(--text2)', fontSize: 13,
    padding: '6px 10px', borderRadius: 6, transition: 'color 0.15s',
  },
  projectInfo: { flex: 1, minWidth: 0 },
  projectDomain: {
    fontSize: 11, color: 'var(--accent)', fontWeight: 500,
    background: 'var(--accent-dim)', padding: '2px 8px', borderRadius: 100,
    display: 'inline-block', marginBottom: 4,
  },
  projectName: { fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-display)' },
  runBtn: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'var(--accent)', color: '#0a0a0f',
    fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13,
    padding: '10px 20px', borderRadius: 'var(--radius-sm)',
    transition: 'opacity 0.15s', cursor: 'pointer',
    whiteSpace: 'nowrap', flexShrink: 0,
  },
  tabs: {
    display: 'flex', gap: 0, padding: '0 40px',
    background: 'var(--bg2)', borderBottom: '1px solid var(--border)',
  },
  tab: {
    background: 'none', color: 'var(--text2)', fontSize: 13, fontWeight: 500,
    padding: '14px 20px', cursor: 'pointer', borderBottom: '2px solid transparent',
    transition: 'all 0.15s',
  },
  tabActive: { color: 'var(--accent)', borderBottomColor: 'var(--accent)' },
  content: { flex: 1, padding: '32px 40px', maxWidth: 1100, width: '100%', margin: '0 auto' },
  analysisPane: { minHeight: 400 },
  startPrompt: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: '80px 40px', textAlign: 'center',
  },
  startIcon: {
    width: 80, height: 80, background: 'var(--accent-dim)',
    border: '1px solid var(--accent-glow)', borderRadius: 20,
    display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24,
  },
  feedWrap: { display: 'flex', flexDirection: 'column', gap: 24 },
  progressWrap: {
    background: 'var(--bg2)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius)', padding: '20px 24px',
  },
  progressHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: 10 },
  progressTrack: { height: 6, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' },
  progressBar: {
    height: '100%', background: 'var(--accent)', borderRadius: 3,
    transition: 'width 0.6s ease',
    boxShadow: '0 0 12px var(--accent-glow)',
  },
  stepsRow: { display: 'flex', gap: 0, flexWrap: 'wrap' },
  stepItem: { display: 'flex', alignItems: 'center', gap: 6, padding: '12px 16px', flex: '1 1 0' },
  stepDot: {
    width: 22, height: 22, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, transition: 'all 0.3s',
  },
  logFeed: {
    background: 'var(--bg2)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius)', padding: '20px', fontFamily: 'monospace',
    fontSize: 13, maxHeight: 300, overflowY: 'auto',
    display: 'flex', flexDirection: 'column', gap: 6,
  },
  logLine: { display: 'flex', gap: 10, alignItems: 'flex-start', color: 'var(--text2)' },
  logBullet: { color: 'var(--accent)', flexShrink: 0, marginTop: 1 },
  kwHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  table: {
    background: 'var(--bg2)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)', overflow: 'hidden',
  },
  tableHead: {
    display: 'flex', alignItems: 'center', padding: '12px 20px',
    background: 'var(--surface)', fontSize: 11, fontWeight: 600,
    color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em',
    borderBottom: '1px solid var(--border)',
  },
  tableRow: {
    display: 'flex', alignItems: 'center', padding: '14px 20px',
    borderBottom: '1px solid var(--border)', transition: 'background 0.15s',
    animationFillMode: 'both',
  },
  kwRank: {
    width: 28, height: 28, borderRadius: 6, background: 'var(--surface)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 11, color: 'var(--text3)', flexShrink: 0,
  },
  diffBar: { height: 4, background: 'var(--surface2)', borderRadius: 2, overflow: 'hidden', marginBottom: 2 },
  intentBadge: {
    fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 100,
    textTransform: 'capitalize', letterSpacing: '0.03em',
  },
  emptyTab: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 80, color: 'var(--text2)',
  },
  blogWrap: { maxWidth: 780 },
  blogMeta: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 16, gap: 20,
  },
  metaDesc: {
    fontSize: 13, color: 'var(--text2)', marginTop: 8,
    background: 'var(--surface)', padding: '8px 12px', borderRadius: 8,
    display: 'flex', gap: 8, alignItems: 'flex-start',
  },
  blogStats: { display: 'flex', gap: 8, flexShrink: 0 },
  blogStat: {
    fontSize: 12, color: 'var(--text2)', background: 'var(--surface)',
    padding: '4px 10px', borderRadius: 100, border: '1px solid var(--border)',
  },
  kwPills: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 24 },
  kwPill: {
    fontSize: 11, background: 'var(--accent-dim)', color: 'var(--accent)',
    padding: '3px 10px', borderRadius: 100,
  },
  blogContent: {
    background: 'var(--bg2)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)', padding: '32px',
    fontSize: 15, lineHeight: 1.8, color: 'var(--text)',
  },
  historyCard: {
    background: 'var(--bg2)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius)', padding: '16px 20px',
  },
  spinner: {
    width: 14, height: 14, border: '2px solid rgba(0,0,0,0.3)',
    borderTopColor: '#0a0a0f', borderRadius: '50%',
    animation: 'spin 0.7s linear infinite', display: 'inline-block',
  },
}
