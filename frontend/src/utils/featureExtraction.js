/**
 * Client-side feature extraction for FASTA and VCF genomic files.
 * Mirrors backend/processing/feature_extraction.py — runs entirely in the browser.
 * Raw sequences are never stored or returned — only derived statistics.
 */

// ── Shared helpers ─────────────────────────────────────────────────────────────

/** Generate the Cartesian product of arr with itself, repeated `repeat` times. */
function cartesianProduct(arr, repeat) {
  let result = [[]]
  for (let i = 0; i < repeat; i++) {
    const next = []
    for (const existing of result) {
      for (const item of arr) {
        next.push([...existing, item])
      }
    }
    result = next
  }
  return result
}

/** Round a float to 6 decimal places (matches Python's round(x, 6)). */
function r6(x) {
  return Math.round(x * 1e6) / 1e6
}


// ── FASTA ──────────────────────────────────────────────────────────────────────

function parseFasta(content) {
  const sequences = []
  let current = []
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (trimmed.startsWith('>')) {
      if (current.length) {
        sequences.push(current.join(''))
        current = []
      }
    } else {
      current.push(trimmed)
    }
  }
  if (current.length) sequences.push(current.join(''))
  return sequences
}

function shannonEntropy(counter, total) {
  if (total === 0) return 0.0
  let entropy = 0.0
  for (const count of Object.values(counter)) {
    if (count > 0) {
      const p = count / total
      entropy -= p * Math.log2(p)
    }
  }
  return entropy
}

/**
 * Return frequency ratios for every possible k-mer of length k over the ATGC alphabet.
 * Uses ratios rather than raw counts (less sensitive for differential privacy).
 */
function extractKmers(sequence, k) {
  if (sequence.length < k) return {}
  const alphabet = ['A', 'T', 'G', 'C']
  const allKmers = {}
  for (const combo of cartesianProduct(alphabet, k)) {
    allKmers[combo.join('')] = 0
  }
  const total = sequence.length - k + 1
  for (let i = 0; i < total; i++) {
    const kmer = sequence.slice(i, i + k)
    if (Object.prototype.hasOwnProperty.call(allKmers, kmer)) {
      allKmers[kmer]++
    }
  }
  const out = {}
  for (const [kmer, count] of Object.entries(allKmers)) {
    out[`kmer_${k}_${kmer}`] = total > 0 ? r6(count / total) : 0.0
  }
  return out
}

/**
 * Extract all features from a FASTA file string.
 * Handles multi-sequence FASTA by aggregating across all sequences.
 *
 * @param {string} content - raw FASTA file text
 * @returns {Object} feature name → numeric value
 */
export function extractFastaFeatures(content) {
  const sequences = parseFasta(content)
  if (!sequences.length) throw new Error('No valid sequences found in FASTA file')

  const combined = sequences.join('').toUpperCase()
  const features = {}

  // Nucleotide counts
  const counter = { A: 0, T: 0, G: 0, C: 0, N: 0 }
  for (const ch of combined) {
    if (Object.prototype.hasOwnProperty.call(counter, ch)) counter[ch]++
  }
  const total = combined.length

  features.A_count = counter.A
  features.T_count = counter.T
  features.G_count = counter.G
  features.C_count = counter.C
  features.N_count = counter.N
  features.sequence_length = total
  features.sequence_count  = sequences.length

  const gc = counter.G + counter.C
  features.GC_content      = total > 0 ? r6(gc / total) : 0.0
  features.AT_content      = total > 0 ? r6((counter.A + counter.T) / total) : 0.0
  features.N_ratio         = total > 0 ? r6(counter.N / total) : 0.0
  features.shannon_entropy = r6(shannonEntropy(counter, total))

  // K-mer frequencies — k=2 and k=3 only (k≥4 risks sequence reconstruction)
  const clean = combined.replace(/[^ATGC]/g, '')
  Object.assign(features, extractKmers(clean, 2))
  Object.assign(features, extractKmers(clean, 3))

  return features
}


// ── VCF ────────────────────────────────────────────────────────────────────────

function extractAf(info) {
  for (const field of info.split(';')) {
    if (field.startsWith('AF=')) {
      const val = parseFloat(field.slice(3).split(',')[0])
      return isNaN(val) ? null : val
    }
  }
  return null
}

function extractZygosity(fmt, smp) {
  if (!fmt || !smp) return null
  const fields = fmt.split(':')
  const values = smp.split(':')
  const gtIdx  = fields.indexOf('GT')
  if (gtIdx === -1) return null
  const gt      = values[gtIdx] ?? ''
  const alleles = gt.split(/[/|]/)
  if (alleles.length < 2) return null
  return alleles[0] === alleles[1] ? 'hom' : 'het'
}

// Transition pairs (order-independent): A↔G and C↔T
const TRANSITION_PAIRS = new Set(['AG', 'GA', 'CT', 'TC'])

function isSnp(r) {
  return r.ref.length === 1 && r.alt.length === 1 &&
         r.alt !== '.' && r.alt !== '*'
}

function isIndel(r) {
  return !isSnp(r) && r.alt !== '.' && r.alt !== '*'
}

function isTransition(r) {
  return TRANSITION_PAIRS.has((r.ref + r.alt).toUpperCase())
}

