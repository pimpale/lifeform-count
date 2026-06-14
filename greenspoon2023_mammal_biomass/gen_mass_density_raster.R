library(sp)
library(raster)
library(parallel)
library(ColorPalette)
library(rstudioapi)
# 
# # When running from Rstudio - uncomment ##
# setwd(dirname(rstudioapi::getActiveDocumentContext()$path))
# n_cores = as.numeric('4')
# path_to_results = 'results/'
# path_to_data = 'data/'
# path_to_map_data = 'data/map_data/'
# path_to_rasters = 'species_rasters/'
# path_to_rasters_w_density = 'rasters_with_density/'
# proj4string = '+proj=cea +lon_0=0 +lat_ts=30 +x_0=0 +y_0=0 +ellps=WGS84 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs'
# path_to_wd = ''
# setwd(path_to_wd)

## When running from cmd via jupyter - uncomment ##
args <- commandArgs(trailingOnly = TRUE)
n_cores = as.numeric(args[1])
path_to_results = args[2]
path_to_data = args[3]
path_to_map_data = args[4]
path_to_rasters = args[5]
path_to_rasters_w_density = args[6]
proj4string = args[7]
path_to_wd = args[8]

global_extent = extent(c(-17429667,17430520,-7390138,7390138))
model_predictions = read.csv(paste0(path_to_results,'wild_land_biomass_for_map.csv'),check.names=FALSE)
model_predictions$mass_kg = model_predictions$biomass_Mt*10**9
ranges = read.csv(paste0(path_to_data,'mended_ranges.csv'),check.names=FALSE)

assign_mass_density_to_rasters<-function(species){
  cat(species)
  cat('\n')
  species_raster = raster(paste0(path_to_rasters,species,'.tif'))
  species_raster = extend(species_raster, global_extent, value=NA)
  species_raster[species_raster>0]=total[total$binomial==species,]$mass_density_kg_km
  filename = paste0(path_to_rasters_w_density,species,'.tif')
  writeRaster(species_raster,filename, overwrite = TRUE)
  return(species)
}

total = merge(model_predictions,ranges,by="binomial")
total = total[total$range_km_2>0,]
total$mass_density_kg_km = total$mass_kg/total$range_km_2
total = total[order(-total$mass_kg),]
total = total[0: 1000,]
binomials = lapply(total$binomial, as.character)
invisible(lapply(binomials,assign_mass_density_to_rasters))

rasters_w_density_files = list.files(path_to_rasters_w_density,pattern="*.tif$", full.names=TRUE)
raster_stack <- stack(rasters_w_density_files)

Sys.time()
beginCluster(n_cores)
raster_sum <- clusterR(raster_stack, calc, args=list(sum, na.rm=T))
endCluster()
raster_sum[raster_sum==0]=NaN
writeRaster(raster_sum,paste0(path_to_map_data,'mass_density_raster_.tif'),format = 'GTiff',overwrite=TRUE)
Sys.time()

