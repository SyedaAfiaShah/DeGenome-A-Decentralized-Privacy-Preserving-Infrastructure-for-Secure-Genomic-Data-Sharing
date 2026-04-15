/**
 * Inline smoke test for featureExtraction.js
 * Run with: node frontend/src/utils/__tests__/featureExtraction.test.js
 *
 * Checks:
 *  - No exceptions thrown
 *  - Expected feature keys are present
 *  - Numeric values are in sensible ranges
 *  - K-mer keys exist and sum to ~1
 *  - VCF per-chromosome dynamic keys are generated
 */

import { extractFastaFeatures, extractVcfFeatures, extractFeatures, buildFullSchema }
  from '../featureExtraction.js'

// ── Fixtures ───────────────────────────────────────────────────────────────────

const FASTA = `\
>seq1 human chr1 snippet
ATGCATGCATGCNNNATGC
>seq2 another sequence
GCGCGCTATATATGCGC
`

// Minimal VCF: 3 variants across 2 chromosomes, with GT and AF
const VCF = `\
##fileformat=VCFv4.2
##FILTER=<ID=PASS,Description="All filters passed">
#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tSAMPLE1
chr1\t100\t.\tA\tG\t50\tPASS\tAF=0.25\tGT\t0/1
chr1\t200\t.\tC\tT\t60\tPASS\tAF=0.10\tGT\t1/1
chr2\t350\t.\tATG\tA\t40\tPASS\tAF=0.05\tGT\t0/1
`

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

function approx(a, b, tol = 1e-4) {
  return Math.abs(a - b) < tol
}

// ── FASTA tests ────────────────────────────────────────────────────────────────

console.log('\n── extractFastaFeatures ──────────────────────────────────────────')
const fa = extractFastaFeatures(FASTA)
console.log('\nRaw output:')
console.log(JSON.stringify(fa, null, 2))

console.log('\nChecks:')

// Presence
check('A_count present',         'A_count' in fa)
check('GC_content present',      'GC_content' in fa)
check('shannon_entropy present', 'shannon_entropy' in fa)
check('sequence_count = 2',      fa.sequence_count === 2)

// Nucleotide counts add up to total
const nucleotideSum = fa.A_count + fa.T_count + fa.G_count + fa.C_count + fa.N_count
check('nucleotide counts sum to sequence_length', nucleotideSum === fa.sequence_length,
  `${nucleotideSum} vs ${fa.sequence_length}`)

// GC_content + AT_content ≈ 1 − N_ratio
const expectedGcAt = approx(fa.GC_content + fa.AT_content, 1 - fa.N_ratio, 1e-4)
check('GC_content + AT_content ≈ 1 − N_ratio', expectedGcAt,
  `GC=${fa.GC_content} AT=${fa.AT_content} N_ratio=${fa.N_ratio}`)

// Shannon entropy: counter has 5 buckets (A,T,G,C,N) → max is log2(5) ≈ 2.322
check('shannon_entropy in [0, log2(5)]',
  fa.shannon_entropy >= 0 && fa.shannon_entropy <= Math.log2(5),
  `got ${fa.shannon_entropy}`)

// K=2 keys: exactly 16
const k2keys = Object.keys(fa).filter(k => k.startsWith('kmer_2_'))
check('16 k=2 keys present', k2keys.length === 16, `got ${k2keys.length}`)

// K=3 keys: exactly 64
const k3keys = Object.keys(fa).filter(k => k.startsWith('kmer_3_'))
check('64 k=3 keys present', k3keys.length === 64, `got ${k3keys.length}`)

// K=2 frequencies sum to ~1
const k2sum = k2keys.reduce((s, k) => s + fa[k], 0)
check('k=2 frequencies sum to ~1.0', approx(k2sum, 1.0, 1e-3), `got ${k2sum.toFixed(6)}`)

// K=3 frequencies sum to ~1
const k3sum = k3keys.reduce((s, k) => s + fa[k], 0)
check('k=3 frequencies sum to ~1.0', approx(k3sum, 1.0, 1e-3), `got ${k3sum.toFixed(6)}`)

// ── VCF tests ─────────────────────────────────────────────────────────────────

