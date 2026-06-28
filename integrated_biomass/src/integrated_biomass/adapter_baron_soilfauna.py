"""Bar-On soil-fauna adapter: annelids + terrestrial protists, per biome.

Reads the validated per-biome reconstructions from ``custom_baron_soil_fauna/``
(run lazily if their outputs are missing), crosswalks the biome labels onto the
canonical scheme, and rescales each taxon's vector to the *exact* Bar-On leaf
total so the matrix still conserves mass to the recomputed global total.

These are option-B reconstructions: faithful per-biome *shape*, total pinned to
Bar-On's published value (annelids reconstruct a notebook whose scenario
variables were undefined; protists reproduce the full computation, validated to
1.6055 Gt C). See custom_baron_soil_fauna/ for the standalone, validated scripts.
"""

from __future__ import annotations

import subprocess
import sys

import pandas as pd

from . import biomes, schema
from .adapter_baron import reference_table
from .repro_rosenberg import PROJECT_ROOT, REPO_ROOT

SOURCE = "baron2018-custom"
CUSTOM_DIR = REPO_ROOT / "custom_baron_soil_fauna"
ANNELID_CSV = CUSTOM_DIR / "output" / "annelid_biome_biomass.csv"
PROTIST_CSV = CUSTOM_DIR / "output" / "protist_biome_biomass.csv"


def _ensure(csv_path, script: str) -> None:
    if csv_path.is_file():
        return
    print(f"[soilfauna] {csv_path.name} missing -> running {script}", file=sys.stderr)
    subprocess.run(
        ["uv", "run", "--project", str(PROJECT_ROOT), "python", str(CUSTOM_DIR / script)],
        check=True, cwd=CUSTOM_DIR,
    )


def _leaf_total_gtc(taxon: str) -> float:
    t = reference_table()
    return float(t.loc[("Animals" if taxon == "Annelids" else "Protists",
                        taxon if taxon == "Annelids" else "Terrestrial"),
                       "Biomass [Gt C]"])


def _rows(csv_path, script, taxon, xwalk, leaf_key) -> list[dict]:
    _ensure(csv_path, script)
    df = pd.read_csv(csv_path)
    # Pin the vector to the exact Bar-On leaf total (conserves matrix mass).
    target_gc = _leaf_total_gtc(leaf_key) * schema.GT_C
    df["biomass_gC"] *= target_gc / df["biomass_gC"].sum()

    rows: list[dict] = []
    for _, r in df.iterrows():
        fine, group = biomes.normalize(xwalk, r["Biome"])
        rows.append(schema.row(
            taxon=taxon, realm="land", biome=fine, biome_group=group,
            biomass_gC=float(r["biomass_gC"]),
            count=float(r["count"]) if "count" in df.columns else float("nan"),
            source=SOURCE, resolution="fine" if fine else "group",
        ))
    return rows


def biome_taxon_rows() -> list[dict]:
    return (
        _rows(ANNELID_CSV, "reproduce_annelids.py", "Annelids", "baron_annelid", "Annelids")
        + _rows(PROTIST_CSV, "reproduce_protists.py", "Protists (terrestrial)", "baron_protist", "Terrestrial")
    )


__all__ = ["biome_taxon_rows", "SOURCE"]
