import pandas as pd
import json
import colorutils
import numpy as np
import argparse
import sys

parser = argparse.ArgumentParser()
parser.add_argument("input_file", type=argparse.FileType('r'))
args = parser.parse_args()


np.random.seed(1990)

level1_to_depth = {"Marine": "Family", "Terrestrial": "Order", "Domesticated": "Species", "Human": "Species"}
level1_to_hue = {"Marine": 220, "Terrestrial": 50, "Domesticated": 0, "Human": 300}

mammals_df = pd.read_csv(args.input_file, index_col=None)

root = dict()
root["name"] = "Mammals"
root["children"] = []

for gr, group_df in mammals_df.groupby("Level_1"):
    
    v = 0.6 + 0.4 * np.random.rand()
    
    subtree = dict()
    subtree["name"] = gr
    h = level1_to_hue[gr]
    subtree["color"] = colorutils.hsv_to_hex((h, 0.5, 0.8))
    subtree["children"] = []

    for row in group_df.itertuples():
        v = 0.6 + 0.4 * np.random.rand()
        leaf = dict()
        leaf["name"] = row.Level_2
        leaf["weight"] = row.mass
        leaf["color"] = colorutils.hsv_to_hex((h, 0.5, v)).upper()
        subtree["children"].append(leaf)
    root["children"].append(subtree)

sys.stdout.write(json.dumps(root, indent="\t"))
