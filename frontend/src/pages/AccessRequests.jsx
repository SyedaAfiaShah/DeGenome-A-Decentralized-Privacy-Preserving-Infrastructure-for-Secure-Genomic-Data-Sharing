import { useEffect, useState } from 'react'
import { incomingRequests, outgoingRequests, decideAccess } from '../services/api'
import useAuthStore from '../store/authStore'
import { CheckCircle, XCircle, Clock, ChevronDown } from 'lucide-react'

const statusBadge = s => ({
  approved: <span className="badge-green badge"><CheckCircle size={9} /> approved</span>,
  rejected: <span className="badge-red badge"><XCircle size={9} /> rejected</span>,
  pending:  <span className="badge-yellow badge"><Clock size={9} /> pending</span>,
}[s] || <span className="badge-muted badge">{s}</span>)

export default function AccessRequests() {
  const { isContributor } = useAuthStore()
  const [incoming, setIncoming] = useState([])
  const [outgoing, setOutgoing] = useState([])
  const [tab,      setTab]      = useState(isContributor() ? 'incoming' : 'outgoing')
  const [busy,     setBusy]     = useState({})

  const load = () => {
    incomingRequests().then(r => setIncoming(r.data)).catch(() => {})
    outgoingRequests().then(r => setOutgoing(r.data)).catch(() => {})
  }

  useEffect(load, [])

  const decide = async (request_id, decision) => {
    setBusy(b => ({ ...b, [request_id]: true }))
    try {
      await decideAccess({ request_id, decision, days_valid: 30 })
      load()
    } catch {}
    setBusy(b => ({ ...b, [request_id]: false }))
  }

  const list = tab === 'incoming' ? incoming : outgoing

  return (
    <div className="page">
      <h1 className="font-display text-2xl text-soft mb-1">Access requests</h1>
      <p className="text-xs text-muted mb-6">Manage data access permissions</p>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
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
                      onClick={() => decide(req.request_id, 'approved')}
                      disabled={busy[req.request_id]}
                      className="btn-ghost text-xs py-1.5 px-3 border-green-800/40 text-green-400 hover:border-green-600 hover:bg-green-900/10">
                      Approve
                    </button>
                    <button
                      onClick={() => decide(req.request_id, 'rejected')}
                      disabled={busy[req.request_id]}
                      className="btn-danger text-xs py-1.5 px-3">
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
