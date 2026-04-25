import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload as UploadIcon, FileText, Shield, CheckCircle, AlertCircle, Lock, HardDrive, Database } from 'lucide-react'
import { getPresignedUploadUrl, registerDataset } from '../services/api'
import { extractFeatures, buildFullSchema } from '../utils/featureExtraction'
import { addLaplaceNoise, stripZeros } from '../utils/privacy'

// select → extracting → storageOptions → uploading → done
const STEPS = ['select', 'extracting', 'storageOptions', 'uploading', 'done']

export default function Upload() {
  const [file,          setFile]          = useState(null)
  const [title,         setTitle]         = useState('')
  const [desc,          setDesc]          = useState('')
  const [epsilon,       setEpsilon]       = useState(1.0)
  const [step,          setStep]          = useState('select')
  const [storageOption, setStorageOption] = useState('features_only')  // features_only | raw_file
  const [extracted,     setExtracted]     = useState(null)             // { sparse, schema }
  const [result,        setResult]        = useState(null)
  const [err,           setErr]           = useState('')
  const inputRef  = useRef()
  const navigate  = useNavigate()

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

  // Phase 1: local extraction only — no network
  const submit = async e => {
    e.preventDefault()
    if (!file || !title.trim()) return
    setErr('')
    try {
      setStep('extracting')
      const content = await file.text()
      const raw     = extractFeatures(content, fmt)
      const noised  = addLaplaceNoise(raw, epsilon)
      const sparse  = stripZeros(noised)
      const schema  = buildFullSchema(fmt, sparse)
      setExtracted({ sparse, schema })
      setStep('storageOptions')
    } catch (e) {
      setErr(e.message || 'Feature extraction failed')
      setStep('select')
    }
  }

  // Phase 2: upload / register based on storage choice
  const handleContinue = async () => {
    if (!extracted) return
    setErr('')
    setStep('uploading')
    try {
      let object_key = null

      if (storageOption === 'raw_file') {
        const { data: presign } = await getPresignedUploadUrl(file.name, fmt)
        await fetch(presign.url, {
          method:  'PUT',
          headers: { 'Content-Type': 'text/plain' },
          body:    await file.arrayBuffer(),
        })
        object_key = presign.object_key
      }

      const body = {
        title,
        description:     desc,
        format_type:     fmt,
        epsilon,
        feature_vector:  extracted.sparse,
        feature_schema:  extracted.schema.all_features,
        active_features: extracted.schema.active_features,
        regions:         [],
      }
      if (object_key) body.object_key = object_key

      const { data } = await registerDataset(body)
      setResult(data)
      setStep('done')
    } catch (e) {
      setErr(e.response?.data?.detail || e.message || 'Upload failed')
      setStep('storageOptions')
    }
  }

  // ── Loading states ─────────────────────────────────────────────────────────
  if (step === 'extracting' || step === 'uploading') {
    return (
      <div className="page max-w-xl mx-auto">
        <div className="card text-center py-12">
          <div className="w-10 h-10 rounded-xl bg-cyan/10 border border-cyan/20 flex items-center justify-center mx-auto mb-4 animate-pulse">
            {step === 'extracting'
              ? <Shield size={18} className="text-cyan" />
              : <UploadIcon size={18} className="text-cyan" />}
          </div>
          <p className="font-display text-sm text-soft mb-1">
            {step === 'extracting' ? 'Extracting features…' : 'Uploading…'}
          </p>
          <p className="text-xs text-muted">
            {step === 'extracting'
              ? 'Processing locally — no data sent to server yet'
              : storageOption === 'raw_file' ? 'Uploading to Storj and registering dataset' : 'Registering dataset'}
          </p>
        </div>
      </div>
    )
  }

  // ── Storage options step ───────────────────────────────────────────────────
  if (step === 'storageOptions') {
    return (
      <div className="page max-w-xl mx-auto">
        <h1 className="font-display text-2xl text-soft mb-1">Storage options</h1>
        <p className="text-xs text-muted mb-8">
          Choose how to store <span className="text-soft">{title}</span>
        </p>

        <div className="space-y-4 mb-8">
          {/* Option A — features only */}
          <div
            onClick={() => setStorageOption('features_only')}
            className={`card cursor-pointer transition-all select-none
              ${storageOption === 'features_only' ? 'border-cyan bg-cyan/5' : 'hover:border-muted/60'}`}
          >
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors
                ${storageOption === 'features_only' ? 'border-cyan' : 'border-muted'}`}>
                {storageOption === 'features_only' && <div className="w-2 h-2 rounded-full bg-cyan" />}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <HardDrive size={13} className="text-muted" />
                  <p className="text-sm font-display text-soft">Features only</p>
                </div>
                <p className="text-xs text-muted mb-2">
                  Extract and store privacy-protected feature vector. Raw file is not uploaded.
                </p>
                <span className="text-[10px] font-display text-acid">+5 credits on registration</span>
              </div>
            </div>
          </div>

          {/* Option B — features + raw file */}
          <div
            className="card transition-all select-none opacity-40 pointer-events-none border-edge"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors border-muted">
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Database size={13} className="text-muted" />
                  <p className="text-sm font-display text-soft">Features + Raw file on Storj</p>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-ink border border-edge text-muted">Coming Soon</span>
                </div>
                <p className="text-xs text-muted mb-2">
                  Encrypted raw file storage with researcher key exchange coming in a future release.
                </p>
              </div>
            </div>
          </div>
        </div>

        {err && (
          <div className="flex items-center gap-2 text-xs text-red-400 bg-red-900/10 border border-red-900/30 rounded-lg p-3 mb-4">
            <AlertCircle size={13} /> {err}
          </div>
        )}

        <button onClick={handleContinue} className="btn-primary w-full justify-center">
          Continue
        </button>
      </div>
    )
  }

  // ── Done state ─────────────────────────────────────────────────────────────
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
            <Row label="Storage"         value={result.has_raw_file ? 'Features + Raw file (Storj)' : 'Features only'} />
            <Row label="Privacy (ε)"     value={result.epsilon} />
          </div>

          <div className="flex gap-3">
            <button onClick={() => { setFile(null); setTitle(''); setDesc(''); setResult(null); setExtracted(null); setStorageOption('features_only'); setStep('select') }}
              className="btn-ghost flex-1">Upload another</button>
            <button onClick={() => navigate('/explorer')} className="btn-primary flex-1">View explorer</button>
          </div>
        </div>
      </div>
    )
  }

  // ── Select / form state ────────────────────────────────────────────────────
  return (
    <div className="page max-w-2xl mx-auto">
      <h1 className="font-display text-2xl text-soft mb-1">Upload dataset</h1>
      <p className="text-xs text-muted mb-8">
        Features are extracted locally. Only privacy-protected vectors are stored.
      </p>

      {/* Privacy pipeline visual */}
      <div className="card-sm mb-6 flex items-center gap-0 overflow-x-auto">
        {[
          { icon: FileText,   label: 'raw file',  sub: 'stays local' },
          { icon: Shield,     label: 'extract',   sub: 'client-side' },
          { icon: Lock,       label: 'dp noise',  sub: `ε=${epsilon}` },
          { icon: UploadIcon, label: 'upload',    sub: 'features only' },
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
          Extract features →
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
