import pandas as pd
import numpy as np
import glob
import os
from datetime import datetime
import seaborn as sns
from sklearn.metrics import mean_squared_error
import subprocess
import re
import matplotlib.pyplot as plt
import matplotlib.ticker as mtick
import matplotlib.patches as  mpatches
from matplotlib.lines import Line2D
from itertools import chain, combinations
from itertools import chain, combinations




def main():
    np.random.seed(2)
    global path_to_env_params, path_to_data, path_to_results, path_to_data_domesticated, path_to_marine_data
    global path_to_plots, path_to_SI_plots, path_to_SI_tables, path_to_map_data
    global path_to_species_rasters, path_to_rasters_w_density, proj4string, spatial_res_m
    path_to_env_params = 'species_env_params/'
    path_to_data = 'data/'
    path_to_results = 'results/'
    path_to_plots = 'plots/'
    path_to_SI_plots = path_to_plots+'SI/'
    path_to_SI_tables = path_to_results+'SI/'
    path_to_data_domesticated = path_to_data + 'domesticated_data/'
    path_to_marine_data = path_to_data + 'marine_data/'
    path_to_map_data = path_to_data + 'map_data/'
    path_to_species_rasters = 'species_rasters/'
    path_to_rasters_w_density = 'rasters_with_density/'
    proj4string = "+proj=cea +lon_0=0 +lat_ts=30 +x_0=0 +y_0=0 +ellps=WGS84 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs"
    spatial_res_m = "12512.63"


def generate_lognorm_dist(mu):
    return np.random.lognormal(np.log(mu), 0.35, 1000)

if __name__ == '__main__':
    main()
