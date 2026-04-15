import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload as UploadIcon, FileText, Shield, CheckCircle, AlertCircle, Lock } from 'lucide-react'
import { getPresignedUploadUrl, registerDataset } from '../services/api'
import { extractFeatures, buildFullSchema } from '../utils/featureExtraction'
import { addLaplaceNoise, stripZeros } from '../utils/privacy'

const STEPS = ['select', 'extracting', 'uploading', 'done']

export default function Upload() {
  const [file,    setFile]   = useState(null)
  const [title,   setTitle]  = useState('')
  const [desc,    setDesc]   = useState('')
  const [epsilon, setEpsilon]= useState(1.0)
  const [step,    setStep]   = useState('select')
  const [result,  setResult] = useState(null)
  const [err,     setErr]    = useState('')
  const inputRef             = useRef()
  const navigate             = useNavigate()

  const fmt = file ? (file.name.endsWith('.vcf') ? 'vcf' : 'fasta') : null

  const handleFile = e => {
    const f = e.target.files[0]
    if (!f) return
    const ext = f.name.split('.').pop().toLowerCase()
    if (!['fasta','fa','vcf'].includes(ext)) {
      setErr('Only .fasta, .fa, and .vcf files are supported.'); return
    }
    setFile(f); setErr('')
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''))
  }

  const submit = async e => {
    e.preventDefault()
    if (!file || !title.trim()) return
    setErr('')

    try {
      // Step 2: local feature extraction — no network calls
      setStep('extracting')
      const content = await file.text()
      const raw     = extractFeatures(content, fmt)
      const noised  = addLaplaceNoise(raw, epsilon)
      const sparse  = stripZeros(noised)
      const schema  = buildFullSchema(fmt, sparse)

      // Step 3: presign → PUT directly to Storj → register metadata
      setStep('uploading')
      const { data: presign } = await getPresignedUploadUrl(file.name, fmt)

      await fetch(presign.url, {
        method:  'PUT',
        headers: { 'Content-Type': 'text/plain' },
        body:    await file.arrayBuffer(),
      })

      const { data } = await registerDataset({
        title,
        description:     desc,
        format_type:     fmt,
        object_key:      presign.object_key,
        epsilon,
        feature_vector:  sparse,
        feature_schema:  schema.all_features,
        active_features: schema.active_features,
        regions:         [],
      })

      setResult(data)
      setStep('done')
    } catch (e) {
      setErr(e.response?.data?.detail || e.message || 'Upload failed')
      setStep('select')
    }
  }

  if (step === 'done' && result) {
    return (
      <div className="page max-w-xl mx-auto">
        <div className="card text-center">
          <div className="w-12 h-12 rounded-full bg-green-900/30 border border-green-800/40 flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={22} className="text-green-400" />
          </div>
          <h2 className="font-display text-xl text-soft mb-2">Dataset uploaded</h2>
          <p className="text-xs text-muted mb-6">Your genomic data has been processed and stored securely.</p>

          <div className="space-y-3 text-left mb-6">
            <Row label="Dataset ID"      value={result.dataset_id} mono />
            <Row label="Metadata CID"    value={result.metadata_cid} mono />
            <Row label="Active features" value={`${result.feature_count} features extracted`} />
            <Row label="Privacy (ε)"     value={result.epsilon} />
          </div>

          <div className="flex gap-3">
            <button onClick={() => { setFile(null); setTitle(''); setDesc(''); setResult(null); setStep('select') }}
              className="btn-ghost flex-1">Upload another</button>
            <button onClick={() => navigate('/explorer')} className="btn-primary flex-1">View explorer</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page max-w-2xl mx-auto">
      <h1 className="font-display text-2xl text-soft mb-1">Upload dataset</h1>
      <p className="text-xs text-muted mb-8">
        Features are extracted locally. Only privacy-protected vectors are stored.
      </p>

      {/* Privacy pipeline visual */}
      <div className="card-sm mb-6 flex items-center gap-0 overflow-x-auto">
        {[
          { icon: FileText,   label: 'raw file', sub: 'stays local' },
          { icon: Shield,     label: 'extract',  sub: 'client-side' },
          { icon: Lock,       label: 'dp noise', sub: `ε=${epsilon}` },
          { icon: UploadIcon, label: 'upload',   sub: 'features only' },
        ].map(({ icon: Icon, label, sub }, i, arr) => (
          <div key={label} className="flex items-center">
            <div className={`flex flex-col items-center px-4 py-2 ${
              step !== 'select'
                ? i < STEPS.indexOf(step) + 1 ? 'opacity-100' : 'opacity-30'
                : 'opacity-60'}`}>
              <div className="w-7 h-7 rounded-lg bg-cyan/10 border border-cyan/20 flex items-center justify-center mb-1">
                <Icon size={13} className="text-cyan" />
              </div>
              <p className="text-[10px] font-display text-soft">{label}</p>
              <p className="text-[9px] text-muted">{sub}</p>
            </div>
            {i < arr.length - 1 && <div className="w-6 h-px bg-edge shrink-0" />}
          </div>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-5">
        {/* File drop */}
        <div
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
            ${file ? 'border-cyan/40 bg-cyan/5' : 'border-edge hover:border-cyan/30 hover:bg-edge/20'}`}
        >
          <input ref={inputRef} type="file" accept=".fasta,.fa,.vcf" className="hidden" onChange={handleFile} />
          {file ? (
            <div>
              <FileText size={24} className="text-cyan mx-auto mb-2" />
              <p className="text-sm font-display text-soft">{file.name}</p>
              <p className="text-xs text-muted">{(file.size / 1024).toFixed(1)} KB · {fmt?.toUpperCase()}</p>
            </div>
          ) : (
            <div>
              <UploadIcon size={24} className="text-muted mx-auto mb-2" />
              <p className="text-sm font-display text-soft mb-1">Drop genomic file here</p>
              <p className="text-xs text-muted">Supports .fasta, .fa, .vcf</p>
            </div>
          )}
        </div>

        <div>
          <label className="label">Title</label>
          <input className="input" placeholder="e.g. Human chr1 SNP dataset"
            value={title} onChange={e => setTitle(e.target.value)} required />
        </div>

        <div>
          <label className="label">Description</label>
          <textarea className="input resize-none h-20" placeholder="Brief description of this dataset…"
            value={desc} onChange={e => setDesc(e.target.value)} />
        </div>

        <div>
          <label className="label">Privacy budget (ε) — lower = more private</label>
          <div className="flex items-center gap-4">
            <input type="range" min="0.1" max="5" step="0.1" value={epsilon}
              onChange={e => setEpsilon(parseFloat(e.target.value))}
              className="flex-1 accent-cyan" />
            <span className="font-mono text-cyan text-sm w-8">{epsilon}</span>
          </div>
          <p className="text-[10px] text-muted mt-1">
            ε=0.1 (strong privacy, less utility) · ε=1.0 (recommended) · ε=5.0 (more utility, weaker privacy)
          </p>
        </div>

        {err && (
          <div className="flex items-center gap-2 text-xs text-red-400 bg-red-900/10 border border-red-900/30 rounded-lg p-3">
            <AlertCircle size={13} /> {err}
          </div>
        )}

        <button type="submit" disabled={!file || !title || step !== 'select'}
          className="btn-primary w-full justify-center disabled:opacity-40 disabled:cursor-not-allowed">
          {step === 'extracting' ? '🔬 Extracting features…'
           : step === 'uploading' ? '📡 Uploading…'
           : 'Upload dataset'}
        </button>
      </form>
    </div>
  )
}

function Row({ label, value, mono }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-edge last:border-0">
      <span className="text-xs text-muted shrink-0">{label}</span>
      <span className={`text-xs text-soft text-right break-all ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}
