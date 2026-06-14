"""End-to-end orchestrator.

1. Reproduce/validate each source against its own paper.
2. Swap the three updated leaf estimates (terrestrial arthropods <- Rosenberg,
   wild mammals <- Greenspoon, nematodes <- van den Hoogen) into Bar-On's
   global-biomass aggregation and recompute the global total.
3. Assemble the biome x taxon matrix (biome-resolved where available, global
   otherwise) and write all outputs to ``results/``.

Run:  uv run python -m integrated_biomass.run
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from . import adapter_baron as B
from . import adapter_greenspoon as G
from . import adapter_rosenberg as R
from . import adapter_vandenhoogen as V
from . import schema
from .repro_rosenberg import PROJECT_ROOT

RESULTS = PROJECT_ROOT / "results"

# Bar-On leaf rows replaced, and the adapter supplying each updated value.
SWAP_SOURCES = {
    ("Animals", "Terrestrial arthropods"): R,
    ("Animals", "Wild mammals"): G,
    ("Animals", "Nematodes"): V,
}


def _fmt(x: float, n: int = 4) -> str:
    return f"{x:.{n}f}" if x == x else "n/a"


def build_swaps() -> dict[tuple[str, str], dict]:
    return {row: mod.global_total_gtc() for row, mod in SWAP_SOURCES.items()}


def validate(swaps: dict) -> pd.DataFrame:
    """Per-source validation: updated value vs the Bar-On value it replaces."""
    ref = B.reference_table()
    recs = []
    for (kingdom, taxon), new in swaps.items():
        old = float(ref.loc[(kingdom, taxon), "Biomass [Gt C]"])
        recs.append({
            "taxon": taxon,
            "baron_gtc": old,
            "updated_gtc": new["best_gtc"],
            "ratio": new["best_gtc"] / old if old else float("nan"),
            "source": SWAP_SOURCES[(kingdom, taxon)].SOURCE,
        })
    return pd.DataFrame(recs)


def biome_taxon_matrix(swaps: dict) -> pd.DataFrame:
    rows: list[dict] = []
    rows += R.biome_taxon_rows()          # terrestrial arthropods (group grain)
    rows += V.biome_taxon_rows()          # nematodes (fine grain)
    rows += G.biome_taxon_rows()          # wild mammals (fine + global marine)
    rows += B.global_only_rows(swaps)     # all remaining Bar-On taxa (global)
    return schema.frame(rows)


def main() -> int:
    RESULTS.mkdir(exist_ok=True)
    swaps = build_swaps()

    # --- Validation -------------------------------------------------------
    published = B.published_global_total()
    no_swap = B.recompute_global_total({})["total_gtc"]
    print("=" * 64)
    print("VALIDATION")
    print("=" * 64)
    print(f"Bar-On published global total : {published:8.1f} Gt C")
    print(f"Recomputed (no swaps)         : {no_swap:8.1f} Gt C   "
          f"[{'MATCH' if abs(published - no_swap) < 0.05 else 'MISMATCH'}]")
    vdf = validate(swaps)
    print("\nUpdated leaf estimates vs Bar-On (Gt C):")
    for _, r in vdf.iterrows():
        print(f"  {r['taxon']:24s} Bar-On {_fmt(r['baron_gtc'])}  ->  "
              f"{r['source']:16s} {_fmt(r['updated_gtc'])}  ({r['ratio']:.2f}x)")

    # --- Recomputed global total -----------------------------------------
    swap_arg = {k: {"best_gtc": v["best_gtc"], "uncertainty": v.get("uncertainty", float("nan"))}
                for k, v in swaps.items()}
    res = B.recompute_global_total(swap_arg)
    print("\n" + "=" * 64)
    print("INTEGRATED GLOBAL TOTAL")
    print("=" * 64)
    print(f"Global biomass (3 swaps)      : {res['total_gtc']:8.1f} Gt C  "
          f"(was {published:.1f})")
    print(f"Propagated uncertainty        : {res['global_uncertainty']:.3f}-fold")

    # --- Biome x taxon matrix --------------------------------------------
    mat = biome_taxon_matrix(swaps)
    biome_resolved = mat[mat["resolution"] != "global"]
    print("\n" + "=" * 64)
    print("BIOME x TAXON MATRIX")
    print("=" * 64)
    print(f"rows: {len(mat)}  |  biome-resolved: {len(biome_resolved)}  "
          f"|  global-only: {len(mat) - len(biome_resolved)}")
    pivot = (biome_resolved.groupby(["biome_group", "taxon"])["biomass_gC"].sum()
             .unstack(fill_value=0) / schema.GT_C)
    print("\nBiome-resolved biomass by group x taxon (Gt C):")
    print(pivot.round(4).to_string())

    # --- Write outputs ----------------------------------------------------
    vdf.to_csv(RESULTS / "validation.csv", index=False)
    mat.to_csv(RESULTS / "biome_taxon_matrix.csv", index=False)
    res["table"].to_csv(RESULTS / "global_total_recomputed.csv")
    pivot.to_csv(RESULTS / "biome_group_by_taxon_gtc.csv")
    pd.DataFrame([{
        "published_gtc": published,
        "recomputed_no_swap_gtc": no_swap,
        "integrated_gtc": res["total_gtc"],
        "integrated_uncertainty": res["global_uncertainty"],
    }]).to_csv(RESULTS / "summary.csv", index=False)
    print(f"\nOutputs written to {RESULTS}/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
