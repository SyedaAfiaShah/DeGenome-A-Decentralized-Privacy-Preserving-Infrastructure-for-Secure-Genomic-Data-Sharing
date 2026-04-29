import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getMyKeys, getFeatures, getBalance } from '../services/api'
import useAuthStore from '../store/authStore'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { Key, Database, Loader } from 'lucide-react'

const NUCL_COLORS = { A: '#22c55e', T: '#ef4444', G: '#3b82f6', C: '#f97316' }
const CHART_KEYS  = new Set(['A_count', 'T_count', 'G_count', 'C_count', 'GC_content'])

export default function DataAPI() {
  const { user } = useAuthStore()
  const [myKeys,        setMyKeys]        = useState([])
  const [loading,       setLoading]       = useState(true)
  const [balance,       setBalance]       = useState(null)
  const [selectedKeyId, setSelectedKeyId] = useState('')
  const [features,      setFeatures]      = useState(null)
  const [featLoading,   setFeatLoading]   = useState(false)
  const [featError,     setFeatError]     = useState('')

  useEffect(() => {
    Promise.all([
      getMyKeys().then(r => setMyKeys(r.data)).catch(() => {}),
      getBalance().then(r => setBalance(r.data)).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedKeyId) { setFeatures(null); setFeatError(''); return }
    const key = myKeys.find(k => k.id === selectedKeyId)
    if (!key) return
    setFeatLoading(true)
    setFeatError('')
    setFeatures(null)
    getFeatures(key.dataset_id)
      .then(r => {
        const featureMap = r.data?.features ?? r.data?.feature_vector ?? r.data ?? {}
        setFeatures(typeof featureMap === 'object' && !Array.isArray(featureMap) ? featureMap : {})
      })
      .catch(e => {
        const detail = e.response?.data?.detail
        setFeatError(typeof detail === 'string' ? detail : 'Failed to load features. Check your credit balance.')
      })
      .finally(() => setFeatLoading(false))
  }, [selectedKeyId])

  const queryableKeys = myKeys.filter(k => k.access_type === 'feature_access')

  const nucleotideData = features
    ? ['A', 'T', 'G', 'C']
        .map(n => ({ name: n, value: Math.round(features[`${n}_count`] || 0) }))
        .filter(d => d.value > 0)
    : []

  const gcRaw     = features?.['GC_content']
  const gcPercent = gcRaw != null ? +(gcRaw <= 1 ? gcRaw * 100 : gcRaw).toFixed(1) : null
  const gcColor   = gcPercent == null ? 'bg-edge'
    : gcPercent >= 40 && gcPercent <= 60 ? 'bg-green-500'
    : gcPercent >= 30 && gcPercent <= 70 ? 'bg-yellow-500'
    : 'bg-red-500'
  const gcLabel   = gcPercent == null ? ''
    : gcPercent >= 40 && gcPercent <= 60 ? 'Normal range'
    : gcPercent >= 30 && gcPercent <= 70 ? 'Slightly outside normal'
    : 'Outside normal range'

  const tableFeatures = features
    ? Object.entries(features)
        .filter(([k]) => !CHART_KEYS.has(k))
        .sort((a, b) => a[0].localeCompare(b[0]))
    : []

  if (loading) {
    return (
      <div className="page">
        <h1 className="font-display text-2xl text-soft mb-1">Data API Access</h1>
        <p className="text-xs text-muted mb-8">Query your approved datasets</p>
        <div className="card text-center py-12">
          <p className="text-xs text-muted">Loading…</p>
        </div>
      </div>
    )
  }

  if (myKeys.length === 0) {
    return (
      <div className="page">
        <h1 className="font-display text-2xl text-soft mb-1">Data API Access</h1>
        <p className="text-xs text-muted mb-8">Query your approved datasets</p>
        <div className="card text-center py-16">
          <div className="w-12 h-12 rounded-xl bg-edge flex items-center justify-center mx-auto mb-4">
            <Key size={20} className="text-muted" />
          </div>
          <p className="text-sm font-display text-soft mb-2">You do not have access to any datasets yet.</p>
          <p className="text-xs text-muted max-w-xs mx-auto">
            <Link to="/explorer" className="text-cyan hover:underline">
              Browse datasets and request access
            </Link>{' '}
            to get started.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <h1 className="font-display text-2xl text-soft mb-1">Data API Access</h1>
      <p className="text-xs text-muted mb-8">Query your approved datasets</p>

      {/* ── Query Interface ───────────────────────────────────────────── */}
      <div className="card space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="section-title flex items-center gap-2"><Database size={11} /> query interface</p>
            <p className="text-[10px] text-muted">Select a dataset and explore its privacy-protected feature vectors</p>
          </div>
          {balance != null && (
            <div className="text-right shrink-0">
              <p className="text-xs font-display text-soft">{balance.credits?.toFixed(2)} credits</p>
              <p className="text-[10px] text-muted">1 credit per query</p>
            </div>
          )}
        </div>

        {/* Dataset selector */}
        <div>
          <label className="label">Dataset</label>
          <select
            className="input"
            value={selectedKeyId}
            onChange={e => setSelectedKeyId(e.target.value)}>
            <option value="">Select a dataset…</option>
            {queryableKeys.map(k => (
              <option key={k.id} value={k.id}>
                {k.dataset_title || k.dataset_id?.slice(0, 8) + '…'}
              </option>
            ))}
          </select>
          {queryableKeys.length === 0 && (
            <p className="text-[10px] text-muted mt-1">
              No feature-access keys yet. Raw file keys are for downloads only.
            </p>
          )}
        </div>

        {/* Loading */}
        {featLoading && (
          <div className="flex items-center justify-center gap-2 py-8">
            <Loader size={14} className="text-cyan animate-spin" />
            <p className="text-xs text-muted">Fetching features…</p>
          </div>
        )}

        {/* Error */}
        {featError && (
          <div className="rounded-lg border border-red-800/40 bg-red-900/10 p-3">
            <p className="text-xs text-red-400">{featError}</p>
          </div>
        )}

        {/* Charts */}
        {features && !featLoading && (
          <div className="space-y-6">
            {/* Chart 1 — Nucleotide composition */}
            {nucleotideData.length > 0 && (
              <div>
                <p className="text-[11px] font-display text-muted mb-3 uppercase tracking-wide">
                  Nucleotide Composition
                </p>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={nucleotideData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                    <XAxis
                      dataKey="name"
                      tick={{ fill: '#6b7280', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false} />
                    <YAxis
                      tick={{ fill: '#6b7280', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      width={40} />
                    <Tooltip
                      contentStyle={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: 8 }}
                      labelStyle={{ color: '#e6edf3', fontSize: 11 }}
                      itemStyle={{ color: '#8b949e', fontSize: 11 }} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {nucleotideData.map(entry => (
                        <Cell key={entry.name} fill={NUCL_COLORS[entry.name] || '#6b7280'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Chart 2 — GC Content */}
            {gcPercent != null && (
              <div>
                <p className="text-[11px] font-display text-muted mb-2 uppercase tracking-wide">
                  GC Content
                </p>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-soft">GC Content: {gcPercent}%</span>
                    <span className="text-[10px] text-muted">{gcLabel}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-edge overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${gcColor}`}
                      style={{ width: `${Math.min(gcPercent, 100)}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted">
                    <span>0%</span><span>50%</span><span>100%</span>
                  </div>
                </div>
              </div>
            )}

            {/* Chart 3 — Feature summary table */}
            {tableFeatures.length > 0 && (
              <div>
                <p className="text-[11px] font-display text-muted mb-2 uppercase tracking-wide">
                  Feature Summary
                </p>
                <div className="max-h-52 overflow-y-auto rounded-lg border border-edge">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-ink border-b border-edge">
                      <tr>
                        <th className="text-left px-3 py-2 text-muted font-display text-[10px]">Feature</th>
                        <th className="text-right px-3 py-2 text-muted font-display text-[10px]">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableFeatures.map(([k, v], i) => (
                        <tr key={k}
                          className={`border-b border-edge/50 last:border-0 ${i % 2 === 0 ? '' : 'bg-ink/30'}`}>
                          <td className="px-3 py-2 font-mono text-muted">{k}</td>
                          <td className="px-3 py-2 font-mono text-soft text-right">
                            {typeof v === 'number'
                              ? v.toFixed(6).replace(/\.?0+$/, '')
                              : String(v)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {!selectedKeyId && !featLoading && (
          <p className="text-xs text-muted text-center py-2">
            Select a dataset above to visualize its feature vector.
          </p>
        )}

        <div className="pt-3 border-t border-edge text-center">
          <Link to="/api-docs" className="text-xs text-cyan hover:underline">
            Want to use this data in your own code? View API Reference →
          </Link>
        </div>
      </div>
    </div>
  )
}
