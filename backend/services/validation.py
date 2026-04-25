"""
Feature vector plausibility validation.
Checks that uploaded feature vectors fall within biologically reasonable ranges.
Raw files never reach the server -- only the DP-noised feature vectors are checked.
"""

FASTA_RULES = {
    "GC_content":      (0.15, 0.85),   # real genomes: 20-80%, allow some DP noise margin
    "AT_content":      (0.15, 0.85),
    "shannon_entropy": (0.5, None),     # must be above minimum -- pure repetition scores near 0
    "sequence_length": (50, None),      # must have meaningful length
    "sequence_count":  (0, None),       # non-negative
    "N_ratio":         (0.0, 0.90),     # cannot be almost entirely unknown bases
}

VCF_RULES = {
    "ts_tv_ratio":     (0.5, 10.0),    # real human data: ~2.0-3.0, allow wide margin
    "snp_count":       (0, None),      # non-negative
    "indel_count":     (0, None),
    "het_hom_ratio":   (0.0, 20.0),    # must be in plausible range
}

def validate_feature_vector(feature_vector: dict, format_type: str) -> tuple[bool, str]:
    """
    Returns (is_valid, error_message).
    If valid, error_message is empty string.
    Validation is intentionally lenient to avoid false positives from DP noise.
    """
    if not feature_vector:
        return False, "Feature vector is empty."
    
    rules = FASTA_RULES if format_type == "fasta" else VCF_RULES
    
    for feature_name, (min_val, max_val) in rules.items():
        if feature_name not in feature_vector:
            continue  # skip missing features -- may be absent due to file format variant
        
        value = feature_vector[feature_name]
        
        if value is None:
            continue
            
        if min_val is not None and value < min_val:
            return False, (
                f"Dataset rejected: '{feature_name}' value {value:.4f} is below the "
                f"minimum plausible value ({min_val}) for {format_type.upper()} data. "
                f"Please upload a valid genomic file."
            )
        
        if max_val is not None and value > max_val:
            return False, (
                f"Dataset rejected: '{feature_name}' value {value:.4f} is above the "
                f"maximum plausible value ({max_val}) for {format_type.upper()} data. "
                f"Please upload a valid genomic file."
            )
    
    return True, ""
