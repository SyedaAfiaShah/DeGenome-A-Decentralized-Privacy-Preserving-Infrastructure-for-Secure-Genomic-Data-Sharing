INSTITUTIONAL_DOMAINS = {
    # Generic academic TLDs
    ".edu", ".ac.uk", ".ac.in", ".ac.jp", ".ac.za", ".ac.nz", ".ac.kr",
    ".edu.au", ".edu.pk", ".edu.cn", ".edu.br", ".edu.mx",
    # Public research institutions
    "nih.gov", "who.int", "cdc.gov", "ebi.ac.uk", "sanger.ac.uk",
    "broadinstitute.org", "wellcome.org", "embl.org", "ncbi.nlm.nih.gov",
    "genome.gov", "cancer.gov", "nist.gov", "nasa.gov",
    # Major research universities (explicit)
    "mit.edu", "stanford.edu", "harvard.edu", "ox.ac.uk", "cam.ac.uk",
    "ethz.ch", "epfl.ch", "tum.de", "imperial.ac.uk", "ucl.ac.uk",
}


def is_institutional_email(email: str) -> bool:
    """
    Returns True if the email domain matches a known academic or
    research institution. Case insensitive.
    """
    email = email.lower().strip()
    domain = email.split("@")[-1] if "@" in email else ""
    if not domain:
        return False

    if domain in INSTITUTIONAL_DOMAINS:
        return True

    for inst_domain in INSTITUTIONAL_DOMAINS:
        if inst_domain.startswith(".") and domain.endswith(inst_domain):
            return True

    return False
