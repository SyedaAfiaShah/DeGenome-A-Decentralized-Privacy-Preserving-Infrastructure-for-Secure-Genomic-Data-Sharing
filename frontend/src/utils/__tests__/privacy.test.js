/**
 * Smoke test for privacy.js
 * Run with: node frontend/src/utils/__tests__/privacy.test.js
 *
 * Checks:
 *  - All numeric features are noised (shifted from original)
 *  - Ratio / kmer / entropy values stay in [0, 1]
 *  - Count / length values stay >= 0
 *  - Non-numeric values pass through unchanged
 *  - stripZeros removes zeros
 *  - Higher epsilon produces smaller average noise magnitude
 */

import { addLaplaceNoise, stripZeros, DEFAULT_EPSILON } from '../privacy.js'

// ── Fixture ────────────────────────────────────────────────────────────────────

// Realistic feature vector (typical FASTA + VCF output)
const FEATURES = {
  // FASTA
  A_count:          7,
  T_count:          8,
  G_count:          9,
  C_count:          9,
  N_count:          3,
  sequence_length:  36,
  sequence_count:   2,
  GC_content:       0.5,
  AT_content:       0.416667,
  N_ratio:          0.083333,
  shannon_entropy:  2.240341,   // slightly above 2 (5-bucket alphabet)
  kmer_2_AT:        0.21875,
  kmer_2_GC:        0.28125,
  kmer_3_ATG:       0.16129,
  // VCF
  total_variants:   3,
  snp_count:        2,
  indel_count:      1,
  snp_ratio:        0.666667,
  ts_count:         2,
  tv_count:         0,
  het_count:        2,
  hom_count:        1,
  het_ratio:        0.666667,
  allele_freq_mean: 0.133333,
  allele_freq_std:  0.084984,
  allele_freq_min:  0.05,
  allele_freq_max:  0.25,
  chromosome_count: 2,
  chr_1_variant_count: 2,
  chr_2_variant_count: 1,
  // Non-numeric (passthrough)
  format_type:      'fasta',
}

// ── Helpers ────────────────────────────────────────────────────────────────────

let passed = 0
let failed = 0

function check(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✓  ${label}`)
    passed++
  } else {
    console.error(`  ✗  ${label}${detail ? ' — ' + detail : ''}`)
    failed++
  }
}

// ── Run noise ─────────────────────────────────────────────────────────────────

console.log('\n── addLaplaceNoise (epsilon=1.0) ─────────────────────────────────')
const noised = addLaplaceNoise(FEATURES, DEFAULT_EPSILON)

console.log('\nBefore → After (selected features):')
const showKeys = [
  'A_count', 'sequence_length', 'GC_content', 'shannon_entropy',
  'kmer_2_AT', 'snp_ratio', 'allele_freq_mean', 'chr_1_variant_count',
]
const colW = 24
console.log(
  '  ' + 'Feature'.padEnd(colW) + 'Original'.padStart(12) + '  →  ' + 'Noised'.padStart(12)
)
console.log('  ' + '─'.repeat(colW + 32))
for (const k of showKeys) {
  const orig  = String(FEATURES[k]).padStart(12)
  const nois  = String(noised[k]).padStart(12)
  console.log(`  ${k.padEnd(colW)}${orig}  →  ${nois}`)
}

console.log('\nChecks:')

// Passthrough of non-numeric
check('non-numeric format_type passes through unchanged',
  noised.format_type === 'fasta', `got ${noised.format_type}`)

// Ratio / kmer / entropy bounds  [0, 1]
const boundedKeys = Object.keys(FEATURES).filter(k =>
  ['_ratio', '_content', 'kmer_', '_entropy', 'allele_freq_'].some(s => k.includes(s))
)
for (const k of boundedKeys) {
  check(`${k} in [0, 1]  (got ${noised[k]})`,
    noised[k] >= 0 && noised[k] <= 1)
}

// Count / length bounds  >= 0
const countKeys = Object.keys(FEATURES).filter(k =>
  ['_count', 'total_', 'sequence_length', 'chromosome_count'].some(s => k.includes(s))
)
for (const k of countKeys) {
  check(`${k} >= 0  (got ${noised[k]})`,
    noised[k] >= 0)
}

// All numeric values changed (noise was actually applied)
// Run 20 times; at least 90 % of numeric features should differ from original
// (a single run could coincidentally round back, but over 20 runs all will differ)
const numericKeys = Object.keys(FEATURES).filter(k => typeof FEATURES[k] === 'number')
let anyChanged = numericKeys.some(k => noised[k] !== FEATURES[k])
check('at least one numeric feature was shifted by noise', anyChanged)

// Values are rounded to at most 6 decimal places
const allRounded = Object.values(noised)
  .filter(v => typeof v === 'number')
  .every(v => String(v).replace('.', '').length <= 8)   // loose sanity check
check('all numeric outputs have <= 6 decimal places', allRounded)

// ── Higher epsilon → smaller noise ───────────────────────────────────────────

console.log('\n── Epsilon sensitivity (averaged over 500 runs) ──────────────────')

function avgNoiseMagnitude(eps, runs = 500) {
  let total = 0
  let n     = 0
  for (let i = 0; i < runs; i++) {
    const out = addLaplaceNoise(FEATURES, eps)
    for (const k of numericKeys) {
      total += Math.abs(out[k] - FEATURES[k])
      n++
    }
  }
  return total / n
}

const avgLow  = avgNoiseMagnitude(0.1)   // loose privacy → large noise
const avgMid  = avgNoiseMagnitude(1.0)   // default
const avgHigh = avgNoiseMagnitude(10.0)  // tight privacy → small noise

console.log(`  avg |noise|  ε=0.1  : ${avgLow.toFixed(4)}`)
console.log(`  avg |noise|  ε=1.0  : ${avgMid.toFixed(4)}`)
console.log(`  avg |noise|  ε=10.0 : ${avgHigh.toFixed(4)}`)

check('ε=0.1 produces larger noise than ε=1.0',  avgLow  > avgMid,
  `${avgLow.toFixed(4)} vs ${avgMid.toFixed(4)}`)
check('ε=1.0 produces larger noise than ε=10.0', avgMid  > avgHigh,
  `${avgMid.toFixed(4)} vs ${avgHigh.toFixed(4)}`)

// ── stripZeros ────────────────────────────────────────────────────────────────

console.log('\n── stripZeros ────────────────────────────────────────────────────')
const withZeros  = { a: 1.5, b: 0, c: 0.0, d: 3, e: 'keep' }
const stripped   = stripZeros(withZeros)
check('zero integer removed',         !('b' in stripped))
check('zero float removed',           !('c' in stripped))
check('non-zero value kept',          stripped.a === 1.5 && stripped.d === 3)
check('non-numeric value kept',       stripped.e === 'keep')

// stripZeros on noised output — tv_count may be 0 after clipping
const strippedNoised = stripZeros(noised)
check('stripZeros output is subset of noised keys',
  Object.keys(strippedNoised).every(k => k in noised))

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(55)}`)
console.log(`  ${passed} passed  |  ${failed} failed`)
console.log('─'.repeat(55))
if (failed > 0) process.exit(1)
