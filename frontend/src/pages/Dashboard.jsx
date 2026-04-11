import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getBalance, getCreditHistory, myDatasets, getQueryLogs } from '../services/api'
import useAuthStore from '../store/authStore'
import { Upload, Database, Activity, TrendingUp, Clock } from 'lucide-react'

export default function Dashboard() {
  const { user, updateCredits, isContributor } = useAuthStore()
  const [balance,  setBalance]  = useState(null)
  const [history,  setHistory]  = useState([])
  const [datasets, setDatasets] = useState([])
  const [logs,     setLogs]     = useState([])

  useEffect(() => {
    getBalance().then(r => { setBalance(r.data); updateCredits(r.data.credits, r.data.earnings) }).catch(() => {})
    getCreditHistory().then(r => setHistory(r.data)).catch(() => {})
    getQueryLogs().then(r => setLogs(r.data)).catch(() => {})
    if (isContributor()) myDatasets().then(r => setDatasets(r.data)).catch(() => {})
  }, [])

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
    </div>
  )
}
