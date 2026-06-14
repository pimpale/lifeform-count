library(raster)
library(rgdal)

path_to_data = '/home/liorgr/PycharmProjects/mammal_biomass/data/'

args <- commandArgs(trailingOnly = TRUE)
projection_str = args[1]
res = as.numeric(args[2])
raster_to_file = as.logical(args[3])
env_params_to_file = as.logical(args[4])
path_to_data = args[5]
print_species = args[6] 
path_to_env_params = args[7] 
path_to_species_rasters = args[8]

reproject_env_rasters<- function(var_name,res){
  global_extent = extent(c(-180, 180, -90, 90))
  origin_raster = raster(paste0(path_to_data,var_name,'.tif'))
  origin_raster = extend(origin_raster, global_extent)
  projected_raster = projectRaster(origin_raster,habitat_raster_projected, method = 'bilinear')
  return(projected_raster)
}

habitat_raster = raster(paste0(path_to_data,"iucn_habitatclassification_composite_lvl2_ver001.tif"))
habitat_df = read.csv(paste0(path_to_data,'IUCN_suitable_habitat_processed.csv'),check.names=FALSE)
polygons = readOGR(paste0(path_to_data,'terrestrial_mammals_projected_dissolved/terrestrial_mammals_projected_dissolved.shp'))
binomials = as.character(polygons$binomial)
habitat_df = habitat_df[habitat_df$binomial %in% binomials,]
polygons = polygons[polygons$binomial %in% binomials,]
binomials = as.character(habitat_df$binomial)
mended_ranges = data.frame(matrix(NA, nrow = 0, ncol = 2))
habitat_raster_projected = projectRaster(habitat_raster,res = c(res,res), crs = projection_str, method = 'ngb')
env_params = c('prec_warmest_quarter','prec_seasonality','temp_seasonality','annual_mean_temp','npp')
for (param in env_params){
  assign(param,reproject_env_rasters(param, res))
}
stacked_env_raster = stack(lapply(env_params,FUN = get))

binomials_vector = vector()
ranges_vector  = vector()
cat('running')
for (species in binomials){
  if(print_species){
    cat(species)
    cat('\n')
  }
  polygon = polygons[polygons@data$binomial==species,]
  cropped_raster = crop(habitat_raster_projected, polygon)
  cropped_raster = mask(cropped_raster, polygon)
  values = as.vector(habitat_df[habitat_df$binomial==species,])
  values = values[2:length(values)]
  values = values[values>0]
  cropped_raster = cropped_raster %in% values
  cropped_raster[cropped_raster==0]=NaN
  if(all(is.na(values(cropped_raster)))){
    cropped_raster = crop(habitat_raster_projected, polygon)
    cropped_raster = mask(cropped_raster, polygon)
    cropped_raster = rasterize(polygon, cropped_raster)
    cropped_raster[cropped_raster>0]=1
    relevant_area = sum(values(cropped_raster)==1, na.rm=TRUE)*res^2*10^(-6)
  }
  if(raster_to_file){
    filename = paste0(path_to_species_rasters,species,'.tif')
    writeRaster(cropped_raster,filename, overwrite = TRUE)
  }
  if(env_params_to_file){
    filename = paste0(path_to_env_params,species,'.csv')
    cropped_env_raster = crop(stacked_env_raster, cropped_raster)
    cropped_env_raster = mask(cropped_env_raster, cropped_raster)
    env_params_df = rasterToPoints(cropped_env_raster)
    write.csv(env_params_df, filename)
  }
  relevant_area = sum(values(cropped_raster)==1, na.rm=TRUE)*res^2*10^(-6)
  if(relevant_area==0){
    relevant_area=area(polygon)*10^(-6)
  }
  mended_ranges[nrow(mended_ranges)+1,]  =  c(species,relevant_area)
  binomials_vector = append(binomials_vector, species)
  ranges_vector = append(ranges_vector,relevant_area)
}
mended_ranges = data.frame(binomials_vector,ranges_vector)
names(mended_ranges)[1]<-"binomial"
names(mended_ranges)[2]<-"range_km_2"
write.csv(mended_ranges,paste0(path_to_data,"mended_ranges.csv"), row.names = FALSE)

cat('Done!')


# 
# 

