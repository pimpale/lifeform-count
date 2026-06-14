import rasterio as rio
import geopandas as gpd
import numpy as np
from matplotlib.colors import LinearSegmentedColormap, hsv_to_rgb
import rasterio.plot
from matplotlib import colors, cm
import matplotlib.pyplot as plt
import pandas as pd
from scipy.ndimage import gaussian_filter


def get_continent_data_from_file(path_to_map_data):
    """
    Input:  path to continents shapefile.
    Output: continent polygons (dissolved s.t. Eurasia is a single cont)

    Polygon shapefiles attained from https://hub.arcgis.com/datasets/esri::world-continents/explore?location=3.124909%2C44.296869%2C3.00
    """
    continents = gpd.read_file(path_to_map_data)
    continents = continents[continents.CONTINENT != 'Antarctica']
    continents = continents.to_crs("EPSG:6933").dissolve()
    return continents


def gen_custom_cmap():
    """
    Output:  customized colormap.
    """
    values = [
        (0.0, 0.15, 0.0, 1.0),
        (0.1, 0.15, 0.5, 0.9),
        (0.25, 0.4, 0.5, 0.8),
        (0.30, 0.4, 0.5, 0.7),
        (0.40, 0.2, 0.5, 0.6),
        (0.65, 0.1, 0.5, 0.4),
        (0.8, 0.1, 0.5, 0.3),
        (1.00, 0.0, 1.0, 0.0)
    ]
    cdict = {"red": [], "green": [], "blue": []}
    for z, h, s, v in values:
        r, g, b = hsv_to_rgb((h, s, v))
        cdict["red"].append((z, r, r))
        cdict["green"].append((z, g, g))
        cdict["blue"].append((z, b, b))
    cmap = LinearSegmentedColormap('mammals', segmentdata=cdict, N=256)
    return cmap


def plot_map(path_to_continent_data, path_to_raster_data, path_to_biomass_data):
    """
    Input:  path to continents shapefile, species raster data and biomass per species.
    Output: continentplot (figure 5).

    """
    font = {'family': 'Ubuntu',
            'weight': 'normal',
            'size': 16}
    plt.rc('font', **font)
    continents = get_continent_data_from_file(path_to_continent_data)
    path_to_raster = rio.open(path_to_raster_data)
    raster = path_to_raster.read(1)
    raster[raster < 0] = 0
    fig, ax = plt.subplots(figsize=(20, 20))
    rasterio.plot.show(raster, cmap=gen_custom_cmap(), vmin=0, vmax=1500, transform=path_to_raster.transform, ax=ax)
    cbar = fig.colorbar(cm.ScalarMappable(norm=colors.Normalize(vmin=0, vmax=1500), cmap=gen_custom_cmap()), ax=ax,
                        shrink=0.3)
    for t in cbar.ax.get_yticklabels():
        t.set_fontsize(16)
    cbar.ax.set_ylabel("Wild Mammal Mass Density "+r"$[kg/km^2]$", rotation=270, labelpad=30)
    continents.plot(ax=ax, fc='none', ec='grey', linewidth=0.3)
    ax.axis('off')

    return fig, ax




