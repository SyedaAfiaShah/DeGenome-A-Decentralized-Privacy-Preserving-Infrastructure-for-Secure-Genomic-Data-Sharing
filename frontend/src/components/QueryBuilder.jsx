import { Filter } from 'lucide-react'

const FEATURE_TYPES = [
  { value: '',            label: 'All feature types' },
  { value: 'nucleotide',  label: 'Nucleotide statistics' },
  { value: 'kmer',        label: 'K-mer frequencies' },
  { value: 'SNP',         label: 'SNP / variant statistics' },
]

/**
 * Query filter controls for POST /data/query.
 *
 * Props:
 *   params   — { featureType, chromosome, rangeMin, rangeMax }
 *   onChange — called with the updated params object
 */
export default function QueryBuilder({ params, onChange }) {
  const set = (key, val) => onChange({ ...params, [key]: val })

  const showChromosome = params.featureType === '' || params.featureType === 'SNP'

  return (
    <div className="space-y-4 pt-4 border-t border-edge">
      <div className="flex items-center gap-2">
        <Filter size={11} className="text-cyan" />
        <p className="text-[10px] font-display text-muted uppercase tracking-widest">query filters</p>
      </div>

      {/* Feature type */}
      <div>
        <label className="label">Feature type</label>
        <select className="input" value={params.featureType}
          onChange={e => set('featureType', e.target.value)}>
          {FEATURE_TYPES.map(ft => (
            <option key={ft.value} value={ft.value}>{ft.label}</option>
          ))}
        </select>
      </div>

      {/* Chromosome — only meaningful for SNP/all */}
      {showChromosome && (
        <div>
          <label className="label">
            Chromosome <span className="text-muted font-normal">(optional)</span>
          </label>
          <input className="input" placeholder="e.g. 1  or  chrX"
            value={params.chromosome}
            onChange={e => set('chromosome', e.target.value)} />
        </div>
      )}

      {/* Value range */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">
            Min value <span className="text-muted font-normal">(optional)</span>
          </label>
          <input className="input" type="number" step="any" placeholder="0"
            value={params.rangeMin}
            onChange={e => set('rangeMin', e.target.value)} />
        </div>
        <div>
          <label className="label">
            Max value <span className="text-muted font-normal">(optional)</span>
          </label>
          <input className="input" type="number" step="any" placeholder="—"
            value={params.rangeMax}
            onChange={e => set('rangeMax', e.target.value)} />
        </div>
      </div>

      <p className="text-[10px] text-muted">
        All filters are combined (AND). Omit a field to skip that filter.
      </p>
    </div>
  )
}
