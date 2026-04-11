"""
Feature Extraction Pipeline
Converts raw FASTA / VCF input into structured, ML-ready feature vectors.
Raw sequences are never stored or returned — only derived statistics.
"""
from itertools import product
from collections import Counter
from typing import IO
import re, math


# ── FASTA ──────────────────────────────────────────────────────────────────────

def extract_fasta_features(content: str) -> dict:
    """
    Extract all features from a FASTA file string.
    Handles multi-sequence FASTA by aggregating across all sequences.
    """
    sequences = _parse_fasta(content)
    if not sequences:
        raise ValueError("No valid sequences found in FASTA file")

    combined = "".join(sequences).upper()
    features = {}

    # Basic nucleotide counts
    counter = Counter(combined)
    total   = len(combined)
    for base in ["A", "T", "G", "C", "N"]:
        features[f"{base}_count"] = counter.get(base, 0)

    features["sequence_length"]  = total
    features["sequence_count"]   = len(sequences)

    gc = features["G_count"] + features["C_count"]
    features["GC_content"]       = round(gc / total, 6) if total > 0 else 0.0
    features["AT_content"]       = round((features["A_count"] + features["T_count"]) / total, 6) if total > 0 else 0.0
    features["N_ratio"]          = round(features["N_count"] / total, 6) if total > 0 else 0.0

    # Sequence complexity (Shannon entropy over nucleotides)
    features["shannon_entropy"]  = round(_shannon_entropy(counter, total), 6)

    # K-mer frequencies (k=2 and k=3 only — k>=4 risks reconstruction)
    clean = re.sub(r'[^ATGC]', '', combined)
    for k in [2, 3]:
        kmers = _extract_kmers(clean, k)
        features.update(kmers)

    return features


def _parse_fasta(content: str) -> list[str]:
    sequences = []
    current   = []
    for line in content.splitlines():
        line = line.strip()
        if not line:
            continue
        if line.startswith(">"):
            if current:
                sequences.append("".join(current))
                current = []
        else:
            current.append(line)
    if current:
        sequences.append("".join(current))
    return sequences


def _extract_kmers(sequence: str, k: int) -> dict:
    """Generate frequency counts for all k-mers of length k."""
    if len(sequence) < k:
        return {}
    # All possible k-mers for the alphabet
    alphabet = ["A", "T", "G", "C"]
    all_kmers = {"".join(p): 0 for p in product(alphabet, repeat=k)}
    total     = len(sequence) - k + 1
    for i in range(total):
        kmer = sequence[i:i+k]
        if kmer in all_kmers:
            all_kmers[kmer] += 1
    # Return as frequency ratios, not raw counts (less sensitive)
    return {f"kmer_{k}_{kmer}": round(count / total, 6) if total > 0 else 0.0
            for kmer, count in all_kmers.items()}


def _shannon_entropy(counter: Counter, total: int) -> float:
    if total == 0:
        return 0.0
    entropy = 0.0
    for count in counter.values():
        if count > 0:
            p = count / total
            entropy -= p * math.log2(p)
    return entropy


# ── VCF ────────────────────────────────────────────────────────────────────────

def extract_vcf_features(content: str) -> dict:
    """
    Extract features from a VCF file string.
    Returns global stats + per-chromosome dynamic features.
    """
    records = _parse_vcf(content)
    if not records:
        raise ValueError("No valid variant records found in VCF file")

    features = {}
    total = len(records)
    features["total_variants"] = total

    # Classify variants
    snps    = [r for r in records if _is_snp(r)]
    indels  = [r for r in records if _is_indel(r)]
    features["snp_count"]   = len(snps)
    features["indel_count"] = len(indels)
    features["snp_ratio"]   = round(len(snps) / total, 6) if total > 0 else 0.0

    # Transition / transversion ratio
    ts = sum(1 for r in snps if _is_transition(r))
    tv = sum(1 for r in snps if not _is_transition(r))
    features["ts_count"]    = ts
    features["tv_count"]    = tv
    features["ts_tv_ratio"] = round(ts / tv, 6) if tv > 0 else 0.0

    # Zygosity
    hets  = [r for r in records if r.get("zygosity") == "het"]
    homs  = [r for r in records if r.get("zygosity") == "hom"]
    features["het_count"]  = len(hets)
    features["hom_count"]  = len(homs)
    features["het_ratio"]  = round(len(hets) / total, 6) if total > 0 else 0.0

    # Allele frequency stats (from AF INFO field if present)
    afs = [r["af"] for r in records if r.get("af") is not None]
    if afs:
        features["allele_freq_mean"] = round(sum(afs) / len(afs), 6)
        features["allele_freq_std"]  = round(_std(afs), 6)
        features["allele_freq_min"]  = round(min(afs), 6)
        features["allele_freq_max"]  = round(max(afs), 6)

    # Per-chromosome dynamic features
    by_chrom = {}
    for r in records:
        chrom = r["chrom"]
        by_chrom.setdefault(chrom, []).append(r)

    features["chromosome_count"] = len(by_chrom)
    for chrom, variants in sorted(by_chrom.items()):
        safe = chrom.replace("chr", "").replace(" ", "_")
        features[f"chr_{safe}_variant_count"] = len(variants)
        features[f"chr_{safe}_snp_count"]     = sum(1 for v in variants if _is_snp(v))
        features[f"chr_{safe}_indel_count"]   = sum(1 for v in variants if _is_indel(v))

    return features


