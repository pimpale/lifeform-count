library(raster)
library(rstudioapi)
## Set working directory 
current_path = rstudioapi::getActiveDocumentContext()$path 
setwd(dirname(current_path ))
path_to_species_rasters = 'species_rasters/'
path_to_country_data = '/data/map_data/'
countries = getData(name = 'countries', path = paste0(dirname(current_path ),path_to_country_data))
res = 12512.63


get_country<-function(iso, raster_crs){
  country = countries[countries$ISO==iso,]
  country = spTransform(country, raster_crs)
  return (country)
}

raster_at_country_extent <- function(species_raster, country_polygon){
  raster_in_country = mask(species_raster, country_polygon)
  area_in_country = sum(values(raster_in_country)==1, na.rm=TRUE)
  return(list("raster"= raster_in_country, "area" = area_in_country))
}

####### White-tailed deer #######
deer_raster = raster(paste0(path_to_species_rasters,'Odocoileus virginianus.tif'))
usa = get_country('USA', crs(deer_raster))
canada = get_country('CAN', crs(deer_raster))
deer_in_usa = raster_at_country_extent(deer_raster,usa)
deer_in_can = raster_at_country_extent(deer_raster,canada)
plot = plot(deer_raster,axes=FALSE, legend = FALSE)
plot(usa,add = TRUE)
fraction_in_can = (deer_in_can$area/(deer_in_can$area+deer_in_usa$area))
fraction_in_usa = 1-fraction_in_can
tot_area = sum(values(deer_raster)==1, na.rm=TRUE)
latin_amreica_area = (tot_area-(deer_in_can$area+deer_in_usa$area))*res^2*10^(-6)


## Area in Latin America
canada = countries[countries$ISO=='CAN',]
canada = spTransform(canada, crs(deer_raster))
raster_in_latin_amreica = mask(deer_raster, usa, inverse = TRUE)
raster_in_latin_amreica = mask(raster_in_latin_amreica, canada, inverse = TRUE)
plot = plot(raster_in_latin_amreica,axes=FALSE, legend = FALSE)
latin_america_area = sum(values(raster_in_latin_amreica)==1, na.rm=TRUE)*res^2*10^(-6)

## Moose ##
moose_raster = raster(paste0(path_to_species_rasters,'Alces alces.tif'))
russia = countries[countries$ISO=='RUS',]
russia = spTransform(russia, crs(moose_raster))
raster_in_europe = mask(moose_raster, usa, inverse = TRUE)
raster_in_europe = mask(raster_in_europe, canada, inverse = TRUE)
raster_in_russia = mask(raster_in_europe, russia)
relevant_area = sum(values(raster_in_russia)==1, na.rm=TRUE)
tot_area = sum(values(raster_in_europe)==1, na.rm=TRUE)
plot = plot(moose_raster,axes=FALSE, legend = FALSE)
plot(russia,add = TRUE)
precent_in_russia = round((relevant_area/tot_area)*100)

## Mule deer ##
m_deer_raster = raster(paste0(path_to_species_rasters,'Odocoileus hemionus.tif'))
m_deer_raster_in_usa = mask(m_deer_raster, usa)
relevant_area = sum(values(m_deer_raster_in_usa)==1, na.rm=TRUE)
tot_area = sum(values(m_deer_raster)==1, na.rm=TRUE)
m_deer_precent_in_usa = round((relevant_area/tot_area)*100)

####### Wild boar #######
boar_raster = raster(paste0(path_to_species_rasters,'Sus scrofa.tif'))
area = 0
boar_countries = c('RUS','CHN','AUT','BEL','BGR','HRV','CYP',
                   'CZE','DNK','EST','FIN','FRA','DEU','GRC',
                   'HUN','IRL','ITA','LVA','LTU','LUX','MLT',
                   'NLD','POL','PRT','ROU','SVK','SVN','ESP',
                   'SWE','GBR','AZE','GEO','ARM','MDA','KAZ',
                   'UKR','LVA','LTU','BLR','EST')
country_names = c()
for (iso in boar_countries){
  country = countries[countries$ISO==iso,]$NAME_ENGLISH
  country_names = c(country_names,as.character(country))
  # country = get_country(iso,crs(boar_raster))
  # partial_boar = raster_at_country_extent(boar_raster,country)
  # area = area+partial_boar$area
  # print(iso)
}
fraction_in_countries = area/sum(values(boar_raster)==1, na.rm=TRUE)

polygon = polygons[polygons@data$binomial==species,]
cropped_raster = crop(habitat_raster_projected, polygon)
cropped_raster = mask(cropped_raster, polygon)

