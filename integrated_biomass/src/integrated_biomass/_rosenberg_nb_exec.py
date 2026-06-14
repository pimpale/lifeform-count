"""Execute Rosenberg's original notebook inside a pinned *legacy* environment
and export the biome x taxon tables it computes but does not save.

Runs as a subprocess under `uv run --with pandas==1.5.3 ...` (see
repro_rosenberg.py): the upstream notebook uses pandas<2 idioms
(DataFrame.append, tuple groupby indexing) that error on modern pandas.

Rather than spin up a Jupyter kernel, we concatenate the notebook's code cells
into one script, strip IPython magics, force a headless matplotlib backend, and
exec it with the notebook's directory as cwd (so its relative reads work). The
*only* additions are an optional override of the bootstrap sample counts (for a
fast preview run) and an appended block that writes the already-computed
`soil_tots`, `above_ground_tots`, `soil_pop_tots`, `above_ground_pop_tots`
frames to CSV.

Usage:
    python _rosenberg_nb_exec.py <notebook.ipynb> <outdir> <n_boot> <n_samp>
"""

import json
import os
import re
import sys
from pathlib import Path

EXPORT_BLOCK = """
# --- injected by integrated_biomass: export biome x taxon tables ---
import os as _os
_out = _os.environ['IB_ROSENBERG_OUT']
_os.makedirs(_out, exist_ok=True)

def _dump(_df, _name):
    _df.reset_index().to_csv(_os.path.join(_out, _name), index=False)

_dump(soil_tots, 'soil_biome_taxon_mass_Mt.csv')
_dump(above_ground_tots, 'aboveground_biome_mass_Mt.csv')
_dump(soil_pop_tots, 'soil_biome_taxon_pop.csv')
_dump(above_ground_pop_tots, 'aboveground_biome_pop.csv')
print('IB_EXPORT_OK', _out)
"""


def _strip_magics(src: str) -> str:
    out = []
    for line in src.splitlines():
        s = line.lstrip()
        if s.startswith("%") or s.startswith("!") or "get_ipython(" in s:
            continue
        out.append(line)
    return "\n".join(out)


def _override_counts(src: str, n_boot: int, n_samp: int) -> str:
    # Only rewrite the top-level config assignments (`N_boot=100000`), i.e.
    # column-0 lines whose RHS is a numeric literal. Crucially this must NOT
    # touch indented keyword arguments like `N_boot=N_boot` inside a call,
    # which would corrupt the call (missing comma).
    out = []
    for line in src.splitlines():
        if re.match(r"N_boot\s*=\s*\d", line):
            out.append(f"N_boot={n_boot} #overridden")
        elif re.match(r"N_samps\s*=\s*\d", line):
            out.append(f"N_samps={n_samp} #overridden")
        else:
            out.append(line)
    return "\n".join(out)


def main() -> int:
    nb_path = Path(sys.argv[1]).resolve()
    out_dir = Path(sys.argv[2]).resolve()
    n_boot, n_samp = int(sys.argv[3]), int(sys.argv[4])

    os.environ["IB_ROSENBERG_OUT"] = str(out_dir)
    os.environ.setdefault("MPLBACKEND", "Agg")

    nb = json.loads(nb_path.read_text())
    pieces = []
    for cell in nb["cells"]:
        if cell["cell_type"] != "code":
            continue
        src = "".join(cell["source"])
        src = _strip_magics(src)
        src = _override_counts(src, n_boot, n_samp)
        pieces.append(src)
    pieces.append(EXPORT_BLOCK)
    script = "\n\n".join(pieces)

    out_dir.mkdir(parents=True, exist_ok=True)
    os.chdir(nb_path.parent)  # notebook reads data/ via relative paths
    g = {"__name__": "__main__", "__file__": str(nb_path)}
    exec(compile(script, str(nb_path), "exec"), g)
    print("Rosenberg notebook executed; tables written to", out_dir)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
