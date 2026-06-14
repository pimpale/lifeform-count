"""Bootstrap the external spatial datasets needed for the biome x taxon analysis.

Two layers are required:

1. IUCN terrestrial mammal ranges (``MAMMALS_TERRESTRIAL_ONLY``).
   This is behind a (free) IUCN Red List account and *cannot* be downloaded
   automatically. You must request it from
   https://www.iucnredlist.org/resources/spatial-data-download
   and drop the resulting ``MAMMALS_TERRESTRIAL_ONLY.zip`` into the dropzone
   directory printed below. This script will then unzip it for you.

2. WWF Terrestrial Ecoregions of the World (Olson et al. 2001).
   This is freely available, so the script downloads and unzips it for you.
   It is the canonical biome layer that every source is crosswalked onto.

The script is deliberately stdlib-only so it can run *before* the heavy
geospatial environment (geopandas/rasterio) is installed.

Usage:
    python -m integrated_biomass.bootstrap_data
    python -m integrated_biomass.bootstrap_data --check   # only verify, never fetch
"""

from __future__ import annotations

import argparse
import sys
import urllib.request
import zipfile
from pathlib import Path

# --- Paths -----------------------------------------------------------------
# .../integrated_biomass/src/integrated_biomass/bootstrap_data.py
#  -> project root is three parents up.
PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA = PROJECT_ROOT / "data"
DROPZONE = DATA / "dropzone"
RAW = DATA / "raw"
IUCN_DIR = RAW / "iucn_mammals"
WWF_DIR = RAW / "wwf_ecoregions"

IUCN_ZIP_NAME = "MAMMALS_TERRESTRIAL_ONLY.zip"
IUCN_SHP_NAME = "MAMMALS_TERRESTRIAL_ONLY.shp"

# RESOLVE Ecoregions 2017 — the modern, freely-hosted release of the WWF
# Terrestrial Ecoregions of the World. Same 14 WWF biomes (BIOME_NAME /
# BIOME_NUM) that Rosenberg (2023) used, so arthropod and mammal biome
# assignments line up onto the same canonical scheme.
#
# worldwildlife.org 403s all automated requests, so we use the RESOLVE mirror
# on Google Cloud Storage, which serves the same data without authentication.
WWF_URL = "https://storage.googleapis.com/teow2016/Ecoregions2017.zip"
WWF_SHP_NAME = "Ecoregions2017.shp"

# Place the user may have dropped the IUCN zip before we created the dropzone.
_FALLBACK_ZIP_LOCATIONS = [
    DROPZONE / IUCN_ZIP_NAME,
    PROJECT_ROOT / IUCN_ZIP_NAME,
    PROJECT_ROOT.parent / IUCN_ZIP_NAME,  # repo root
]


class BootstrapError(RuntimeError):
    """Raised when a required dataset is missing and cannot be auto-fetched."""


def _find_iucn_zip() -> Path | None:
    for candidate in _FALLBACK_ZIP_LOCATIONS:
        if candidate.is_file():
            return candidate
    return None


def _find_in_tree(root: Path, filename: str) -> Path | None:
    if not root.exists():
        return None
    for path in root.rglob(filename):
        return path
    return None


def ensure_iucn(check_only: bool = False) -> Path:
    """Ensure the IUCN mammal shapefile is extracted; return path to the .shp."""
    existing = _find_in_tree(IUCN_DIR, IUCN_SHP_NAME)
    if existing is not None:
        print(f"[ok]   IUCN mammal ranges already extracted: {existing}")
        return existing

    zip_path = _find_iucn_zip()
    if zip_path is None:
        raise BootstrapError(
            "\n"
            "============================================================\n"
            " MISSING REQUIRED DATASET: IUCN terrestrial mammal ranges\n"
            "============================================================\n"
            f" Expected file: {IUCN_ZIP_NAME}\n"
            f" Drop it here:  {DROPZONE}\n\n"
            " This dataset is behind a free IUCN Red List account and cannot\n"
            " be downloaded automatically. To obtain it:\n"
            "   1. Sign in at https://www.iucnredlist.org/resources/spatial-data-download\n"
            "   2. Under 'Mammals', download MAMMALS_TERRESTRIAL_ONLY\n"
            f"   3. Move the resulting {IUCN_ZIP_NAME} into the dropzone above\n"
            "   4. Re-run this script\n"
            "============================================================\n"
        )

    if check_only:
        raise BootstrapError(
            f"[check] IUCN zip found at {zip_path} but not yet extracted "
            f"(run without --check to extract)."
        )

    print(f"[..]   Extracting IUCN mammal ranges from {zip_path}")
    IUCN_DIR.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path) as zf:
        zf.extractall(IUCN_DIR)
    shp = _find_in_tree(IUCN_DIR, IUCN_SHP_NAME)
    if shp is None:
        raise BootstrapError(
            f"Extracted {zip_path} but could not find {IUCN_SHP_NAME} inside it."
        )
    print(f"[ok]   IUCN mammal ranges extracted: {shp}")
    return shp


def ensure_wwf(check_only: bool = False) -> Path:
    """Ensure the WWF ecoregions shapefile is present; return path to the .shp."""
    existing = _find_in_tree(WWF_DIR, WWF_SHP_NAME)
    if existing is not None:
        print(f"[ok]   WWF ecoregions already present: {existing}")
        return existing

    if check_only:
        raise BootstrapError(
            f"[check] WWF ecoregions missing under {WWF_DIR} "
            f"(run without --check to download)."
        )

    WWF_DIR.mkdir(parents=True, exist_ok=True)
    zip_path = WWF_DIR / "official_teow.zip"
    print(f"[..]   Downloading WWF/RESOLVE ecoregions from {WWF_URL}")
    try:
        req = urllib.request.Request(WWF_URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req) as resp, open(zip_path, "wb") as fh:
            while chunk := resp.read(1 << 20):
                fh.write(chunk)
    except Exception as exc:  # noqa: BLE001 - surface a clear, actionable message
        raise BootstrapError(
            f"Failed to download WWF/RESOLVE ecoregions ({exc}).\n"
            f"Download {WWF_URL} manually (or the WWF TEOW layer from\n"
            f"https://www.worldwildlife.org/publications/terrestrial-ecoregions-of-the-world)\n"
            f"and unzip it into {WWF_DIR} (so that {WWF_SHP_NAME} exists there)."
        ) from exc

    print(f"[..]   Extracting {zip_path}")
    with zipfile.ZipFile(zip_path) as zf:
        zf.extractall(WWF_DIR)
    shp = _find_in_tree(WWF_DIR, WWF_SHP_NAME)
    if shp is None:
        raise BootstrapError(
            f"Downloaded WWF bundle but could not find {WWF_SHP_NAME} inside it."
        )
    print(f"[ok]   WWF ecoregions extracted: {shp}")
    return shp


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="Verify datasets are present; never download or extract.",
    )
    args = parser.parse_args(argv)

    DROPZONE.mkdir(parents=True, exist_ok=True)
    RAW.mkdir(parents=True, exist_ok=True)

    try:
        iucn = ensure_iucn(check_only=args.check)
        wwf = ensure_wwf(check_only=args.check)
    except BootstrapError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    print("\n[done] All spatial datasets ready:")
    print(f"        IUCN mammals : {iucn}")
    print(f"        WWF biomes   : {wwf}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
