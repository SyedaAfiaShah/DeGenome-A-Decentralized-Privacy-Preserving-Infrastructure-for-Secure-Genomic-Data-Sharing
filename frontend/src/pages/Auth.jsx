import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Dna, Eye, EyeOff } from 'lucide-react'
import { login as apiLogin, register as apiRegister } from '../services/api'
import useAuthStore from '../store/authStore'

function AuthLayout({ children, title, sub }) {
  return (
    <div className="min-h-screen bg-void bg-grid flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Dna size={20} className="text-cyan" />
          <span className="font-display text-soft font-medium tracking-wide">DeGenome</span>
        </div>
        <div className="card">
          <h1 className="font-display text-xl text-soft mb-1">{title}</h1>
          <p className="text-xs text-muted mb-6">{sub}</p>
          {children}
        </div>
      </div>
    </div>
  )
}

export function Login() {
  const [form, setForm]   = useState({ email: '', password: '' })
  const [show, setShow]   = useState(false)
  const [err,  setErr]    = useState('')
  const [busy, setBusy]   = useState(false)
  const { setAuth }       = useAuthStore()
  const navigate          = useNavigate()

  const submit = async e => {
    e.preventDefault(); setErr(''); setBusy(true)
    try {
      const { data } = await apiLogin(form)
      setAuth(data.token, data.user)
      navigate('/dashboard')
    } catch (e) {
      setErr(e.response?.data?.detail || 'Login failed')
    } finally { setBusy(false) }
  }

  return (
    <AuthLayout title="Welcome back" sub="Sign in to your DeGenome account">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" placeholder="you@example.com"
            value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
        </div>
        <div>
          <label className="label">Password</label>
          <div className="relative">
            <input className="input pr-10" type={show ? 'text' : 'password'} placeholder="••••••••"
              value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
            <button type="button" onClick={() => setShow(!show)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-soft">
              {show ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>
        {err && <p className="text-xs text-red-400 font-mono">{err}</p>}
        <button type="submit" disabled={busy} className="btn-primary w-full justify-center">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="text-xs text-center text-muted">
          No account? <Link to="/register" className="text-cyan hover:underline">Create one</Link>
        </p>
      </form>
    </AuthLayout>
  )
}

export function Register() {
  const [params]          = useSearchParams()
  const [form, setForm]   = useState({
    email: '', username: '', password: '',
    role: params.get('role') || 'contributor'
  })
  const [show, setShow]   = useState(false)
  const [err,  setErr]    = useState('')
  const [busy, setBusy]   = useState(false)
  const { setAuth }       = useAuthStore()
  const navigate          = useNavigate()

  const submit = async e => {
    e.preventDefault(); setErr(''); setBusy(true)
    try {
      const { data } = await apiRegister(form)
      setAuth(data.token, { id: data.user_id, username: form.username, role: data.role, credits: 10, earnings: 0 })
      navigate('/dashboard')
    } catch (e) {
      setErr(e.response?.data?.detail || 'Registration failed')
    } finally { setBusy(false) }
  }

  return (
    <AuthLayout title="Create account" sub="Join the genomic data commons">
      <form onSubmit={submit} className="space-y-4">
        {/* Role toggle */}
        <div>
          <label className="label">I am a</label>
          <div className="grid grid-cols-2 gap-2">
            {['contributor','researcher'].map(r => (
              <button key={r} type="button"
                onClick={() => setForm({ ...form, role: r })}
                className={`py-2.5 rounded-lg border text-xs font-display transition-all
                  ${form.role === r
                    ? 'border-cyan bg-cyan/10 text-cyan'
                    : 'border-edge text-muted hover:border-muted'}`}>
                {r}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-muted mt-1.5 font-mono">
            {form.role === 'contributor'
              ? 'Upload genomic data and earn credits when researchers use it.'
              : 'Query genomic feature datasets via the API for your research.'}
          </p>
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" placeholder="you@example.com"
            value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
        </div>
        <div>
          <label className="label">Username</label>
          <input className="input" type="text" placeholder="genomics_ninja"
            value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} required />
        </div>
        <div>
          <label className="label">Password</label>
          <div className="relative">
            <input className="input pr-10" type={show ? 'text' : 'password'} placeholder="••••••••"
              value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
            <button type="button" onClick={() => setShow(!show)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-soft">
              {show ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>
        {err && <p className="text-xs text-red-400 font-mono">{err}</p>}
        <button type="submit" disabled={busy} className="btn-primary w-full justify-center">
          {busy ? 'Creating account…' : 'Create account'}
        </button>
        <p className="text-xs text-center text-muted">
          Have an account? <Link to="/login" className="text-cyan hover:underline">Sign in</Link>
        </p>
      </form>
    </AuthLayout>
  )
}
