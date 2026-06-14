library(raster)
library(rgdal)
# path_to_map_data = '/home/liorgr/PycharmProjects/mammal_biomass/data/map_data/'
# continents_filename = 'continent_shapefile/continent.shp'
# density_raster_filename = 'mass_density_raster.tif'
# proj4string = "+proj=cea +lon_0=0 +lat_ts=30 +x_0=0 +y_0=0 +ellps=WGS84 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs"
# res_m = 12512.63

args <- commandArgs(trailingOnly = TRUE)
path_to_map_data = args[1]
continents_filename = args[2]
density_raster_filename = args[3]
proj4string = args[4]
res_m = as.numeric(args[5])
print_species = args[6] 
path_to_env_params = args[7] 
path_to_species_rasters = args[8]

cont_data = readOGR(paste0(path_to_map_data,continents_filename))
cont_data = spTransform(cont_data,proj4string)

density_raster_kg_km = raster(paste0(path_to_map_data,density_raster_filename))
mass_raster_kg = density_raster_kg_km*(res_m^2*10^(-6))

mass_in_cont <- function(cont_shp){
  cropped_raster = crop(mass_raster_kg, cont_shp)
  cropped_raster = mask(cropped_raster, cont_shp)
  mass_sum_Mt = cellStats(cropped_raster, stat='sum')*10^(-9)
  return(mass_sum_Mt)
}

continent_mass = vector()
continents = as.vector(cont_data$CONTINENT)
for (cont in continents){
  print(cont)
  cont_shp = cont_data[cont_data$CONTINENT==cont,]
  continent_mass = append(continent_mass,mass_in_cont(cont_shp))
}

df = data.frame(continents, continent_mass,stringsAsFactors = FALSE)

write.csv(df, paste0(path_to_map_data,'mass_by_continent.csv'))

