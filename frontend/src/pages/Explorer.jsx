import { useEffect, useState } from 'react'
import {
  listDatasets, outgoingRequests, requestAccess,
  getFeatureSchema, myDatasets, updateDataset, deleteDataset,
} from '../services/api'
import { showToast } from '../components/ToastContainer'
import useAuthStore from '../store/authStore'
import DatasetCard from '../components/DatasetCard'
import { Search, X, Database, AlertTriangle } from 'lucide-react'

export default function Explorer() {
  const user          = useAuthStore(state => state.user)
  const isContributor = useAuthStore(state => state.isContributor)

  const [datasets,     setDatasets]     = useState([])
  const [approved,     setApproved]     = useState(new Set())
  const [approvedMap,  setApprovedMap]  = useState(new Map())
  const [ownedIds,     setOwnedIds]     = useState(new Set())
  const [filter,       setFilter]       = useState('')
  const [fmtFilter,    setFmtFilter]    = useState('')
  const [modal,        setModal]        = useState(null)
  const [purpose,      setPurpose]      = useState('')
  const [busy,         setBusy]         = useState(false)
  const [msg,          setMsg]          = useState('')

  // Edit modal
  const [editTarget,   setEditTarget]   = useState(null)
  const [editTitle,    setEditTitle]    = useState('')
  const [editDesc,     setEditDesc]     = useState('')
  const [editBusy,     setEditBusy]     = useState(false)
  const [editErr,      setEditErr]      = useState('')
  const [editOk,       setEditOk]       = useState(false)

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteBusy,   setDeleteBusy]   = useState(false)
  const [deleteErr,    setDeleteErr]    = useState('')

  // Reissue key
  const [reissueTarget,  setReissueTarget]  = useState(null)
  const [reissuePurpose, setReissuePurpose] = useState('')
  const [reissueBusy,    setReissueBusy]    = useState(false)
  const [reissueErr,     setReissueErr]     = useState('')

  useEffect(() => {
    listDatasets().then(r => setDatasets(r.data)).catch(() => {})
    outgoingRequests().then(r => {
      const approvedReqs = r.data.filter(x => x.status === 'approved')
      setApproved(new Set(approvedReqs.map(x => x.dataset_id)))
      setApprovedMap(new Map(approvedReqs.map(x => [x.dataset_id, x.request_id])))
    }).catch(() => {})
    if (isContributor()) {
      myDatasets().then(r => setOwnedIds(new Set(r.data.map(d => d.dataset_id)))).catch(() => {})
    }
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

  const openEdit = (dataset) => {
    setEditTarget(dataset)
    setEditTitle(dataset.title)
    setEditDesc(dataset.description || '')
    setEditErr('')
    setEditOk(false)
  }

  const saveEdit = async () => {
    setEditBusy(true)
    setEditErr('')
    try {
      await updateDataset(editTarget.dataset_id, { title: editTitle, description: editDesc })
      setDatasets(prev => prev.map(d =>
        d.dataset_id === editTarget.dataset_id ? { ...d, title: editTitle, description: editDesc } : d
      ))
      setEditOk(true)
    } catch {
      setEditErr('Failed to save changes.')
    } finally {
      setEditBusy(false)
    }
  }

  const openDelete = (dataset) => {
    setDeleteTarget(dataset)
    setDeleteErr('')
  }

  const confirmDelete = async () => {
    setDeleteBusy(true)
    setDeleteErr('')
    try {
      await deleteDataset(deleteTarget.dataset_id)
      setDatasets(prev => prev.filter(d => d.dataset_id !== deleteTarget.dataset_id))
      setDeleteTarget(null)
    } catch {
      setDeleteErr('Failed to delete dataset. Please try again.')
    } finally {
      setDeleteBusy(false)
    }
  }

  const openReissue = (dataset) => {
    setReissueTarget(dataset)
    setReissuePurpose('I have lost my API key and need a new one issued.')
    setReissueErr('')
  }

  const confirmReissue = async () => {
    setReissueBusy(true)
    setReissueErr('')
    try {
      await requestAccess(reissueTarget.dataset_id, reissuePurpose, 'feature_access')
      setReissueTarget(null)
      showToast('Reissuance request sent. The contributor will need to approve it.', 'success')
    } catch (e) {
      const detail = e.response?.data?.detail
      setReissueErr(typeof detail === 'string' ? detail : 'Failed to send reissuance request.')
    } finally {
      setReissueBusy(false)
    }
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
              isOwner={ownedIds.has(d.dataset_id)}
              requestId={approvedMap.get(d.dataset_id)}
              onRequest={openRequest}
              onEdit={openEdit}
              onDelete={openDelete}
              onReissueRequest={openReissue}
            />
          ))}
        </div>
      )}

      {/* ── Request access modal ──────────────────────────────────────── */}
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

      {/* ── Edit modal ────────────────────────────────────────────────── */}
      {editTarget && (
        <div className="fixed inset-0 bg-void/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => !editBusy && setEditTarget(null)}>
          <div className="card w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-display text-soft text-base">Edit dataset</h3>
              <button onClick={() => !editBusy && setEditTarget(null)} className="text-muted hover:text-soft">
                <X size={16} />
              </button>
            </div>

            <div>
              <label className="label">Title</label>
              <input className="input" value={editTitle} onChange={e => setEditTitle(e.target.value)} />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea className="input resize-none h-24" value={editDesc}
                onChange={e => setEditDesc(e.target.value)} />
            </div>

            {editErr && <p className="text-xs text-red-400">{editErr}</p>}
            {editOk  && <p className="text-xs text-green-400">Changes saved.</p>}

            <div className="flex gap-3">
              <button onClick={() => setEditTarget(null)} disabled={editBusy}
                className="btn-ghost flex-1 justify-center">Cancel</button>
              <button onClick={saveEdit}
                disabled={editBusy || !editTitle.trim() || editOk}
                className="btn-primary flex-1 justify-center disabled:opacity-40">
                {editBusy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirmation modal ─────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-void/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => !deleteBusy && setDeleteTarget(null)}>
          <div className="card w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-900/30 border border-red-800/40 flex items-center justify-center shrink-0">
                <AlertTriangle size={14} className="text-red-400" />
              </div>
              <div>
                <h3 className="font-display text-soft text-base">Delete dataset</h3>
                <p className="text-xs text-muted mt-1">
                  Are you sure you want to delete{' '}
                  <span className="text-soft">"{deleteTarget.title}"</span>?
                  This will revoke all active API keys for this dataset. This cannot be undone.
                </p>
              </div>
            </div>

            {deleteErr && <p className="text-xs text-red-400">{deleteErr}</p>}

            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} disabled={deleteBusy}
                className="btn-ghost flex-1 justify-center">Cancel</button>
              <button onClick={confirmDelete} disabled={deleteBusy}
                className="btn-danger flex-1 justify-center disabled:opacity-40">
                {deleteBusy ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Request key reissuance modal ──────────────────────────────── */}
      {reissueTarget && (
        <div className="fixed inset-0 bg-void/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => !reissueBusy && setReissueTarget(null)}>
          <div className="card w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-display text-soft text-base">Request key reissuance</h3>
              <button onClick={() => !reissueBusy && setReissueTarget(null)} className="text-muted hover:text-soft">
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-muted">
              Your access to{' '}
              <span className="text-soft">"{reissueTarget.title}"</span>{' '}
              is still approved. Submitting this will ask the contributor to issue you a new API key.
            </p>
            <div>
              <label className="label">Purpose</label>
              <textarea className="input resize-none h-20"
                value={reissuePurpose}
                onChange={e => setReissuePurpose(e.target.value)} />
            </div>
            {reissueErr && <p className="text-xs text-red-400">{reissueErr}</p>}
            <div className="flex gap-3">
              <button onClick={() => setReissueTarget(null)} disabled={reissueBusy}
                className="btn-ghost flex-1 justify-center">Cancel</button>
              <button onClick={confirmReissue} disabled={reissueBusy || !reissuePurpose.trim()}
                className="btn-primary flex-1 justify-center disabled:opacity-40">
                {reissueBusy ? 'Submitting…' : 'Request reissuance'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
