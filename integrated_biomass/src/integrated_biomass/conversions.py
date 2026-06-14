"""Documented unit-conversion factors, each traced to its source paper.

Keeping these in one place makes the (load-bearing) assumptions auditable: the
whole integration hinges on getting every taxon into the same currency, grams
of carbon. Change a factor here and every adapter that uses it follows.
"""

# Bar-On (2018) terrestrial arthropods: carbon biomass is 50% of dry weight.
# (animals/arthropods/terrestrial_arthropods/terrestrial_arthropods.py:
#  "Calculate carbon biomass as 50% of dry weight".) Rosenberg reports *dry*
# biomass, so dry -> carbon uses this factor.
ARTHROPOD_DRY_TO_C = 0.5

# Bar-On (2018) wild mammals: wet weight -> carbon = 0.15 (70% water, then 50%
# carbon of dry weight). (animals/chordates/wild_mammals/wild_mammal.py:
#  "wet_to_c = 0.15".) Greenspoon reports *wet* biomass.
MAMMAL_WET_TO_C = 0.15

# van den Hoogen (2019) nematodes already report carbon mass (Mt C), computed
# internally with cperw = 0.2 * 0.52 = 0.104 (fresh -> carbon). No further
# conversion is applied; this constant is recorded only for documentation.
NEMATODE_FRESH_TO_C = 0.2 * 0.52
