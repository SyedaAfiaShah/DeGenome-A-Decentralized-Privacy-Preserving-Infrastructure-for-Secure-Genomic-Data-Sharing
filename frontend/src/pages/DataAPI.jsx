import { useState, useEffect } from 'react'
import { listDatasets, getFeatureSchema, getFeatures, getBatchData } from '../services/api'
import FeatureViewer from '../components/FeatureViewer'
import useAuthStore from '../store/authStore'
import { Play, ChevronDown, AlertCircle, Zap } from 'lucide-react'

const ENDPOINTS = [
  { key: 'get_features',  label: 'get_features',  cost: 1, desc: 'Single feature vector for a dataset' },
  { key: 'get_batch',     label: 'get_batch_data', cost: 2, desc: 'Batch of feature vectors' },
  { key: 'get_schema',    label: 'get_feature_schema', cost: 0, desc: 'Full feature schema (free)' },
]

export default function DataAPI() {
  const { user, updateCredits } = useAuthStore()
  const [datasets,  setDatasets]  = useState([])
  const [datasetId, setDatasetId] = useState('')
  const [endpoint,  setEndpoint]  = useState('get_features')
  const [sparse,    setSparse]    = useState(true)
  const [batchSize, setBatchSize] = useState(5)
  const [result,    setResult]    = useState(null)
  const [schema,    setSchema]    = useState(null)
  const [busy,      setBusy]      = useState(false)
  const [err,       setErr]       = useState('')

  useEffect(() => {
    listDatasets().then(r => { setDatasets(r.data); if (r.data.length) setDatasetId(r.data[0].dataset_id) }).catch(() => {})
  }, [])

  const run = async () => {
    if (!datasetId) return
    setBusy(true); setErr(''); setResult(null)
    try {
      let res
      if (endpoint === 'get_features') {
        res = await getFeatures(datasetId, sparse)
      } else if (endpoint === 'get_batch') {
        res = await getBatchData(datasetId, batchSize, 0, sparse)
      } else {
        res = await getFeatureSchema(datasetId)
        setSchema(res.data)
      }
      if (res) setResult(res.data)

      // Refresh credits
      const newCredits = (user?.credits || 0) - (ENDPOINTS.find(e => e.key === endpoint)?.cost || 0)
      updateCredits(Math.max(0, newCredits), user?.earnings || 0)
    } catch (e) {
      setErr(e.response?.data?.detail || 'Request failed. Check access permissions.')
    } finally { setBusy(false) }
  }

  const ep = ENDPOINTS.find(e => e.key === endpoint)

  return (
    <div className="page">
      <h1 className="font-display text-2xl text-soft mb-1">Data API</h1>
      <p className="text-xs text-muted mb-8">Query genomic feature vectors. Raw data is never returned.</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Query builder */}
        <div className="space-y-5">
          <div className="card">
            <p className="section-title">query builder</p>

            <div className="space-y-4">
              {/* Dataset */}
              <div>
                <label className="label">Dataset</label>
                <select className="input" value={datasetId} onChange={e => setDatasetId(e.target.value)}>
                  <option value="">Select a dataset…</option>
                  {datasets.map(d => (
                    <option key={d.dataset_id} value={d.dataset_id}>
                      {d.title} ({d.format_type?.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              {/* Endpoint */}
              <div>
                <label className="label">Endpoint</label>
                <div className="space-y-2">
                  {ENDPOINTS.map(e => (
                    <button key={e.key} type="button" onClick={() => setEndpoint(e.key)}
                      className={`w-full text-left p-3 rounded-lg border transition-all
                        ${endpoint === e.key ? 'border-cyan bg-cyan/5' : 'border-edge hover:border-muted'}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-soft">{e.label}</span>
                        {e.cost > 0
                          ? <span className="text-[10px] font-display text-red-400">-{e.cost} CR</span>
                          : <span className="text-[10px] font-display text-green-400">free</span>}
                      </div>
                      <p className="text-[10px] text-muted mt-0.5">{e.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Options */}
              {endpoint !== 'get_schema' && (
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={sparse} onChange={e => setSparse(e.target.checked)}
                      className="accent-cyan" />
                    <span className="text-xs text-soft">Sparse (hide zeros)</span>
                  </label>
                </div>
              )}

              {endpoint === 'get_batch' && (
                <div>
                  <label className="label">Batch size</label>
                  <div className="flex items-center gap-3">
                    <input type="range" min={1} max={50} value={batchSize}
                      onChange={e => setBatchSize(parseInt(e.target.value))}
                      className="flex-1 accent-cyan" />
                    <span className="font-mono text-cyan text-sm w-6">{batchSize}</span>
                  </div>
                </div>
              )}

              {/* Credits indicator */}
              <div className="flex items-center justify-between py-2 border-t border-edge">
                <span className="text-xs text-muted">Your balance</span>
                <span className="text-xs font-display text-cyan">{user?.credits?.toFixed(2)} CR</span>
              </div>

              {err && (
                <div className="flex items-center gap-2 text-xs text-red-400 bg-red-900/10 border border-red-900/30 rounded-lg p-3">
                  <AlertCircle size={13} /> {err}
                </div>
              )}

              <button onClick={run} disabled={busy || !datasetId}
                className="btn-primary w-full justify-center flex items-center gap-2 disabled:opacity-40">
                <Play size={13} />
                {busy ? 'Running…' : `Run ${ep?.label}`}
                {ep?.cost > 0 && !busy && <span className="text-[10px] opacity-70">(-{ep.cost} CR)</span>}
              </button>
            </div>
          </div>
        </div>

        {/* Results */}
        <div>
          {result ? (
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <Zap size={13} className="text-cyan" />
                <p className="section-title mb-0">response</p>
              </div>

              {endpoint === 'get_schema' && result.schema ? (
                <div>
                  <div className="flex gap-4 mb-4">
                    <div className="stat-card flex-1">
                      <p className="stat-label">total</p>
                      <p className="text-lg font-display text-soft">{result.total_features}</p>
                    </div>
                    <div className="stat-card flex-1">
                      <p className="stat-label">active</p>
                      <p className="text-lg font-display text-cyan">{result.active_count}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-60 overflow-y-auto">
                    {result.schema.map(f => (
                      <span key={f.feature}
                        className={`text-[10px] font-mono px-2 py-0.5 rounded
                          ${f.active ? 'bg-cyan/10 text-cyan border border-cyan/20' : 'bg-edge text-muted/50'}`}>
                        {f.feature}
                      </span>
                    ))}
                  </div>
                </div>
              ) : endpoint === 'get_batch' && result.data ? (
                <div>
                  <p className="text-xs text-muted mb-3 font-mono">
                    {result.batch_size} samples · sparse={String(result.sparse)}
                  </p>
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {result.data.map((sample, i) => (
                      <div key={i} className="border border-edge rounded-lg p-3">
                        <p className="text-[10px] text-muted font-mono mb-2">sample[{i}]</p>
                        <FeatureViewer features={sample} schema={schema?.schema?.map(f => f.feature) || []} />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <FeatureViewer
                  features={result.features}
                  schema={schema?.schema?.map(f => f.feature) || []}
                />
              )}
            </div>
          ) : (
            <div className="card h-full min-h-48 flex items-center justify-center">
              <div className="text-center">
                <div className="w-10 h-10 rounded-xl bg-edge flex items-center justify-center mx-auto mb-3">
                  <Play size={16} className="text-muted" />
                </div>
                <p className="text-xs text-muted">Run a query to see results</p>
                <p className="text-[10px] text-muted mt-1">Only feature vectors are returned — never raw sequences</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
