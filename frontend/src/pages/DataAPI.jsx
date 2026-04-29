import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getMyKeys, getFeatures, getBalance } from '../services/api'
import useAuthStore from '../store/authStore'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { Key, Copy, Check, Database, Code, ChevronDown, ChevronUp, Loader } from 'lucide-react'

const BACKEND = 'https://degenome.onrender.com'

const NUCL_COLORS = { A: '#22c55e', T: '#ef4444', G: '#3b82f6', C: '#f97316' }
const CHART_KEYS  = new Set(['A_count', 'T_count', 'G_count', 'C_count', 'GC_content'])

const accessTypeBadge = t => t === 'raw_file_access'
  ? <span className="text-[10px] font-display px-1.5 py-0.5 rounded border border-purple-700/40 bg-purple-900/20 text-purple-300">Raw File</span>
  : <span className="text-[10px] font-display px-1.5 py-0.5 rounded border border-cyan/30 bg-cyan/10 text-cyan">Feature Access</span>

function featurePythonSnippet(datasetId) {
  return `import requests

API_KEY = "dg_..."  # your full key from the approval email

response = requests.post(
    "${BACKEND}/data/query",
    headers={"Authorization": f"Bearer {API_KEY}"},
    json={
        "dataset_id": "${datasetId}",
        "feature_type": "SNP",
        "filters": {}
    }
)
print(response.json())`
}

function curlSnippet(datasetId, accessType) {
  if (accessType === 'raw_file_access') {
    return `echo "Raw file access is coming soon."`
  }
  return `curl -X POST ${BACKEND}/data/query \\
  -H "Authorization: Bearer YOUR_FULL_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"dataset_id": "${datasetId}", "feature_type": "SNP"}'`
}

function CodeBlock({ code, keyId, copied, onCopy }) {
  return (
    <div className="relative">
      <pre className="bg-ink/60 border border-edge rounded-lg p-4 text-[11px] font-mono text-soft overflow-x-auto leading-relaxed">
        {code}
      </pre>
      <button
        onClick={() => onCopy(keyId, code)}
        className="absolute top-2 right-2 p-1.5 rounded border border-edge bg-ink/80 hover:border-cyan/30 transition-colors">
        {copied
          ? <Check size={11} className="text-green-400" />
          : <Copy size={11} className="text-muted" />}
      </button>
    </div>
  )
}

export default function DataAPI() {
  const { user } = useAuthStore()
  const [myKeys,        setMyKeys]        = useState([])
  const [loading,       setLoading]       = useState(true)
  const [balance,       setBalance]       = useState(null)
  // Query interface
  const [selectedKeyId, setSelectedKeyId] = useState('')
  const [features,      setFeatures]      = useState(null)
  const [featLoading,   setFeatLoading]   = useState(false)
  const [featError,     setFeatError]     = useState('')
  // API Reference
  const [showRef,       setShowRef]       = useState(false)
  const [activeTabs,    setActiveTabs]    = useState({})
  const [copiedCode,    setCopiedCode]    = useState({})

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

  const getTab   = keyId => activeTabs[keyId] || 'python'
  const setTab   = (keyId, t) => setActiveTabs(prev => ({ ...prev, [keyId]: t }))
  const copyCode = (keyId, code) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(prev => ({ ...prev, [keyId]: true }))
    setTimeout(() => setCopiedCode(prev => ({ ...prev, [keyId]: false })), 2000)
  }

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
        <p className="text-xs text-muted mb-8">Query datasets and access your API reference</p>
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
        <p className="text-xs text-muted mb-8">Query datasets and access your API reference</p>
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
      <p className="text-xs text-muted mb-8">Query datasets and access your API reference</p>

      {/* ── Section 1: Query Interface ───────────────────────────────── */}
      <div className="card mb-6 space-y-5">
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
      </div>

      {/* ── Section 2: API Reference (collapsible) ───────────────────── */}
      <div className="card">
        <button
          onClick={() => setShowRef(v => !v)}
          className="w-full flex items-center justify-between gap-4">
          <div className="text-left">
            <p className="section-title">api reference</p>
            <p className="text-[10px] text-muted">
              Use this data in your own pipeline · For Colab, scripts, or production integrations
            </p>
          </div>
          {showRef
            ? <ChevronUp size={14} className="text-muted shrink-0" />
            : <ChevronDown size={14} className="text-muted shrink-0" />}
        </button>

        {showRef && (
          <div className="mt-5 space-y-6">
            <p className="text-[10px] text-muted font-mono">
              Replace <code className="text-soft">dg_...</code> with the full key you received on approval.
              Keys are never stored — if lost, request access again.
            </p>

            {myKeys.map(k => {
              const tab       = getTab(k.id)
              const copied    = copiedCode[k.id] || false
              const isRawFile = k.access_type === 'raw_file_access'
              const tabs      = isRawFile
                ? []
                : [{ key: 'python', label: 'Python' }, { key: 'curl', label: 'curl' }]
              const code = tab === 'curl'
                ? curlSnippet(k.dataset_id, k.access_type)
                : isRawFile
                  ? 'Raw file access is coming soon.'
                  : featurePythonSnippet(k.dataset_id)

              return (
                <div key={k.id} className="pb-6 border-b border-edge last:border-0 last:pb-0 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <Database size={12} className="text-muted" />
                          <p className="text-sm font-display text-soft">
                            {k.dataset_title || k.dataset_id?.slice(0, 8) + '…'}
                          </p>
                        </div>
                        {accessTypeBadge(k.access_type)}
                      </div>
                      <p className="text-[10px] font-mono text-muted">
                        Key: {k.key_prefix}… · dataset: {k.dataset_id?.slice(0, 8)}…
                      </p>
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

                  <div className="rounded-lg bg-ink/40 border border-edge px-3 py-2">
                    <p className="text-[10px] text-muted">
                      {isRawFile
                        ? 'This key grants access to the raw encrypted file on Storj. Cost: 5 credits per download.'
                        : 'This key grants access to privacy-protected feature vectors. Cost: 1 credit per query.'}
                    </p>
                  </div>

                  <div>
                    <div className="flex gap-1 mb-3">
                      {tabs.map(t => (
                        <button key={t.key} onClick={() => setTab(k.id, t.key)}
                          className={`flex items-center gap-1.5 text-[10px] font-display px-3 py-1.5 rounded-lg border transition-all
                            ${tab === t.key ? 'border-cyan text-cyan bg-cyan/10' : 'border-edge text-muted hover:border-muted'}`}>
                          <Code size={9} />
                          {t.label}
                        </button>
                      ))}
                    </div>
                    <CodeBlock code={code} keyId={k.id} copied={copied} onCopy={copyCode} />
                  </div>

                  <div className="flex items-center gap-2 pt-1 border-t border-edge">
                    <span className="text-[10px] text-muted">dataset_id</span>
                    <code className="text-[10px] font-mono text-soft bg-ink/40 px-2 py-0.5 rounded border border-edge">
                      {k.dataset_id}
                    </code>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