function parseVcf(content) {
  const records = []
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const parts = trimmed.split('\t')
    if (parts.length < 5) continue
    const chrom    = parts[0]
    const ref      = parts[3]
    const altField = parts[4]
    const info     = parts[7] ?? ''
    const fmt      = parts[8] ?? ''
    const smp      = parts[9] ?? ''
    const af       = extractAf(info)
    const zygosity = extractZygosity(fmt, smp)
    for (const alt of altField.split(',')) {
      records.push({ chrom, ref, alt: alt.trim(), af, zygosity })
    }
  }
  return records
}

function stdDev(values) {
  if (values.length < 2) return 0.0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  return Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length)
}

/**
 * Extract features from a VCF file string.
 * Returns global stats + per-chromosome dynamic features.
 *
 * @param {string} content - raw VCF file text
 * @returns {Object} feature name → numeric value
 */
export function extractVcfFeatures(content) {
  const records = parseVcf(content)
  if (!records.length) throw new Error('No valid variant records found in VCF file')

  const features = {}
  const total    = records.length
  features.total_variants = total

  // Variant classification
  const snps   = records.filter(isSnp)
  const indels = records.filter(isIndel)
  features.snp_count   = snps.length
  features.indel_count = indels.length
  features.snp_ratio   = total > 0 ? r6(snps.length / total) : 0.0

  // Transition / transversion ratio
  const ts = snps.filter(isTransition).length
  const tv = snps.filter(r => !isTransition(r)).length
  features.ts_count    = ts
  features.tv_count    = tv
  features.ts_tv_ratio = tv > 0 ? r6(ts / tv) : 0.0

  // Zygosity
  const hets = records.filter(r => r.zygosity === 'het')
  const homs = records.filter(r => r.zygosity === 'hom')
  features.het_count = hets.length
  features.hom_count = homs.length
  features.het_ratio = total > 0 ? r6(hets.length / total) : 0.0

  // Allele frequency stats (from AF INFO field when present)
  const afs = records.filter(r => r.af !== null).map(r => r.af)
  if (afs.length) {
    const mean = afs.reduce((a, b) => a + b, 0) / afs.length
    features.allele_freq_mean = r6(mean)
    features.allele_freq_std  = r6(stdDev(afs))
    features.allele_freq_min  = r6(Math.min(...afs))
    features.allele_freq_max  = r6(Math.max(...afs))
  }

  // Per-chromosome dynamic features
  const byChrom = {}
  for (const r of records) {
    if (!byChrom[r.chrom]) byChrom[r.chrom] = []
    byChrom[r.chrom].push(r)
  }

  features.chromosome_count = Object.keys(byChrom).length

  for (const chrom of Object.keys(byChrom).sort()) {
    const variants = byChrom[chrom]
    const safe     = chrom.replace('chr', '').replace(/\s+/g, '_')
    features[`chr_${safe}_variant_count`] = variants.length
    features[`chr_${safe}_snp_count`]     = variants.filter(isSnp).length
    features[`chr_${safe}_indel_count`]   = variants.filter(isIndel).length
  }

  return features
}


// ── Dispatcher ─────────────────────────────────────────────────────────────────

/**
 * Extract features from a genomic file, returning only non-zero values (sparse).
 *
 * @param {string} content    - raw file text
 * @param {string} formatType - 'fasta' | 'vcf'
 * @returns {Object} sparse feature dict
 */
export function extractFeatures(content, formatType) {
  let raw
  if (formatType === 'fasta') {
    raw = extractFastaFeatures(content)
  } else if (formatType === 'vcf') {
    raw = extractVcfFeatures(content)
  } else {
    throw new Error(`Unsupported format: ${formatType}`)
  }
  return Object.fromEntries(
    Object.entries(raw).filter(([, v]) => v !== 0 && v !== 0.0)
  )
}


// ── Schema builder ─────────────────────────────────────────────────────────────

/**
 * Build the complete feature schema for a format.
 * Mirrors build_full_schema() in feature_extraction.py.
 *
 * @param {string} formatType - 'fasta' | 'vcf'
 * @param {Object} extracted  - sparse feature dict (output of extractFeatures)
 * @returns {{ all_features: string[], active_features: string[] }}
 */
export function buildFullSchema(formatType, extracted) {
  let allFeats

  if (formatType === 'fasta') {
    const alphabet = ['A', 'T', 'G', 'C']
    allFeats = [
      'A_count', 'T_count', 'G_count', 'C_count', 'N_count',
      'sequence_length', 'sequence_count',
      'GC_content', 'AT_content', 'N_ratio', 'shannon_entropy',
      ...cartesianProduct(alphabet, 2).map(p => `kmer_2_${p.join('')}`),
      ...cartesianProduct(alphabet, 3).map(p => `kmer_3_${p.join('')}`),
    ]
    // Append any dynamic keys produced by extraction that aren't in the static list
    for (const k of Object.keys(extracted)) {
      if (!allFeats.includes(k)) allFeats.push(k)
    }
  } else {
    const staticFeats = [
      'total_variants', 'snp_count', 'indel_count', 'snp_ratio',
      'ts_count', 'tv_count', 'ts_tv_ratio',
      'het_count', 'hom_count', 'het_ratio',
      'allele_freq_mean', 'allele_freq_std', 'allele_freq_min', 'allele_freq_max',
      'chromosome_count',
    ]
    const dynamic = Object.keys(extracted)
      .filter(k => !staticFeats.includes(k))
      .sort()
    allFeats = [...staticFeats, ...dynamic]
  }

  return {
    all_features:    allFeats,
    active_features: Object.keys(extracted),
  }
}
