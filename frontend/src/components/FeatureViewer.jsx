import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

export default function FeatureViewer({ features, schema = [] }) {
  const [showZeros, setShowZeros] = useState(false)

  if (!features) return null

  const activeEntries = Object.entries(features).filter(([, v]) => v !== 0 && v !== 0.0)
  const zeroFeatures  = schema.filter(f => !(f in features) || features[f] === 0)

  // Compute max for bar scaling
  const nums    = activeEntries.map(([, v]) => typeof v === 'number' ? Math.abs(v) : 0)
  const maxVal  = Math.max(...nums, 1)

  const grouped = groupFeatures(activeEntries)

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([group, entries]) => (
        <div key={group}>
          <p className="section-title">{group}</p>
          <div className="space-y-2">
            {entries.map(([key, value]) => (
              <FeatureRow key={key} name={key} value={value} max={maxVal} />
            ))}
          </div>
        </div>
      ))}

      {zeroFeatures.length > 0 && (
        <div>
          <button
            onClick={() => setShowZeros(!showZeros)}
            className="flex items-center gap-2 text-xs font-display text-muted hover:text-soft transition-colors"
          >
            {showZeros ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {showZeros ? 'Hide' : 'Show'} {zeroFeatures.length} absent features
          </button>
          {showZeros && (
            <div className="mt-3 space-y-1.5">
              {zeroFeatures.map(f => (
                <div key={f} className="flex items-center justify-between py-1">
                  <span className="text-xs font-mono text-muted/60">{f}</span>
                  <span className="text-xs font-mono text-muted/40">0</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function FeatureRow({ name, value, max }) {
  const isNum   = typeof value === 'number'
  const pct     = isNum ? Math.min((Math.abs(value) / max) * 100, 100) : 0
  const display = isNum ? (Number.isInteger(value) ? value.toLocaleString() : value.toFixed(4)) : String(value)

  return (
    <div className="group">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-mono text-soft/80 group-hover:text-soft transition-colors">{name}</span>
        <span className="text-xs font-mono text-cyan">{display}</span>
      </div>
      {isNum && (
        <div className="h-0.5 bg-edge rounded-full overflow-hidden">
          <div
            className="h-full bg-cyan/40 feature-bar rounded-full"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  )
}

function groupFeatures(entries) {
  const groups = {
    'nucleotide statistics': [],
    'k-mer frequencies (k=2)': [],
    'k-mer frequencies (k=3)': [],
    'variant statistics': [],
    'chromosome data': [],
    'other': [],
  }

  for (const [key, val] of entries) {
    if (['A_count','T_count','G_count','C_count','N_count','GC_content','AT_content',
         'N_ratio','shannon_entropy','sequence_length','sequence_count'].includes(key)) {
      groups['nucleotide statistics'].push([key, val])
    } else if (key.startsWith('kmer_2_')) {
      groups['k-mer frequencies (k=2)'].push([key, val])
    } else if (key.startsWith('kmer_3_')) {
      groups['k-mer frequencies (k=3)'].push([key, val])
    } else if (key.startsWith('chr_')) {
      groups['chromosome data'].push([key, val])
    } else if (['total_variants','snp_count','indel_count','snp_ratio','ts_count','tv_count',
                'ts_tv_ratio','het_count','hom_count','het_ratio','allele_freq_mean',
                'allele_freq_std','allele_freq_min','allele_freq_max','chromosome_count'].includes(key)) {
      groups['variant statistics'].push([key, val])
    } else {
      groups['other'].push([key, val])
    }
  }

  return Object.fromEntries(Object.entries(groups).filter(([, v]) => v.length > 0))
}