def _parse_vcf(content: str) -> list[dict]:
    records = []
    for line in content.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split("\t")
        if len(parts) < 5:
            continue
        chrom, pos, vid, ref, alt_field = parts[0], parts[1], parts[2], parts[3], parts[4]
        alts = alt_field.split(",")
        info = parts[7] if len(parts) > 7 else ""
        fmt  = parts[8] if len(parts) > 8 else ""
        smp  = parts[9] if len(parts) > 9 else ""

        af = _extract_af(info)
        zyg = _extract_zygosity(fmt, smp)

        for alt in alts:
            records.append({
                "chrom": chrom, "pos": pos, "ref": ref, "alt": alt.strip(),
                "af": af, "zygosity": zyg
            })
    return records


def _is_snp(r: dict) -> bool:
    return len(r["ref"]) == 1 and len(r["alt"]) == 1 and r["alt"] not in [".", "*"]

def _is_indel(r: dict) -> bool:
    return not _is_snp(r) and r["alt"] not in [".", "*"]

_TRANSITIONS = {frozenset(["A","G"]), frozenset(["C","T"])}
def _is_transition(r: dict) -> bool:
    return frozenset([r["ref"].upper(), r["alt"].upper()]) in _TRANSITIONS

def _extract_af(info: str) -> float | None:
    for field in info.split(";"):
        if field.startswith("AF="):
            try:
                return float(field.split("=")[1].split(",")[0])
            except:
                return None
    return None

def _extract_zygosity(fmt: str, smp: str) -> str | None:
    if not fmt or not smp:
        return None
    fields = fmt.split(":")
    values = smp.split(":")
    if "GT" not in fields:
        return None
    gt = values[fields.index("GT")]
    alleles = re.split(r'[/|]', gt)
    if len(alleles) < 2:
        return None
    return "hom" if alleles[0] == alleles[1] else "het"

def _std(values: list) -> float:
    if len(values) < 2:
        return 0.0
    mean = sum(values) / len(values)
    return math.sqrt(sum((x - mean) ** 2 for x in values) / len(values))


# ── DISPATCHER ─────────────────────────────────────────────────────────────────

def extract_features(content: str, format_type: str) -> dict:
    """Main entry point. Returns sparse feature dict (no zero values)."""
    if format_type == "fasta":
        raw = extract_fasta_features(content)
    elif format_type == "vcf":
        raw = extract_vcf_features(content)
    else:
        raise ValueError(f"Unsupported format: {format_type}")
    # Return only non-zero features
    return {k: v for k, v in raw.items() if v != 0 and v != 0.0}


def build_full_schema(format_type: str, extracted: dict) -> dict:
    """
    Returns:
    - all_features: complete list of feature names for this format
    - active_features: names with non-zero values
    """
    if format_type == "fasta":
        alphabet = ["A", "T", "G", "C"]
        all_feats = (
            ["A_count","T_count","G_count","C_count","N_count",
             "sequence_length","sequence_count","GC_content","AT_content",
             "N_ratio","shannon_entropy"] +
            [f"kmer_2_{''.join(p)}" for p in product(alphabet, repeat=2)] +
            [f"kmer_3_{''.join(p)}" for p in product(alphabet, repeat=3)]
        )
        # Add any dynamic keys from extraction not in static list
        for k in extracted:
            if k not in all_feats:
                all_feats.append(k)
    else:
        # VCF schema includes static globals + dynamic per-chromosome keys
        static = ["total_variants","snp_count","indel_count","snp_ratio",
                  "ts_count","tv_count","ts_tv_ratio","het_count","hom_count",
                  "het_ratio","allele_freq_mean","allele_freq_std",
                  "allele_freq_min","allele_freq_max","chromosome_count"]
        dynamic = [k for k in extracted if k not in static]
        all_feats = static + sorted(dynamic)

    return {
        "all_features":    all_feats,
        "active_features": list(extracted.keys())
    }
