"""Canonical biome scheme and per-source crosswalks.

Every source is harmonized onto the **WWF / RESOLVE** terrestrial biome scheme,
because that is the finest scheme shared by the spatial sources (RESOLVE
Ecoregions 2017 for mammals, and van den Hoogen 2019 for nematodes both use it).

Two grains are defined:

* **fine** (16 canonical biomes): the 14 WWF biomes (``BIOME_NUM`` 1..14) plus
  two land-use classes, ``Croplands`` and ``Pasture``. Per the project decision,
  Crops/Pasture are kept as *separate* rows (only Rosenberg populates them).

* **group** (~10 aggregated biomes): the grain Rosenberg reports at, and the
  grain at which *every* terrestrial-fauna source can be compared. Each fine
  biome rolls up into exactly one group.

Finer sources (van den Hoogen, IUCN-mammals) resolve to a fine biome; coarser
sources (Rosenberg aggregated, Bar-On Fierer tables) resolve to a group. The
long-format table carries both ``biome`` (fine, may be None for group-only
rows) and ``biome_group`` (always set), so reports can roll up cleanly.
"""

from __future__ import annotations

# --- Fine canonical biomes: 14 WWF + 2 land-use ---------------------------
# name -> WWF BIOME_NUM (land-use classes use string codes)
FINE_BIOMES: dict[str, object] = {
    "Tropical & Subtropical Moist Broadleaf Forests": 1,
    "Tropical & Subtropical Dry Broadleaf Forests": 2,
    "Tropical & Subtropical Coniferous Forests": 3,
    "Temperate Broadleaf & Mixed Forests": 4,
    "Temperate Conifer Forests": 5,
    "Boreal Forests/Taiga": 6,
    "Tropical & Subtropical Grasslands, Savannas & Shrublands": 7,
    "Temperate Grasslands, Savannas & Shrublands": 8,
    "Flooded Grasslands & Savannas": 9,
    "Montane Grasslands & Shrublands": 10,
    "Tundra": 11,
    "Mediterranean Forests, Woodlands & Scrub": 12,
    "Deserts & Xeric Shrublands": 13,
    "Mangroves": 14,
    "Croplands": "C",
    "Pasture": "P",
}

# --- Aggregated groups (Rosenberg grain): fine biome name -> group --------
FINE_TO_GROUP: dict[str, str] = {
    "Tropical & Subtropical Moist Broadleaf Forests": "Tropical & Subtropical Forests",
    "Tropical & Subtropical Dry Broadleaf Forests": "Tropical & Subtropical Forests",
    "Tropical & Subtropical Coniferous Forests": "Tropical & Subtropical Forests",
    "Temperate Broadleaf & Mixed Forests": "Temperate Forests",
    "Temperate Conifer Forests": "Temperate Forests",
    "Boreal Forests/Taiga": "Boreal Forests/Taiga",
    "Tropical & Subtropical Grasslands, Savannas & Shrublands": "Tropical & Subtropical Grasslands, Savannas & Shrublands",
    "Temperate Grasslands, Savannas & Shrublands": "Temperate Grasslands, Savannas & Shrublands",
    "Flooded Grasslands & Savannas": "Flooded Grasslands & Savannas",
    "Montane Grasslands & Shrublands": "Temperate Grasslands, Savannas & Shrublands",
    "Tundra": "Tundra",
    "Mediterranean Forests, Woodlands & Scrub": "Mediterranean Forests, Woodlands & Scrub",
    "Deserts & Xeric Shrublands": "Deserts & Xeric Shrublands",
    "Mangroves": "Mangroves",
    "Croplands": "Croplands",
    "Pasture": "Pasture",
}

# WWF BIOME_NUM -> fine biome name (for joining the RESOLVE shapefile).
BIOME_NUM_TO_FINE: dict[int, str] = {
    v: k for k, v in FINE_BIOMES.items() if isinstance(v, int)
}


# --- Per-source crosswalks ------------------------------------------------
# van den Hoogen 2019 Table S7 biome labels -> fine canonical name.
VANDENHOOGEN_TO_FINE: dict[str, str] = {
    "Tropical Moist Forests": "Tropical & Subtropical Moist Broadleaf Forests",
    "Tropical Dry Forest": "Tropical & Subtropical Dry Broadleaf Forests",
    "Tropical Coniferous Forests": "Tropical & Subtropical Coniferous Forests",
    "Temperate Broadleaf Forests": "Temperate Broadleaf & Mixed Forests",
    "Temperate Conifer Forests": "Temperate Conifer Forests",
    "Boreal Forests": "Boreal Forests/Taiga",
    "Tropical Grasslands": "Tropical & Subtropical Grasslands, Savannas & Shrublands",
    "Temperate Grasslands": "Temperate Grasslands, Savannas & Shrublands",
    "Flooded Grasslands": "Flooded Grasslands & Savannas",
    "Montane Grasslands": "Montane Grasslands & Shrublands",
    "Tundra": "Tundra",
    "Mediterranean Forests": "Mediterranean Forests, Woodlands & Scrub",
    "Deserts": "Deserts & Xeric Shrublands",
    "Mangroves": "Mangroves",
}

