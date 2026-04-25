import { useEffect, useState } from 'react'
import { incomingRequests, outgoingRequests, decideAccess, requestAccess, claimKey } from '../services/api'
import useAuthStore from '../store/authStore'
import { CheckCircle, XCircle, Clock, Copy, Check, X, Key, Plus } from 'lucide-react'

const statusBadge = s => ({
  approved: <span className="badge-green badge"><CheckCircle size={9} /> approved</span>,
  rejected: <span className="badge-red badge"><XCircle size={9} /> rejected</span>,
  pending:  <span className="badge-yellow badge"><Clock size={9} /> pending</span>,
}[s] || <span className="badge-muted badge">{s}</span>)

const accessTypeBadge = t => t === 'raw_file_access'
  ? <span className="text-[10px] font-display px-1.5 py-0.5 rounded border border-purple-700/40 bg-purple-900/20 text-purple-300">Raw File</span>
  : <span className="text-[10px] font-display px-1.5 py-0.5 rounded border border-cyan/30 bg-cyan/10 text-cyan">Feature Access</span>

export default function AccessRequests() {
  const user          = useAuthStore(state => state.user)
  const isContributor = useAuthStore(state => state.isContributor)
  const isResearcher  = useAuthStore(state => state.isResearcher)

  const [incoming,  setIncoming]  = useState([])
  const [outgoing,  setOutgoing]  = useState([])
  const [tab,       setTab]       = useState(isContributor() ? 'incoming' : 'outgoing')
  const [busy,      setBusy]      = useState({})

  // New request modal state
  const [showNewReq,       setShowNewReq]       = useState(false)
  const [newReqDatasetId,  setNewReqDatasetId]  = useState('')
  const [newReqPurpose,    setNewReqPurpose]    = useState('')
  const [newReqAccessType, setNewReqAccessType] = useState('feature_access')
  const [newReqBusy,       setNewReqBusy]       = useState(false)
  const [newReqErr,        setNewReqErr]        = useState('')

  // Approval key modal state
  const [approvalModal, setApprovalModal] = useState(null)  // { dataset_title, access_type, api_key }
  const [keyCopied,     setKeyCopied]     = useState(false)

  const load = () => {
    Promise.all([incomingRequests(), outgoingRequests()])
      .then(([inRes, outRes]) => {
        const allReqs = [...inRes.data, ...outRes.data]
        const unique  = Array.from(new Map(allReqs.map(r => [r.request_id, r])).values())
        setIncoming(unique.filter(req => req.owner_id === user?.id))
        setOutgoing(unique.filter(req => req.requester_id === user?.id))
      })
      .catch(() => {})
  }

  useEffect(load, [])

  const decide = async (request_id, decision, req) => {
    setBusy(b => ({ ...b, [request_id]: true }))
    try {
      await decideAccess({ request_id, decision, days_valid: 30 })
      load()
      if (decision === 'approved') {
        alert("Access granted. A key has been issued to the researcher.")
      }
    } catch {}
    setBusy(b => ({ ...b, [request_id]: false }))
  }

  const handleClaimKey = async (reqId) => {
    setBusy(b => ({ ...b, [reqId]: true }))
    try {
      const { data } = await claimKey(reqId)
      if (data.key) {
        setApprovalModal({
          dataset_title: data.dataset_title,
          access_type:   data.access_type,
          api_key:       data.key,
        })
        setKeyCopied(false)
        localStorage.setItem(`dg_claimed_${reqId}`, 'true')
      } else {
        alert("Key already claimed. Check your Dashboard for key prefix reference.")
        localStorage.setItem(`dg_claimed_${reqId}`, 'true')
        load()
      }
    } catch (e) {
      alert("Failed to claim key.")
    }
    setBusy(b => ({ ...b, [reqId]: false }))
  }

  useEffect(() => {
    outgoing.forEach(req => {
      if (req.status === 'approved' && !localStorage.getItem(`dg_claimed_${req.request_id}`)) {
        handleClaimKey(req.request_id)
      }
    })
  }, [outgoing])


  const submitNewRequest = async () => {
    if (!newReqDatasetId.trim() || !newReqPurpose.trim() || newReqBusy) return
    try {
      setNewReqBusy(true)
      setNewReqErr('')
      await requestAccess(newReqDatasetId.trim(), newReqPurpose.trim(), newReqAccessType)
      setShowNewReq(false)
      setNewReqDatasetId('')
      setNewReqPurpose('')
      setNewReqAccessType('feature_access')
      load()
    } catch (e) {
      let errMsg = 'Request failed'
      if (e.response?.data?.detail) {
        errMsg = Array.isArray(e.response.data.detail) 
          ? e.response.data.detail.map(err => `${err.loc.join('.')}: ${err.msg}`).join(', ')
          : e.response.data.detail
      }
      setNewReqErr(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg))
      setShowNewReq(false)
    } finally {
      setNewReqBusy(false)
    }
  }

  const copyKey = () => {
    navigator.clipboard.writeText(approvalModal.api_key)
    setKeyCopied(true)
    setTimeout(() => setKeyCopied(false), 2000)
  }

  const list = tab === 'incoming' ? incoming : outgoing

  return (
    <div className="page">
      <h1 className="font-display text-2xl text-soft mb-1">Access requests</h1>
      <p className="text-xs text-muted mb-6">Manage data access permissions</p>

      {/* Tabs + New Request button */}
      <div className="flex items-center justify-between gap-2 mb-6">
        <div className="flex gap-2">
          {[
            { key: 'incoming', label: `Incoming (${incoming.length})` },
            { key: 'outgoing', label: `Outgoing (${outgoing.length})` },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`text-xs font-display px-4 py-2 rounded-lg border transition-all
                ${tab === t.key ? 'border-cyan text-cyan bg-cyan/10' : 'border-edge text-muted hover:border-muted'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {isResearcher() && (
          <button onClick={() => setShowNewReq(true)}
            className="btn-primary flex items-center gap-2 text-xs py-2 px-3">
            <Plus size={12} /> New request
          </button>
        )}
      </div>

      {list.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-sm text-muted">No {tab} requests.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map(req => (
            <div key={req.request_id} className="card">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="text-sm font-display text-soft">{req.dataset_title}</p>
                    {statusBadge(req.status)}
                    {req.access_type && accessTypeBadge(req.access_type)}
                  </div>
                  <p className="text-xs text-muted mb-2">
                    {tab === 'incoming' ? `From: ${req.requester}` : `Dataset ID: ${req.dataset_id?.slice(0, 8)}…`}
                  </p>
                  {req.purpose && (
                    <p className="text-xs text-muted italic">"{req.purpose}"</p>
                  )}
                  {req.expires_at && (
                    <p className="text-[10px] text-muted mt-1 font-mono">
                      expires {new Date(req.expires_at).toLocaleDateString()}
                    </p>
                  )}
                </div>

                {tab === 'incoming' && req.status === 'pending' && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => decide(req.request_id, 'approved', req)}
                      disabled={busy[req.request_id]}
                      className="btn-ghost text-xs py-1.5 px-3 border-green-800/40 text-green-400 hover:border-green-600 hover:bg-green-900/10">
                      Approve
                    </button>
                    <button
                      onClick={() => decide(req.request_id, 'rejected', req)}
                      disabled={busy[req.request_id]}
                      className="btn-danger text-xs py-1.5 px-3">
                      Reject
                    </button>
                  </div>
                )}

                {tab === 'outgoing' && req.status === 'approved' && !localStorage.getItem(`dg_claimed_${req.request_id}`) && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleClaimKey(req.request_id)}
                      disabled={busy[req.request_id]}
                      className="btn-primary text-xs py-1.5 px-3">
                      Claim API Key
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── New Request Modal ──────────────────────────────────────────── */}
      {showNewReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setShowNewReq(false)}>
          <div className="w-full max-w-md card space-y-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base text-soft">Request dataset access</h2>
              <button onClick={() => { setShowNewReq(false); setNewReqErr('') }}
                className="text-muted hover:text-soft transition-colors">
                <X size={16} />
              </button>
            </div>

            <div>
              <label className="label">Dataset ID</label>
              <input className="input" placeholder="Paste dataset ID from Explorer"
                value={newReqDatasetId} onChange={e => setNewReqDatasetId(e.target.value)} />
            </div>

            <div>
              <label className="label">Access type</label>
              <div className="space-y-2 mt-1">
                {[
                  {
                    value: 'feature_access',
                    label: 'Feature Access',
                    desc:  'Access privacy-protected feature vectors for ML and statistical analysis',
                  },
                  {
                    value: 'raw_file_access',
                    label: 'Raw File Access',
                    desc:  'Raw file access requires encrypted key exchange and will be available in a future release.',
                    disabled: true
                  },
                ].map(opt => (
                  <label key={opt.value}
                    className={`flex items-start gap-3 p-3 rounded-lg border transition-all
                      ${opt.disabled ? 'opacity-40 pointer-events-none' : 'cursor-pointer'}
                      ${newReqAccessType === opt.value ? 'border-cyan bg-cyan/5' : 'border-edge hover:border-muted/60'}`}>
                    <input type="radio" name="access_type" value={opt.value}
                      disabled={opt.disabled}
                      checked={newReqAccessType === opt.value}
                      onChange={() => setNewReqAccessType(opt.value)}
                      className="mt-0.5 accent-cyan shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-display text-soft">{opt.label}</p>
                        {opt.disabled && <span className="text-[9px] px-1.5 py-0.5 rounded bg-ink border border-edge text-muted">Coming Soon</span>}
                      </div>
                      <p className="text-[10px] text-muted mt-0.5">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Purpose</label>
              <textarea className="input resize-none h-20"
                placeholder="Describe your research purpose…"
                value={newReqPurpose} onChange={e => setNewReqPurpose(e.target.value)} />
            </div>

            {newReqErr && (
              <p className="text-xs text-red-400">{newReqErr}</p>
            )}

            <div className="flex gap-3">
              <button onClick={() => { setShowNewReq(false); setNewReqErr('') }}
                className="btn-ghost flex-1 justify-center">Cancel</button>
              <button onClick={submitNewRequest}
                disabled={!newReqDatasetId.trim() || !newReqPurpose.trim() || newReqBusy}
                className="btn-primary flex-1 justify-center disabled:opacity-40">
                {newReqBusy ? 'Submitting…' : 'Submit request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Approval Key Modal ─────────────────────────────────────────── */}
      {approvalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md card space-y-5">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-green-900/30 border border-green-800/40 flex items-center justify-center shrink-0">
                <Key size={14} className="text-green-400" />
              </div>
              <div>
                <h2 className="font-display text-base text-soft">Your API Key</h2>
                <p className="text-xs text-muted mt-0.5">
                  {approvalModal.dataset_title} · {accessTypeBadge(approvalModal.access_type)}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-yellow-700/40 bg-yellow-900/10 p-3">
              <p className="text-xs text-yellow-300 font-display mb-0.5">This key will not be shown again</p>
              <p className="text-[10px] text-yellow-400/70">Copy this key now. It will not be shown again.</p>
            </div>

            <div>
              <p className="label mb-2">API Key</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 font-mono text-xs text-soft bg-ink/60 border border-edge rounded-lg px-3 py-2.5 break-all">
                  {approvalModal.api_key}
                </code>
                <button onClick={copyKey}
                  className="shrink-0 p-2.5 rounded-lg border border-edge hover:border-cyan/30 transition-colors">
                  {keyCopied
                    ? <Check size={13} className="text-green-400" />
                    : <Copy size={13} className="text-muted" />}
                </button>
              </div>
            </div>

            <button onClick={() => { setApprovalModal(null); setKeyCopied(false) }}
              className="btn-primary w-full justify-center">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
