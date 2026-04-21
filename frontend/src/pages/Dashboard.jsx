import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getBalance, getCreditHistory, myDatasets, getQueryLogs, getMyKeys, revokeKey } from '../services/api'
import useAuthStore from '../store/authStore'
import { Upload, Database, Activity, TrendingUp, Clock, Key, ExternalLink, Trash2 } from 'lucide-react'

const accessTypeBadge = t => t === 'raw_file_access'
  ? <span className="text-[10px] font-display px-1.5 py-0.5 rounded border border-purple-700/40 bg-purple-900/20 text-purple-300">Raw File</span>
  : <span className="text-[10px] font-display px-1.5 py-0.5 rounded border border-cyan/30 bg-cyan/10 text-cyan">Feature</span>

export default function Dashboard() {
  const { user, updateCredits, isContributor, isResearcher } = useAuthStore()
  const [balance,  setBalance]  = useState(null)
  const [history,  setHistory]  = useState([])
  const [datasets, setDatasets] = useState([])
  const [logs,     setLogs]     = useState([])
  const [myKeys,   setMyKeys]   = useState([])
  const [revoking, setRevoking] = useState({})

  useEffect(() => {
    getBalance().then(r => { setBalance(r.data); updateCredits(r.data.credits, r.data.earnings) }).catch(() => {})
    getCreditHistory().then(r => setHistory(r.data)).catch(() => {})
    getQueryLogs().then(r => setLogs(r.data)).catch(() => {})
    if (isContributor()) myDatasets().then(r => setDatasets(r.data)).catch(() => {})
    getMyKeys().then(r => setMyKeys(r.data)).catch(() => {})
  }, [])

  const handleRevoke = async (keyId) => {
    setRevoking(r => ({ ...r, [keyId]: true }))
    try {
      await revokeKey(keyId)
      setMyKeys(prev => prev.filter(k => k.id !== keyId))
    } catch {}
    setRevoking(r => ({ ...r, [keyId]: false }))
  }

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

      {/* ── My API Keys (researchers) ──────────────────────────────────── */}
      {isResearcher() && (
        <div className="card mt-6">
          <p className="section-title flex items-center gap-2"><Key size={11} /> my api keys</p>
          <p className="text-[10px] text-muted mb-4">
            Keys are issued automatically when a contributor approves your access request.
          </p>

          {myKeys.length === 0 ? (
            <p className="text-xs text-muted">
              No active API keys. Request access to a dataset from the{' '}
              <Link to="/explorer" className="text-cyan hover:underline">Explorer</Link>.
            </p>
          ) : (
            <div className="space-y-2">
              {myKeys.map(k => (
                <div key={k.id}
                  className="flex items-center justify-between py-2.5 border-b border-edge last:border-0 gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Link
                        to={`/explorer?dataset=${k.dataset_id}`}
                        className="text-xs font-display text-soft hover:text-cyan transition-colors flex items-center gap-1">
                        {k.dataset_title || k.dataset_id?.slice(0, 8) + '…'}
                        <ExternalLink size={9} className="opacity-50" />
                      </Link>
                      {accessTypeBadge(k.access_type)}
                    </div>
                    <p className="text-[10px] font-mono text-muted">{k.key_prefix}…</p>
                  </div>
                  <div className="text-right shrink-0">
                    {k.last_used_at
                      ? <p className="text-[10px] text-muted">used {new Date(k.last_used_at).toLocaleDateString()}</p>
                      : <p className="text-[10px] text-muted/50">never used</p>}
                    <p className="text-[10px] text-muted/50">
                      issued {new Date(k.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Dataset Access Keys (contributors) ────────────────────────── */}
      {isContributor() && (
        <div className="card mt-6">
          <p className="section-title flex items-center gap-2"><Key size={11} /> dataset access keys</p>
          <p className="text-[10px] text-muted mb-4">
            API keys issued to researchers for your datasets. You can revoke any key at any time.
          </p>

          <div className="rounded-lg border border-edge bg-ink/30 p-4 text-center">
            <p className="text-xs text-muted mb-1">
              Endpoint needed: <code className="font-mono text-soft">GET /auth/dataset-keys</code>
            </p>
            <p className="text-[10px] text-muted">
              This endpoint will return all active API keys issued to researchers for datasets you own,
              allowing contributors to see and revoke researcher access from this view.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
