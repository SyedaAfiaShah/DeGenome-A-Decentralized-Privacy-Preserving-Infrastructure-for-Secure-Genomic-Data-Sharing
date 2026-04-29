import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getMyKeys } from '../services/api'
import { Key, Copy, Check, Database, Code } from 'lucide-react'

const BACKEND = 'https://degenome.onrender.com'

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

function curlSnippet(datasetId) {
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

export default function ApiDocs() {
  const [myKeys,     setMyKeys]     = useState([])
  const [loading,    setLoading]    = useState(true)
  const [activeTabs, setActiveTabs] = useState({})
  const [copiedCode, setCopiedCode] = useState({})

  useEffect(() => {
    getMyKeys()
      .then(r => setMyKeys(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const getTab   = keyId => activeTabs[keyId] || 'python'
  const setTab   = (keyId, t) => setActiveTabs(prev => ({ ...prev, [keyId]: t }))
  const copyCode = (keyId, code) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(prev => ({ ...prev, [keyId]: true }))
    setTimeout(() => setCopiedCode(prev => ({ ...prev, [keyId]: false })), 2000)
  }

  return (
    <div className="page">
      <h1 className="font-display text-2xl text-soft mb-1">API Reference</h1>
      <p className="text-xs text-muted mb-6">Use your API keys to query datasets in your own pipelines</p>

      <div className="rounded-lg border border-edge bg-ink/30 px-4 py-3 mb-8">
        <p className="text-xs text-muted leading-relaxed">
          Replace the key prefix shown below with your full key received at access approval.
          Keys are never stored — if lost, request access again from the{' '}
          <Link to="/explorer" className="text-cyan hover:underline">Explorer</Link>.
        </p>
      </div>

      {loading ? (
        <div className="card text-center py-12">
          <p className="text-xs text-muted">Loading…</p>
        </div>
      ) : myKeys.length === 0 ? (
        <div className="card text-center py-16">
          <div className="w-12 h-12 rounded-xl bg-edge flex items-center justify-center mx-auto mb-4">
            <Key size={20} className="text-muted" />
          </div>
          <p className="text-sm font-display text-soft mb-2">You have no active API keys.</p>
          <p className="text-xs text-muted max-w-xs mx-auto">
            <Link to="/explorer" className="text-cyan hover:underline">
              Request access to a dataset from the Explorer
            </Link>
            {' '}to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {myKeys.map(k => {
            const tab       = getTab(k.id)
            const copied    = copiedCode[k.id] || false
            const isRawFile = k.access_type === 'raw_file_access'
            const tabs      = isRawFile
              ? []
              : [{ key: 'python', label: 'Python' }, { key: 'curl', label: 'curl' }]
            const code = isRawFile
              ? 'Raw file access is coming soon.'
              : tab === 'curl'
                ? curlSnippet(k.dataset_id)
                : featurePythonSnippet(k.dataset_id)

            return (
              <div key={k.id} className="card space-y-4">
                {/* Header */}
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

                {/* Cost note */}
                <div className="rounded-lg bg-ink/40 border border-edge px-3 py-2">
                  <p className="text-[10px] text-muted">
                    {isRawFile
                      ? 'This key grants access to the raw encrypted file on Storj. Cost: 5 credits per download.'
                      : 'This key grants access to privacy-protected feature vectors. Cost: 1 credit per query.'}
                  </p>
                </div>

                {/* Code tabs */}
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

                {/* dataset_id helper */}
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
  )
}
