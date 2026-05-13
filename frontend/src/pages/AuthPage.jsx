import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import toast from 'react-hot-toast'

export default function AuthPage() {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ email: '', password: '', full_name: '' })
  const [loading, setLoading] = useState(false)
  const { login, register } = useAuthStore()
  const navigate = useNavigate()

  const handle = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (mode === 'login') {
        await login(form.email, form.password)
      } else {
        await register(form.email, form.password, form.full_name)
      }
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.root}>
      {/* Background grid */}
      <div style={styles.grid} />

      <div style={styles.card} className="fade-in">
        {/* Logo */}
        <div style={styles.logo}>
          <div style={styles.logoIcon}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#6ee7b7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span style={styles.logoText}>RankForge</span>
        </div>

        <h1 style={styles.title}>
          {mode === 'login' ? 'Welcome back' : 'Create account'}
        </h1>
        <p style={styles.subtitle}>
          {mode === 'login'
            ? 'Sign in to your SEO workspace'
            : 'Start ranking higher with AI-powered SEO'}
        </p>

        <form onSubmit={handle} style={styles.form}>
          {mode === 'register' && (
            <div style={styles.field}>
              <label style={styles.label}>Full name</label>
              <input
                style={styles.input}
                type="text"
                placeholder="Your name"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </div>
          )}
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              style={styles.input}
              type="email"
              placeholder="you@agency.com"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              style={styles.input}
              type="password"
              placeholder={mode === 'register' ? 'Min 8 characters' : '••••••••'}
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>

          <button type="submit" style={styles.btn} disabled={loading}>
            {loading ? <span style={styles.spinner} /> : null}
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div style={styles.toggle}>
          {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
          {' '}
          <button
            style={styles.toggleBtn}
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </div>

        {/* Features row */}
        <div style={styles.features}>
          {['AI Keywords', 'SEO Blogs', 'Trend Data'].map((f) => (
            <div key={f} style={styles.featurePill}>
              <span style={{ color: 'var(--accent)', marginRight: 4 }}>✦</span> {f}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const styles = {
  root: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg)',
    position: 'relative',
    overflow: 'hidden',
    padding: '24px',
  },
  grid: {
    position: 'absolute', inset: 0,
    backgroundImage: `
      linear-gradient(rgba(110,231,183,0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(110,231,183,0.03) 1px, transparent 1px)
    `,
    backgroundSize: '48px 48px',
    pointerEvents: 'none',
  },
  card: {
    background: 'var(--bg2)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-xl)',
    padding: '48px 40px',
    width: '100%',
    maxWidth: 440,
    position: 'relative',
    boxShadow: '0 0 80px rgba(110,231,183,0.06)',
  },
  logo: {
    display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32,
  },
  logoIcon: {
    width: 40, height: 40,
    background: 'var(--accent-dim)',
    border: '1px solid var(--accent-glow)',
    borderRadius: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  logoText: {
    fontFamily: 'var(--font-display)',
    fontSize: 20, fontWeight: 700,
    color: 'var(--text)',
  },
  title: {
    fontSize: 28, fontWeight: 700,
    color: 'var(--text)', marginBottom: 6,
  },
  subtitle: {
    fontSize: 14, color: 'var(--text2)', marginBottom: 32,
  },
  form: { display: 'flex', flexDirection: 'column', gap: 20 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 13, fontWeight: 500, color: 'var(--text2)' },
  input: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '12px 16px',
    color: 'var(--text)',
    fontSize: 14,
    transition: 'border-color 0.2s',
  },
  btn: {
    background: 'var(--accent)',
    color: '#0a0a0f',
    fontFamily: 'var(--font-display)',
    fontWeight: 600,
    fontSize: 15,
    padding: '14px',
    borderRadius: 'var(--radius-sm)',
    marginTop: 4,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    transition: 'opacity 0.2s, transform 0.1s',
    cursor: 'pointer',
  },
  spinner: {
    width: 16, height: 16,
    border: '2px solid rgba(0,0,0,0.3)',
    borderTopColor: '#0a0a0f',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
    display: 'inline-block',
  },
  toggle: {
    textAlign: 'center', marginTop: 24,
    fontSize: 13, color: 'var(--text2)',
  },
  toggleBtn: {
    background: 'none',
    color: 'var(--accent)',
    fontFamily: 'var(--font-body)',
    fontSize: 13, fontWeight: 500,
    cursor: 'pointer',
    textDecoration: 'underline',
  },
  features: {
    display: 'flex', gap: 8, justifyContent: 'center',
    marginTop: 28, flexWrap: 'wrap',
  },
  featurePill: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 100,
    padding: '4px 12px',
    fontSize: 12, color: 'var(--text2)',
    display: 'flex', alignItems: 'center',
  },
}
