/**
 * Client-side differential privacy layer.
 * Applies calibrated Laplace noise to feature vectors before upload.
 * Mirrors backend/processing/privacy.py — runs entirely in the browser.
 * Raw features are never sent to the server; only noised vectors leave the client.
 */

// Sensitivity per feature type — how much a single record can shift this value.
// Checked as substring matches against the feature name (same logic as the Python backend).
const SENSITIVITY_MAP = [
  // Count features: adding one sequence/variant changes count by at most 1
  ['_count',          1.0],
  // Ratio / bounded features: range is [0, 1]
  ['_content',        1.0],
  ['_ratio',          1.0],
  ['_entropy',        1.0],
  // K-mer frequencies: bounded [0, 1]
  ['kmer_',           1.0],
  // VCF totals
  ['total_',          1.0],
  ['snp_',            1.0],
  ['indel_',          1.0],
  ['ts_',             1.0],
  ['tv_',             1.0],
  ['het_',            1.0],
  ['hom_',            1.0],
  ['chr_',            1.0],
  // Allele frequency stats
  ['allele_freq_',    1.0],
  // Sequence length has larger scale — one sequence can be thousands of bases
  ['sequence_length', 10.0],
]

export const DEFAULT_EPSILON = 1.0

// ── Helpers ────────────────────────────────────────────────────────────────────

function sensitivity(featureName) {
  for (const [substr, s] of SENSITIVITY_MAP) {
    if (featureName.includes(substr)) return s
  }
  return 1.0
}

/**
 * Sample from Laplace(0, scale) via the difference-of-exponentials method.
 *   Exp(scale) = -scale * ln(U),  U ~ Uniform(0, 1)
 *   Laplace(0, scale) = Exp₁ − Exp₂
 * Both draws use Math.log(Math.random()) as requested.
 */
function laplaceSample(scale) {
  return -scale * Math.log(Math.random()) + scale * Math.log(Math.random())
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Add calibrated Laplace noise to all numeric features.
 * Non-numeric values (e.g. string labels) are passed through unchanged.
 *
 * Clipping rules (same as Python backend):
 *  - ratio / content / kmer / entropy / allele_freq  → clamped to [0, 1]
 *  - count / total / sequence_length / chromosome_count → clamped to ≥ 0
 *
 * @param {Object} features - feature name → value
 * @param {number} epsilon  - privacy budget; smaller ε = more noise (default 1.0)
 * @returns {Object}        - noised feature dict, values rounded to 6 d.p.
 */
export function addLaplaceNoise(features, epsilon = DEFAULT_EPSILON) {
  const noised = {}

  for (const [name, value] of Object.entries(features)) {
    if (typeof value !== 'number') {
      noised[name] = value
      continue
    }

    const scale  = sensitivity(name) / epsilon
    let   result = value + laplaceSample(scale)

    if (['_ratio', '_content', 'kmer_', '_entropy', 'allele_freq_'].some(s => name.includes(s))) {
      result = Math.max(0.0, Math.min(1.0, result))
    } else if (['_count', 'total_', 'sequence_length', 'chromosome_count'].some(s => name.includes(s))) {
      result = Math.max(0.0, result)
    }

    noised[name] = Math.round(result * 1e6) / 1e6
  }

  return noised
}

/**
 * Remove zero-valued features for sparse representation.
 *
 * @param {Object} features
 * @returns {Object}
 */
export function stripZeros(features) {
  return Object.fromEntries(
    Object.entries(features).filter(([, v]) => v !== 0 && v !== 0.0)
  )
}