# Rosenberg 2023 "aggregated biome" -> group (Rosenberg is already group-grain).
ROSENBERG_TO_GROUP: dict[str, str] = {
    "Tropical and Subtropical Forests": "Tropical & Subtropical Forests",
    "Boreal Forests/Taiga": "Boreal Forests/Taiga",
    "Mediterranean Forests, Woodlands and Scrub": "Mediterranean Forests, Woodlands & Scrub",
    "Temperate Forests": "Temperate Forests",
    "Tropical and Subtropical Grasslands, Savannas and Shrublands": "Tropical & Subtropical Grasslands, Savannas & Shrublands",
    "Temperate Grasslands, Savannas and Shrublands": "Temperate Grasslands, Savannas & Shrublands",
    "Tundra": "Tundra",
    "Deserts and Xeric Shrublands": "Deserts & Xeric Shrublands",
    "Flooded grasslands and savannas": "Flooded Grasslands & Savannas",
    "Crops": "Croplands",
    "Pasture": "Pasture",
    # NOTE: Rosenberg's notebook explicitly drops 'Shrubland/Grassland' (ants
    # with unknown biome); the Rosenberg adapter filters it before normalize().
}

# Bar-On (Fierer-based) annelid biome labels -> fine name where unambiguous,
# else group. Temperate forest is split (deciduous=broadleaf, coniferous);
# "Tropical forest"/"Native tropical savanna" are group-grain.
BARON_ANNELID_TO_FINE: dict[str, str] = {
    "Boreal forests": "Boreal Forests/Taiga",
    "Desert": "Deserts & Xeric Shrublands",
    "Temperate coniferous forest": "Temperate Conifer Forests",
    "Temperate deciduous forest": "Temperate Broadleaf & Mixed Forests",
    "Temperate grassland": "Temperate Grasslands, Savannas & Shrublands",
    "Tropical forest": "Tropical & Subtropical Moist Broadleaf Forests",
    "Tundra": "Tundra",
    "Crops": "Croplands",
    "Native tropical savanna": "Tropical & Subtropical Grasslands, Savannas & Shrublands",
    "Tropical pastures": "Pasture",
}

# Bar-On terrestrial protist biome labels -> fine name (generic "Grassland"
# treated as temperate grassland; mapped through to its group on roll-up).
BARON_PROTIST_TO_FINE: dict[str, str] = {
    "Boreal Forest": "Boreal Forests/Taiga",
    "Cropland": "Croplands",
    "Desert": "Deserts & Xeric Shrublands",
    "Grassland": "Temperate Grasslands, Savannas & Shrublands",
    "Temperate Forest": "Temperate Broadleaf & Mixed Forests",
    "Tropical Forest": "Tropical & Subtropical Moist Broadleaf Forests",
    "Tropical Savanna": "Tropical & Subtropical Grasslands, Savannas & Shrublands",
    "Tundra": "Tundra",
}

_CROSSWALKS = {
    "vandenhoogen": VANDENHOOGEN_TO_FINE,
    "rosenberg": ROSENBERG_TO_GROUP,
    "baron_annelid": BARON_ANNELID_TO_FINE,
    "baron_protist": BARON_PROTIST_TO_FINE,
}


def group_for(biome_or_group: str) -> str:
    """Return the aggregated group for a fine biome name (or pass a group through)."""
    if biome_or_group in FINE_TO_GROUP:
        return FINE_TO_GROUP[biome_or_group]
    if biome_or_group in set(FINE_TO_GROUP.values()):
        return biome_or_group
    raise KeyError(f"Unknown biome/group: {biome_or_group!r}")


def normalize(source: str, label: str) -> tuple[str | None, str]:
    """Map a raw source biome label to ``(fine_biome | None, group)``.

    ``fine_biome`` is None when the source only resolves to group grain
    (Rosenberg). Raises KeyError on an unmapped label so crosswalk gaps fail
    loudly rather than silently dropping biomass.
    """
    xwalk = _CROSSWALKS[source]
    target = xwalk[str(label).strip()]
    if source == "rosenberg":
        return None, target  # target is already a group
    return target, FINE_TO_GROUP[target]


__all__ = [
    "FINE_BIOMES",
    "FINE_TO_GROUP",
    "BIOME_NUM_TO_FINE",
    "VANDENHOOGEN_TO_FINE",
    "ROSENBERG_TO_GROUP",
    "BARON_ANNELID_TO_FINE",
    "BARON_PROTIST_TO_FINE",
    "group_for",
    "normalize",
]
