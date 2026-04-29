import { useNavigate } from 'react-router-dom'
import { Database, Lock, ChevronRight, Pencil, Trash2 } from 'lucide-react'

export default function DatasetCard({ dataset, onRequest, hasAccess, isOwner, onEdit, onDelete }) {
  const navigate = useNavigate()

  return (
    <div className="card hover:border-cyan/30 transition-all duration-200 group cursor-pointer"
         onClick={() => navigate(`/explorer/${dataset.dataset_id}`)}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan/10 border border-cyan/20 flex items-center justify-center">
            <Database size={14} className="text-cyan" />
          </div>
          <div>
            <p className="text-sm font-display text-soft">{dataset.title}</p>
            <p className="text-xs text-muted">{dataset.format_type?.toUpperCase()}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isOwner
            ? <span className="text-[10px] font-display px-1.5 py-0.5 rounded border border-teal-700/40 bg-teal-900/20 text-teal-300">your dataset</span>
            : hasAccess
              ? <span className="badge-green badge">access granted</span>
              : <span className="badge-muted badge"><Lock size={9} /> locked</span>}
        </div>
      </div>

      <p className="text-xs text-muted mb-4 line-clamp-2">{dataset.description || 'No description provided.'}</p>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <span className="text-xs font-display text-muted">
          <span className="text-soft">{dataset.feature_count}</span> features
        </span>
        {dataset.regions?.length > 0 && (
          <span className="text-xs font-display text-muted">
            <span className="text-soft">{dataset.regions.length}</span> chromosomes
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {(dataset.active_features || []).slice(0, 5).map(f => (
          <span key={f} className="text-[10px] font-mono px-2 py-0.5 bg-edge rounded text-muted">{f}</span>
        ))}
        {(dataset.active_features?.length || 0) > 5 && (
          <span className="text-[10px] font-mono px-2 py-0.5 bg-edge rounded text-muted">
            +{dataset.active_features.length - 5} more
          </span>
        )}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted font-mono">
          {new Date(dataset.created_at).toLocaleDateString()}
        </span>
        <div className="flex items-center gap-2">
          {isOwner ? (
            <>
              <button
                onClick={e => { e.stopPropagation(); onEdit && onEdit(dataset) }}
                className="p-1.5 rounded border border-edge text-muted hover:border-cyan/40 hover:text-cyan transition-colors"
                title="Edit dataset">
                <Pencil size={11} />
              </button>
              <button
                onClick={e => { e.stopPropagation(); onDelete && onDelete(dataset) }}
                className="p-1.5 rounded border border-edge text-muted hover:border-red-500/40 hover:text-red-400 transition-colors"
                title="Delete dataset">
                <Trash2 size={11} />
              </button>
            </>
          ) : (
            !hasAccess && onRequest && (
              <button
                onClick={e => { e.stopPropagation(); onRequest(dataset) }}
                className="btn-ghost text-xs py-1.5 px-3">
                Request access
              </button>
            )
          )}
          <ChevronRight size={14} className="text-muted group-hover:text-cyan transition-colors" />
        </div>
      </div>
    </div>
  )
}