console.log('\n── extractVcfFeatures ───────────────────────────────────────────')
const vcf = extractVcfFeatures(VCF)
console.log('\nRaw output:')
console.log(JSON.stringify(vcf, null, 2))

console.log('\nChecks:')

check('total_variants = 3',      vcf.total_variants === 3,      `got ${vcf.total_variants}`)
check('snp_count = 2',           vcf.snp_count === 2,           `got ${vcf.snp_count}`)
check('indel_count = 1',         vcf.indel_count === 1,         `got ${vcf.indel_count}`)
check('snp_ratio ≈ 0.666667',    approx(vcf.snp_ratio, 2/3),    `got ${vcf.snp_ratio}`)

// Both chr1 SNPs are transitions (A→G and C→T)
check('ts_count = 2',            vcf.ts_count === 2,            `got ${vcf.ts_count}`)
check('tv_count = 0',            vcf.tv_count === 0,            `got ${vcf.tv_count}`)

// Zygosity: chr1@100=het, chr1@200=hom, chr2@350=het
check('het_count = 2',           vcf.het_count === 2,           `got ${vcf.het_count}`)
check('hom_count = 1',           vcf.hom_count === 1,           `got ${vcf.hom_count}`)

// Allele frequencies: 0.25, 0.10, 0.05 → mean=0.1333
check('allele_freq_mean ≈ 0.1333', approx(vcf.allele_freq_mean, (0.25+0.10+0.05)/3, 1e-4),
  `got ${vcf.allele_freq_mean}`)
check('allele_freq_min = 0.05',  approx(vcf.allele_freq_min, 0.05), `got ${vcf.allele_freq_min}`)
check('allele_freq_max = 0.25',  approx(vcf.allele_freq_max, 0.25), `got ${vcf.allele_freq_max}`)

check('chromosome_count = 2',   vcf.chromosome_count === 2,    `got ${vcf.chromosome_count}`)

// Dynamic per-chromosome keys
check('chr1 variant_count = 2', vcf['chr_1_variant_count'] === 2, `got ${vcf['chr_1_variant_count']}`)
check('chr1 snp_count = 2',     vcf['chr_1_snp_count'] === 2,     `got ${vcf['chr_1_snp_count']}`)
check('chr1 indel_count = 0',   vcf['chr_1_indel_count'] === 0,   `got ${vcf['chr_1_indel_count']}`)
check('chr2 variant_count = 1', vcf['chr_2_variant_count'] === 1, `got ${vcf['chr_2_variant_count']}`)
check('chr2 indel_count = 1',   vcf['chr_2_indel_count'] === 1,   `got ${vcf['chr_2_indel_count']}`)

// ── extractFeatures (sparse) ──────────────────────────────────────────────────

console.log('\n── extractFeatures (sparse dispatcher) ──────────────────────────')
const sparse = extractFeatures(FASTA, 'fasta')
const zeroValues = Object.values(sparse).filter(v => v === 0 || v === 0.0)
check('no zero values in sparse output', zeroValues.length === 0,
  `found ${zeroValues.length} zeros`)
check('returns subset of full features',
  Object.keys(sparse).length <= Object.keys(fa).length)

// ── buildFullSchema ───────────────────────────────────────────────────────────

console.log('\n── buildFullSchema ───────────────────────────────────────────────')
const faSchema  = buildFullSchema('fasta', sparse)
const vcfSchema = buildFullSchema('vcf', extractFeatures(VCF, 'vcf'))

check('FASTA schema has all_features array',   Array.isArray(faSchema.all_features))
check('FASTA schema has active_features array', Array.isArray(faSchema.active_features))
check('FASTA all_features count = 11 + 16 + 64 = 91',
  faSchema.all_features.length === 91, `got ${faSchema.all_features.length}`)
check('VCF schema static feats include chromosome_count',
  vcfSchema.all_features.includes('chromosome_count'))
check('VCF dynamic per-chrom keys present in all_features',
  vcfSchema.all_features.includes('chr_1_variant_count'))
check('active_features are a subset of all_features',
  faSchema.active_features.every(k => faSchema.all_features.includes(k)))

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(55)}`)
console.log(`  ${passed} passed  |  ${failed} failed`)
console.log('─'.repeat(55))
if (failed > 0) process.exit(1)
