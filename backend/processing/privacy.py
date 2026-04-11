"""
Differential Privacy Layer
Applies Laplace noise to feature vectors before storage.
epsilon = 1.0 (default) satisfies epsilon-differential privacy.
"""
import numpy as np
from typing import Union

# Sensitivity per feature type — how much a single record can change this value
_SENSITIVITY_MAP = {
    # Count features: adding one sequence changes count by at most 1
    "_count":   1.0,
    # Ratio features: bounded in [0,1] so sensitivity is 1
    "_content": 1.0,
    "_ratio":   1.0,
    "_entropy": 1.0,
    # K-mer frequencies: bounded [0,1]
    "kmer_":    1.0,
    # VCF totals: adding one variant changes by 1
    "total_":   1.0,
    "snp_":     1.0,
    "indel_":   1.0,
    "ts_":      1.0,
    "tv_":      1.0,
    "het_":     1.0,
    "hom_":     1.0,
    "chr_":     1.0,
    # Stats
    "allele_freq_": 1.0,
    "sequence_length": 10.0,   # larger scale for sequence length
}

DEFAULT_EPSILON = 1.0


def _sensitivity(feature_name: str) -> float:
    for prefix, s in _SENSITIVITY_MAP.items():
        if prefix in feature_name:
            return s
    return 1.0


def add_laplace_noise(
    features: dict,
    epsilon: float = DEFAULT_EPSILON,
    seed: int | None = None
) -> dict:
    """
    Add calibrated Laplace noise to all numeric features.
    Non-numeric features (e.g. string labels) are passed through unchanged.
    Counts are clipped to >= 0. Ratios are clipped to [0, 1].
    """
    rng    = np.random.default_rng(seed)
    noised = {}

    for name, value in features.items():
        if not isinstance(value, (int, float)):
            noised[name] = value
            continue

        scale  = _sensitivity(name) / epsilon
        noise  = rng.laplace(0, scale)
        result = value + noise

        # Clip based on feature type
        if any(r in name for r in ["_ratio", "_content", "kmer_", "_entropy", "allele_freq_"]):
            result = float(np.clip(result, 0.0, 1.0))
        elif any(c in name for c in ["_count", "total_", "sequence_length", "chromosome_count"]):
            result = max(0.0, result)

        noised[name] = round(result, 6)

    return noised


def strip_zeros(features: dict) -> dict:
    """Remove zero-valued features for sparse representation."""
    return {k: v for k, v in features.items() if v != 0 and v != 0.0}
