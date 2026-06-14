"""Lazily reproduce Rosenberg (2023) biome x taxon tables, then cache them.

Rosenberg's per-biome arthropod biomass/population are outputs of a heavy
Monte-Carlo notebook that is *not* committed and uses pandas<2 idioms. We run
the original notebook once, unmodified except for an export cell, inside a
pinned legacy environment, and cache the resulting CSVs. Subsequent calls just
read the cache. If the cache is missing, it is regenerated on demand.

The cached tables (dry biomass in Mt; population in individuals):
    soil_biome_taxon_mass_Mt.csv   aggregated taxon x aggregated biome
    aboveground_biome_mass_Mt.csv  aggregated biome (taxon = "Combined")
    soil_biome_taxon_pop.csv       aggregated taxon x aggregated biome
    aboveground_biome_pop.csv      aggregated biome (taxon = "Combined")
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = PROJECT_ROOT.parent
ROSENBERG_DIR = REPO_ROOT / "rosenberg2023_biomass_terrestrial_arthropods"
NOTEBOOK = ROSENBERG_DIR / "01-Main-Estimate_global_biomass_and_numbers.ipynb"
CACHE_DIR = PROJECT_ROOT / "data" / "cache" / "rosenberg"
EXECUTOR = Path(__file__).resolve().parent / "_rosenberg_nb_exec.py"

CACHE_FILES = [
    "soil_biome_taxon_mass_Mt.csv",
    "aboveground_biome_mass_Mt.csv",
    "soil_biome_taxon_pop.csv",
    "aboveground_biome_pop.csv",
]

# Pinned legacy stack: pandas<2 (DataFrame.append, tuple groupby still work).
LEGACY_DEPS = [
    "pandas==1.5.3",
    "numpy==1.24.4",
    "scipy==1.10.1",
    "seaborn==0.12.2",
    "matplotlib==3.7.5",
    "openpyxl==3.1.5",
    "xlrd==2.0.1",
]

# Published bootstrap sample counts (the notebook's own defaults).
FULL_N = 100_000
# Fast preview counts — for validating the pipeline, NOT for real numbers.
FAST_N = 300


def _cache_complete() -> bool:
    return all((CACHE_DIR / f).is_file() for f in CACHE_FILES)


def ensure_tables(fast: bool = False, force: bool = False) -> Path:
    """Ensure the cached Rosenberg tables exist; regenerate if missing.

    Returns the cache directory. Set ``fast=True`` to run a low-sample preview
    (pipeline validation only). ``force=True`` always re-runs.
    """
    if _cache_complete() and not force:
        return CACHE_DIR

    if not NOTEBOOK.is_file():
        raise FileNotFoundError(f"Rosenberg notebook not found: {NOTEBOOK}")

    n = FAST_N if fast else FULL_N
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    deps = []
    for d in LEGACY_DEPS:
        deps += ["--with", d]
    cmd = [
        "uv", "run", "--no-project", "--python", "3.11", *deps,
        "python", str(EXECUTOR), str(NOTEBOOK), str(CACHE_DIR), str(n), str(n),
    ]
    label = "fast preview" if fast else "full Monte-Carlo"
    print(f"[repro] Rosenberg cache missing -> running notebook ({label}, N={n})",
          file=sys.stderr)
    print(f"[repro] {' '.join(cmd)}", file=sys.stderr)
    subprocess.run(cmd, check=True, cwd=PROJECT_ROOT)

    if not _cache_complete():
        missing = [f for f in CACHE_FILES if not (CACHE_DIR / f).is_file()]
        raise RuntimeError(f"Rosenberg run finished but cache incomplete: {missing}")
    return CACHE_DIR


if __name__ == "__main__":
    import argparse

    ap = argparse.ArgumentParser(description="Reproduce/cache Rosenberg biome tables.")
    ap.add_argument("--fast", action="store_true", help="low-sample preview run")
    ap.add_argument("--force", action="store_true", help="re-run even if cached")
    args = ap.parse_args()
    out = ensure_tables(fast=args.fast, force=args.force)
    print("Rosenberg tables ready in", out)
    for f in CACHE_FILES:
        print("  ", f)
