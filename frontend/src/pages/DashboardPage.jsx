import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { useProjectStore } from '../stores/projectStore'
import toast from 'react-hot-toast'

export default function DashboardPage() {
  const { user, logout } = useAuthStore()
  const { projects, loading, fetchProjects, createProject, deleteProject, setCurrentProject } = useProjectStore()
  const navigate = useNavigate()
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', url: '', description: '' })
  const [creating, setCreating] = useState(false)

  useEffect(() => { fetchProjects() }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!form.name || !form.url) return toast.error('Name and URL are required')
    setCreating(true)
    try {
      const project = await createProject(form.name, form.url, form.description)
      setShowCreate(false)
      setForm({ name: '', url: '', description: '' })
      toast.success('Project created!')
      setCurrentProject(project)
      navigate(`/project/${project.id}`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create project')
    } finally { setCreating(false) }
  }

  const handleDelete = async (e, id) => {
    e.stopPropagation()
    if (!confirm('Delete this project and all its data?')) return
    await deleteProject(id)
    toast.success('Project deleted')
  }

  return (
    <div style={styles.root}>
      {/* Sidebar */}
      <aside style={styles.sidebar}>
        <div style={styles.logoWrap}>
          <div style={styles.logoIcon}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#6ee7b7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span style={styles.logoText}>RankForge</span>
        </div>

        <nav style={styles.nav}>
          <div style={{ ...styles.navItem, ...styles.navItemActive }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/><rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/><rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/><rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/></svg>
            Dashboard
          </div>
        </nav>

        <div style={styles.sidebarBottom}>
          <div style={styles.userCard}>
            <div style={styles.avatar}>{(user?.full_name || user?.email || 'U')[0].toUpperCase()}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.full_name || 'User'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.email}
              </div>
            </div>
            <button style={styles.logoutBtn} onClick={logout} title="Logout">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main style={styles.main}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.pageTitle}>Your Projects</h1>
            <p style={styles.pageSubtitle}>Each project analyzes a website for SEO keywords and content</p>
          </div>
          <button style={styles.createBtn} onClick={() => setShowCreate(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
            New Project
          </button>
        </div>

        {/* Stats row */}
        <div style={styles.statsRow}>
          {[
            { label: 'Total Projects', value: projects.length, color: 'var(--accent)' },
            { label: 'Analyzed', value: projects.filter(p => p.last_analyzed).length, color: 'var(--purple)' },
            { label: 'This Month', value: projects.filter(p => p.created_at && new Date(p.created_at) > new Date(Date.now() - 30*86400000)).length, color: 'var(--amber)' },
          ].map(s => (
            <div key={s.label} style={styles.statCard}>
              <div style={{ fontSize: 32, fontWeight: 700, fontFamily: 'var(--font-display)', color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Projects grid */}
        {loading ? (
          <div style={styles.empty}>
            <div style={styles.spinner} />
          </div>
        ) : projects.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 8 }}>No projects yet</h3>
            <p style={{ color: 'var(--text2)', fontSize: 14, marginBottom: 24 }}>Add a website URL and let AI find your best keywords</p>
            <button style={styles.createBtn} onClick={() => setShowCreate(true)}>Create your first project</button>
          </div>
        ) : (
          <div style={styles.grid}>
            {projects.map((p, i) => (
              <div
                key={p.id}
                style={{ ...styles.projectCard, animationDelay: `${i * 60}ms` }}
                className="fade-in"
                onClick={() => { setCurrentProject(p); navigate(`/project/${p.id}`) }}
              >
                <div style={styles.projectCardHeader}>
                  <div style={styles.projectDomain}>{new URL(p.url).hostname}</div>
                  <button style={styles.deleteBtn} onClick={(e) => handleDelete(e, p.id)} title="Delete">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                </div>
                <h3 style={styles.projectName}>{p.name}</h3>
                {p.description && <p style={styles.projectDesc}>{p.description}</p>}
                <div style={styles.projectMeta}>
                  <span style={p.last_analyzed ? styles.tagAnalyzed : styles.tagPending}>
                    {p.last_analyzed ? '✓ Analyzed' : '○ Not analyzed'}
                  </span>
                  {p.last_analyzed && (
                    <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                      {new Date(p.last_analyzed).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <div style={styles.projectArrow}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M12 5l7 7-7 7" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Modal */}
      {showCreate && (
        <div style={styles.overlay} onClick={() => setShowCreate(false)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()} className="fade-in">
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginBottom: 6 }}>New Project</h2>
            <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 28 }}>Paste any website URL to start your SEO analysis</p>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={styles.field}>
                <label style={styles.label}>Project Name</label>
                <input style={styles.input} placeholder="e.g. My Online Store" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Website URL</label>
                <input style={styles.input} placeholder="https://yourwebsite.com" value={form.url} onChange={e => setForm({...form, url: e.target.value})} required />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Description (optional)</label>
                <input style={styles.input} placeholder="What does this website sell or offer?" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                <button type="button" style={styles.cancelBtn} onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" style={styles.createBtn} disabled={creating}>
                  {creating ? 'Creating...' : 'Create & Analyze'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const styles = {
  root: { display: 'flex', minHeight: '100vh', background: 'var(--bg)' },
  sidebar: {
    width: 220, background: 'var(--bg2)', borderRight: '1px solid var(--border)',
    display: 'flex', flexDirection: 'column', padding: '24px 16px',
    position: 'sticky', top: 0, height: '100vh',
  },
  logoWrap: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 36, padding: '0 8px' },
  logoIcon: {
    width: 34, height: 34, background: 'var(--accent-dim)',
    border: '1px solid var(--accent-glow)', borderRadius: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  logoText: { fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700 },
  nav: { flex: 1 },
  navItem: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 12px', borderRadius: 'var(--radius-sm)',
    fontSize: 14, color: 'var(--text2)', cursor: 'pointer',
    transition: 'all 0.15s',
  },
  navItemActive: { background: 'var(--accent-dim)', color: 'var(--accent)' },
  sidebarBottom: { borderTop: '1px solid var(--border)', paddingTop: 16 },
  userCard: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px' },
  avatar: {
    width: 32, height: 32, borderRadius: '50%',
    background: 'var(--accent-dim)', border: '1px solid var(--accent-glow)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 13, fontWeight: 600, color: 'var(--accent)', flexShrink: 0,
  },
  logoutBtn: {
    background: 'none', color: 'var(--text3)', padding: 4,
    borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'color 0.15s',
  },
  main: { flex: 1, padding: '40px 48px', maxWidth: 1100 },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 },
  pageTitle: { fontSize: 30, fontWeight: 700, fontFamily: 'var(--font-display)', marginBottom: 4 },
  pageSubtitle: { fontSize: 14, color: 'var(--text2)' },
  statsRow: { display: 'flex', gap: 16, marginBottom: 36 },
  statCard: {
    background: 'var(--bg2)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius)', padding: '20px 24px', flex: 1,
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 },
  projectCard: {
    background: 'var(--bg2)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)', padding: '24px',
    cursor: 'pointer', transition: 'border-color 0.2s, transform 0.15s',
    position: 'relative', overflow: 'hidden',
    animationFillMode: 'both',
  },
  projectCardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  projectDomain: {
    fontSize: 11, color: 'var(--accent)', fontWeight: 500,
    background: 'var(--accent-dim)', padding: '3px 8px', borderRadius: 100,
  },
  deleteBtn: {
    background: 'none', color: 'var(--text3)', padding: 4,
    borderRadius: 6, display: 'flex', alignItems: 'center',
    transition: 'color 0.15s',
  },
  projectName: { fontSize: 17, fontWeight: 600, fontFamily: 'var(--font-display)', marginBottom: 6 },
  projectDesc: { fontSize: 13, color: 'var(--text2)', marginBottom: 16, lineHeight: 1.5 },
  projectMeta: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 'auto' },
  tagAnalyzed: {
    fontSize: 11, color: 'var(--accent)', background: 'var(--accent-dim)',
    padding: '3px 8px', borderRadius: 100,
  },
  tagPending: {
    fontSize: 11, color: 'var(--text3)', background: 'var(--surface)',
    padding: '3px 8px', borderRadius: 100,
  },
  projectArrow: { position: 'absolute', bottom: 20, right: 20, opacity: 0.5 },
  emptyState: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: '80px 40px', textAlign: 'center',
  },
  emptyIcon: {
    width: 72, height: 72, background: 'var(--accent-dim)',
    border: '1px solid var(--accent-glow)', borderRadius: 20,
    display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24,
  },
  empty: { display: 'flex', justifyContent: 'center', padding: 80 },
  spinner: {
    width: 32, height: 32, border: '3px solid var(--surface2)',
    borderTopColor: 'var(--accent)', borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
    backdropFilter: 'blur(4px)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24,
  },
  modal: {
    background: 'var(--bg2)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-xl)', padding: '40px',
    width: '100%', maxWidth: 480, boxShadow: 'var(--shadow-lg)',
  },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 13, fontWeight: 500, color: 'var(--text2)' },
  input: {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', padding: '12px 16px',
    color: 'var(--text)', fontSize: 14,
  },
  createBtn: {
    background: 'var(--accent)', color: '#0a0a0f',
    fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14,
    padding: '12px 20px', borderRadius: 'var(--radius-sm)',
    display: 'flex', alignItems: 'center', gap: 8,
    transition: 'opacity 0.15s',
    cursor: 'pointer',
  },
  cancelBtn: {
    background: 'var(--surface)', color: 'var(--text2)',
    fontFamily: 'var(--font-body)', fontSize: 14,
    padding: '12px 20px', borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border)', cursor: 'pointer', flex: 1,
  },
}
