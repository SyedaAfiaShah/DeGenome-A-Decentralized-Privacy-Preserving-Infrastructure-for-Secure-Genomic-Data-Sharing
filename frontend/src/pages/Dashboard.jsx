import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getBalance, getCreditHistory, myDatasets, getQueryLogs, createApiKey, listApiKeys } from '../services/api'
import useAuthStore from '../store/authStore'
import { Upload, Database, Activity, TrendingUp, Clock, Key, Plus, Copy, Check, AlertTriangle } from 'lucide-react'

export default function Dashboard() {
  const { user, updateCredits, isContributor } = useAuthStore()
  const [balance,    setBalance]   = useState(null)
  const [history,    setHistory]   = useState([])
  const [datasets,   setDatasets]  = useState([])
  const [logs,       setLogs]      = useState([])
  const [apiKeys,    setApiKeys]   = useState([])
  const [keyName,    setKeyName]   = useState('')
  const [newKey,     setNewKey]    = useState(null)   // { key, name, key_prefix } — shown once
  const [keyCopied,  setKeyCopied] = useState(false)
  const [keyBusy,    setKeyBusy]   = useState(false)
  const [keyErr,     setKeyErr]    = useState('')

  useEffect(() => {
    getBalance().then(r => { setBalance(r.data); updateCredits(r.data.credits, r.data.earnings) }).catch(() => {})
    getCreditHistory().then(r => setHistory(r.data)).catch(() => {})
    getQueryLogs().then(r => setLogs(r.data)).catch(() => {})
    if (isContributor()) myDatasets().then(r => setDatasets(r.data)).catch(() => {})
    listApiKeys().then(r => setApiKeys(r.data)).catch(() => {})
  }, [])

  const handleGenerateKey = async () => {
    if (!keyName.trim() || keyBusy) return
    setKeyBusy(true); setKeyErr('')
    try {
      const { data } = await createApiKey(keyName.trim())
      setNewKey(data)
      setApiKeys(prev => [{ id: data.id, name: data.name, key_prefix: data.key_prefix,
                             created_at: data.created_at, last_used_at: null }, ...prev])
      setKeyName('')
    } catch (e) {
      setKeyErr(e.response?.data?.detail || 'Failed to generate key')
    } finally { setKeyBusy(false) }
  }

  const copyKey = () => {
    navigator.clipboard.writeText(newKey.key)
    setKeyCopied(true)
    setTimeout(() => setKeyCopied(false), 2000)
  }

  const dismissNewKey = () => { setNewKey(null); setKeyCopied(false) }

  return (
    <div className="page">
      <div className="mb-8">
        <h1 className="font-display text-2xl text-soft mb-1">Dashboard</h1>
        <p className="text-xs text-muted">Welcome back, <span className="text-soft">{user?.username}</span></p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="stat-card">
          <p className="stat-label">Credits</p>
          <p className="stat-value text-cyan">{balance?.credits?.toFixed(2) ?? '—'}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Earned</p>
          <p className="stat-value text-acid">{balance?.earnings?.toFixed(2) ?? '—'}</p>
        </div>
        {isContributor() && (
          <div className="stat-card">
            <p className="stat-label">Datasets</p>
            <p className="stat-value">{datasets.length}</p>
          </div>
        )}
        <div className="stat-card">
          <p className="stat-label">API calls</p>
          <p className="stat-value">{logs.length}</p>
        </div>
      </div>

      {/* Quick actions */}
      <div className="mb-8">
        <p className="section-title">quick actions</p>
        <div className="flex flex-wrap gap-3">
          {isContributor() && (
            <Link to="/upload" className="card-sm flex items-center gap-3 hover:border-cyan/30 transition-all group cursor-pointer">
              <div className="w-7 h-7 rounded-lg bg-cyan/10 flex items-center justify-center group-hover:bg-cyan/20 transition-colors">
                <Upload size={13} className="text-cyan" />
              </div>
              <div>
                <p className="text-xs font-display text-soft">Upload dataset</p>
                <p className="text-[10px] text-muted">Share genomic data</p>
              </div>
            </Link>
          )}
          <Link to="/explorer" className="card-sm flex items-center gap-3 hover:border-cyan/30 transition-all group cursor-pointer">
            <div className="w-7 h-7 rounded-lg bg-cyan/10 flex items-center justify-center group-hover:bg-cyan/20 transition-colors">
              <Database size={13} className="text-cyan" />
            </div>
            <div>
              <p className="text-xs font-display text-soft">Explore datasets</p>
              <p className="text-[10px] text-muted">Browse available data</p>
            </div>
          </Link>
          <Link to="/access" className="card-sm flex items-center gap-3 hover:border-cyan/30 transition-all group cursor-pointer">
            <div className="w-7 h-7 rounded-lg bg-cyan/10 flex items-center justify-center group-hover:bg-cyan/20 transition-colors">
              <Activity size={13} className="text-cyan" />
            </div>
            <div>
              <p className="text-xs font-display text-soft">Access requests</p>
              <p className="text-[10px] text-muted">Manage permissions</p>
            </div>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Credit history */}
        <div className="card">
          <p className="section-title flex items-center gap-2"><TrendingUp size={11} /> credit history</p>
          {history.length === 0
            ? <p className="text-xs text-muted">No transactions yet.</p>
            : <div className="space-y-2">
                {history.slice(0, 8).map((t, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-edge last:border-0">
                    <div>
                      <p className="text-xs text-soft font-mono">{t.reason}</p>
                      <p className="text-[10px] text-muted">{new Date(t.timestamp).toLocaleString()}</p>
                    </div>
                    <span className={`text-xs font-display font-medium ${t.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {t.amount > 0 ? '+' : ''}{t.amount.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>}
        </div>

        {/* Recent API calls */}
        <div className="card">
          <p className="section-title flex items-center gap-2"><Clock size={11} /> recent api calls</p>
          {logs.length === 0
            ? <p className="text-xs text-muted">No API calls yet.</p>
            : <div className="space-y-2">
                {logs.slice(0, 8).map((l, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-edge last:border-0">
                    <div>
                      <p className="text-xs font-mono text-soft">{l.endpoint}</p>
                      <p className="text-[10px] text-muted font-mono">{l.dataset_id.slice(0, 8)}…</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-red-400 font-display">-{l.credits_used}</p>
                      <p className="text-[10px] text-muted">{new Date(l.timestamp).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>}
        </div>
      </div>

      {/* API Keys */}
      <div className="card mt-6">
        <p className="section-title flex items-center gap-2"><Key size={11} /> api keys</p>

        {/* One-time reveal banner */}
        {newKey && (
          <div className="mb-5 rounded-lg border border-yellow-700/40 bg-yellow-900/10 p-4 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle size={13} className="text-yellow-400 mt-0.5 shrink-0" />
              <p className="text-xs text-yellow-300">
                Copy your key now — it will not be shown again.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono text-xs text-soft bg-ink/60 border border-edge rounded-lg px-3 py-2 break-all">
                {newKey.key}
              </code>
              <button onClick={copyKey}
                className="shrink-0 p-2 rounded-lg border border-edge hover:border-cyan/30 transition-colors">
                {keyCopied
                  ? <Check size={13} className="text-green-400" />
                  : <Copy size={13} className="text-muted" />}
              </button>
            </div>
            <button onClick={dismissNewKey}
              className="text-[10px] text-muted hover:text-soft transition-colors">
              I've saved it — dismiss
            </button>
          </div>
        )}

        {/* Generate form */}
        <div className="flex items-center gap-3 mb-5">
          <input className="input flex-1" placeholder="Key name, e.g. jupyter-notebook"
            value={keyName} onChange={e => setKeyName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleGenerateKey()} />
          <button onClick={handleGenerateKey} disabled={!keyName.trim() || keyBusy}
            className="btn-primary shrink-0 flex items-center gap-2 disabled:opacity-40">
            <Plus size={13} />
            {keyBusy ? 'Generating…' : 'Generate'}
          </button>
        </div>
        {keyErr && (
          <p className="text-xs text-red-400 mb-4">{keyErr}</p>
        )}

        {/* Existing keys */}
        {apiKeys.length === 0
          ? <p className="text-xs text-muted">No API keys yet.</p>
          : <div className="space-y-2">
              {apiKeys.map(k => (
                <div key={k.id}
                  className="flex items-center justify-between py-2 border-b border-edge last:border-0">
                  <div className="min-w-0">
                    <p className="text-xs text-soft font-display truncate">{k.name}</p>
                    <p className="text-[10px] font-mono text-muted">{k.key_prefix}…</p>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    {k.last_used_at
                      ? <p className="text-[10px] text-muted">used {new Date(k.last_used_at).toLocaleDateString()}</p>
                      : <p className="text-[10px] text-muted/50">never used</p>}
                    <p className="text-[10px] text-muted/50">
                      created {new Date(k.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>}
      </div>
    </div>
  )
}
