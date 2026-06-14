# This folder contains all the scripts that were used to create the figures (not including the maps) and perform biomass and carbon calculations. 

## The three subfolders contain the following documents and scripts:
1. Data
    - "20193119_NematodePoints_Antarctica_SampledPixelValues.csv": Sampled pixel values located on Antarctica
    - "20190131_NematodePoints_SampledPixelValues_wBiome.csv": Sampled pixel values from all continents excluding Antarctica
    - "20190130_Nematode_Raw_Data_For_Analysis.csv": Raw data, 6759 observations
    - "Mulder2011.csv": Mulder et al. 2011 data on nematode body composition
    - "Family Ecophysiology qParameters.csv": Nemaplex data on nematode body compostion
    - "20180827_Biome_Abundances.csv": abundances per biome
    - "20180912_Biome_Abundances_Maximum.csv": upper limits of abundances
    - "20180912_Biome_Abundances_Minimum.csv": lower limites of abundances
2. R_code
    - "nematode_notebook_20190621.Rmd": RMarkdown document with code used to create non-geospatial figures (that is, all figures but the maps)
    - "nematode_notebook_20190621.html" same as above, but as .html output
    - "RMD_biomass_carbon_20190621.Rmd" RMarkdown document with code used to perform biomass and carbon calculations
    - "RMD_biomass_carbon_20190621.html" same as above, but as .html output
3. Supplementary_tables: 
    - Supplementary Table 1 | Nematode abundance data and corresponding metadata values. Abundance data for each trophic group and associated metadata from 1,876 1-km2 pixels that were used for geospatial modelling and abundance data from 39 1-km2 pixels from Antarctica. (.csv file)
    - Supplementary Table 2 | Summary of mean, median and sample size values per biome. The number of sites corresponds to the number of 1-km2 pixels into which the samples were aggregated. (.csv file) 
    - Supplementary Table 3 | Global covariate layers used for geospatial modelling. A total of 73 global covariate layers was used in our modelling approach. The 7 Nadir Reflectance Band layers (i.e., MCD43A4.005 BRDF-Adjusted Reflectance 16-Day Global 500m) are summarised as one entry in the table. (.xlsx file)
    - Supplementary Table 4 | Variable importance metrics. Edaphic characteristics emerged as the most important variables. As the full dataset includes collinear variables leading to a false representation of the variable importance metrics, analysis was performed on a selection of main variables. (.xlsx file)
    - Supplementary Table 5 | Number of soil nematodes per trophic group, per biome. Summing the predicted number of nematodes per 1 km2 pixel across biomes we estimate a total of 4.4  1020 nematodes are present in the top 15 cm of soil across the globe. (.csv file)
    - Supplementary Table 6 | Relative abundance of soil nematodes per trophic group, per biome. (.csv file)
    - Supplementary Table 7 | Nematode biomass per trophic group, per biome.  Note that values are presented in megatons (106 tons) carbon. (.csv file)
    - Supplementary Table 8 | Relative nematode biomass per trophic, per biome. (.csv file)
