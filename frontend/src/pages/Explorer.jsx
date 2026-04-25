import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listDatasets, outgoingRequests, requestAccess, getFeatureSchema } from '../services/api'
import DatasetCard from '../components/DatasetCard'
import FeatureViewer from '../components/FeatureViewer'
import { Search, X, Database } from 'lucide-react'

export default function Explorer() {
  const [datasets,  setDatasets]  = useState([])
  const [approved,  setApproved]  = useState(new Set())
  const [filter,    setFilter]    = useState('')
  const [fmtFilter, setFmtFilter] = useState('')
  const [modal,     setModal]     = useState(null)   // { dataset, schema }
  const [purpose,   setPurpose]   = useState('')
  const [busy,      setBusy]      = useState(false)
  const [msg,       setMsg]       = useState('')

  useEffect(() => {
    listDatasets().then(r => setDatasets(r.data)).catch(() => {})
    outgoingRequests().then(r => {
      const ids = new Set(r.data.filter(x => x.status === 'approved').map(x => x.dataset_id))
      setApproved(ids)
    }).catch(() => {})
  }, [])

  const openRequest = async (dataset) => {
    setPurpose(''); setMsg('')
    try {
      const { data: schema } = await getFeatureSchema(dataset.dataset_id)
      setModal({ dataset, schema })
    } catch {
      setModal({ dataset, schema: null })
    }
  }

  const submitRequest = async () => {
    if (!purpose.trim()) return
    setBusy(true)
    try {
      await requestAccess(modal.dataset.dataset_id, purpose)
      setMsg('Request sent! The owner will be notified.')
    } catch (e) {
      let errMsg = 'Request failed'
      if (e.response?.data?.detail) {
        errMsg = Array.isArray(e.response.data.detail) 
          ? e.response.data.detail.map(err => `${err.loc.join('.')}: ${err.msg}`).join(', ')
          : e.response.data.detail
      }
      setMsg(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg))
    } finally { setBusy(false) }
  }

  const filtered = datasets.filter(d => {
    const q = filter.toLowerCase()
    const matchesText = !q || d.title?.toLowerCase().includes(q) ||
      d.active_features?.some(f => f.includes(q))
    const matchesFmt = !fmtFilter || d.format_type === fmtFilter
    return matchesText && matchesFmt
  })

  return (
    <div className="page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl text-soft mb-1">Dataset explorer</h1>
          <p className="text-xs text-muted">{datasets.length} datasets available</p>
        </div>
      </div>

      {/* Search + filters */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input className="input pl-8" placeholder="Search by title or feature name…"
            value={filter} onChange={e => setFilter(e.target.value)} />
        </div>
        <div className="flex gap-2">
          {['', 'fasta', 'vcf'].map(f => (
            <button key={f} onClick={() => setFmtFilter(f)}
              className={`text-xs font-display px-3 py-2 rounded-lg border transition-all
                ${fmtFilter === f ? 'border-cyan text-cyan bg-cyan/10' : 'border-edge text-muted hover:border-muted'}`}>
              {f || 'all'}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Database size={32} className="text-muted mx-auto mb-3 opacity-40" />
          <p className="text-sm text-muted">No datasets found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(d => (
            <DatasetCard
              key={d.dataset_id}
              dataset={d}
              hasAccess={approved.has(d.dataset_id)}
              onRequest={openRequest}
            />
          ))}
        </div>
      )}

      {/* Request access modal */}
      {modal && (
        <div className="fixed inset-0 bg-void/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md relative">
            <button onClick={() => setModal(null)} className="absolute top-4 right-4 text-muted hover:text-soft">
              <X size={16} />
            </button>
            <h3 className="font-display text-soft text-base mb-1">Request access</h3>
            <p className="text-xs text-muted mb-4">{modal.dataset.title}</p>

            {modal.schema && (
              <div className="mb-4">
                <p className="section-title">available features ({modal.schema.active_count} active)</p>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {(modal.schema.schema || []).filter(f => f.active).slice(0, 20).map(f => (
                    <span key={f.feature} className="text-[10px] font-mono px-2 py-0.5 bg-edge rounded text-muted">
                      {f.feature}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-4">
              <label className="label">Research purpose</label>
              <textarea className="input resize-none h-20"
                placeholder="Briefly describe how you intend to use this data…"
                value={purpose} onChange={e => setPurpose(e.target.value)} />
            </div>

            {msg && <p className="text-xs font-mono text-cyan mb-3">{msg}</p>}

            <button onClick={submitRequest} disabled={busy || !purpose.trim() || !!msg}
              className="btn-primary w-full justify-center disabled:opacity-40">
              {busy ? 'Sending…' : 'Send request'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
