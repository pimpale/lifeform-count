/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/
// This script is used both to create the final maps as well as
// sample them at each of the sample points in order to create
// final predicted versus observed plots


/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/
// Prepare the feature collection of nematode points

// This code chunk prepares this table for input into the grid search function

// Instantiate a dictionary that translates the placeholder names
// to the actual band names from the composite image
// !! Taken from the "ChangeCSVColumnNamesBeforeShapefile.ipynb" file
var placeHolderNameDict = ee.Dictionary({'Abs_Lat': 'A', 'Annual_Mean_Radiation': 'B', 'Annual_Mean_Temperature': 'C', 'Annual_Precipitation': 'D', 'Aridity_Index': 'E', 'Bacterivor': 'F', 'Bulk_Density_15cm': 'G', 'CContent_15cm': 'H', 'CatIonExcCap_15cm': 'I', 'Clay_Content_15cm': 'J', 'CoOfVar_EVI_Hetero_1km': 'K', 'Contrast_EVI_Hetero_1km': 'L', 'CorFragVolPerc_15cm': 'M', 'Correlation_EVI_Hetero_1km': 'N', 'Depth_to_Bedrock': 'O', 'Dissimilarity_EVI_Hetero_1km': 'P', 'EVI': 'Q', 'Entropy_EVI_Hetero_1km': 'R', 'Evenness_EVI_Hetero_1km': 'S', 'Fpar': 'T', 'Fungivores': 'U', 'Global_Biomass_IPCC': 'V', 'Gpp': 'W', 'Highest_Weekly_Radiation': 'X', 'Homogeneity_EVI_Hetero_1km': 'Y', 'Human_Development': 'Z', 'Isothermality': 'AA', 'Lai': 'AB', 'Lowest_Weekly_Radiation': 'AC', 'Max_Temperature_of_Warmest_Month': 'AD', 'Maximum_EVI_Hetero_1km': 'AE', 'Mean_Diurnal_Range': 'AF', 'Mean_Temperature_of_Coldest_Quarter': 'AG', 'Mean_Temperature_of_Driest_Quarter': 'AH', 'Mean_Temperature_of_Warmest_Quarter': 'AI', 'Mean_Temperature_of_Wettest_Quarter': 'AJ', 'Min_Temperature_of_Coldest_Month': 'AK', 'NDVI': 'AL', 'Nadir_Reflectance_Band1': 'AM', 'Nadir_Reflectance_Band2': 'AN', 'Nadir_Reflectance_Band3': 'AO', 'Nadir_Reflectance_Band4': 'AP', 'Nadir_Reflectance_Band5': 'AQ', 'Nadir_Reflectance_Band6': 'AR', 'Nadir_Reflectance_Band7': 'AS', 'Npp': 'AT', 'Omnivores': 'AU', 'OrgCStockTHa_0to15cm': 'AV', 'PET': 'AW', 'Pixel_Lat': 'AX', 'Pixel_Long': 'AY', 'Plant_feed': 'AZ', 'Population_Density': 'BA', 'Precipitation_Seasonality': 'BB', 'Precipitation_of_Coldest_Quarter': 'BC', 'Precipitation_of_Driest_Month': 'BD', 'Precipitation_of_Driest_Quarter': 'BE', 'Precipitation_of_Warmest_Quarter': 'BF', 'Precipitation_of_Wettest_Month': 'BG', 'Precipitation_of_Wettest_Quarter': 'BH', 'PredProb_of_R_Horizon': 'BI', 'Predators': 'BJ', 'Radiation_Seasonality': 'BK', 'Radiation_of_Coldest_Quarter': 'BL', 'Radiation_of_Driest_Quarter': 'BM', 'Radiation_of_Warmest_Quarter': 'BN', 'Radiation_of_Wettest_Quarter': 'BO', 'Range_EVI_Hetero_1km': 'BP', 'Sand_Content_15cm': 'BQ', 'Shannon_Index_1km': 'BR', 'Silt_Content_15cm': 'BS', 'Simpson_Index_1km': 'BT', 'Std_EVI_Hetero_1km': 'BU', 'Temperature_Annual_Range': 'BV', 'Temperature_Seasonality': 'BW', 'Total_Numb': 'BX', 'Unidentifi': 'BY', 'Uniformity_EVI_Hetero_1km': 'BZ', 'Variance_EVI_Hetero_1km': 'CA', 'eastness': 'CB', 'elevation': 'CC', 'hillshade': 'CD', 'northness': 'CE', 'pHinHOX_15cm': 'CF', 'slope': 'CG'});
var keys = placeHolderNameDict.keys();
var values = placeHolderNameDict.values();

// Replace the placeholder names with the full names
var fcWithFullNames = nematodeTablePlaceholders.select(values, keys);

/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/
// Sample each of the functional group maps and export the results
// for predicted versus observed plots

// Load the "gap-fill" function
var gapFillAndExtendBounds = require('users/devinrouth/toolbox:GapFillAndExtendBounds.js');

// Total Number
var totalNumbCollection = fcWithFullNames.filterMetadata('Total_Numb','not_equals',null).select('Total_Numb');
print('Total Number Collection',totalNumbCollection.limit(5));

// Sample the gap-filled image
var totalFilledImage = gapFillAndExtendBounds.gapFillAndExtendBounds(totalNumberColl.mean(),totalNumberColl.mean().bandNames(),10000);
var totalSampled = totalFilledImage.sampleRegions({collection:totalNumbCollection,scale:927.6624232772797});

Export.table.toDrive({collection:totalSampled,
                      description:'20180723_TotalNumb_PredVsObs',
                      fileNamePrefix:'20180723_TotalNumb_PredVsObs',
                      folder:'20180723_Nematode_PredVsObs'});


// Bacterivores
var bactervioresCollection = fcWithFullNames.filterMetadata('Bacterivor','not_equals',null).select('Bacterivor');
print('Bacterivores Collection',bactervioresCollection.limit(5));

// Sample the gap-filled image
var gapFillAndExtendBounds = require('users/devinrouth/toolbox:GapFillAndExtendBounds.js');
var bacterivoreFilledImage = gapFillAndExtendBounds.gapFillAndExtendBounds(bacterivoreColl.mean(),bacterivoreColl.mean().bandNames(),10000);
var bactervioreSampled = bacterivoreFilledImage.sampleRegions({collection:bactervioresCollection,scale:927.6624232772797});

Export.table.toDrive({collection:bactervioreSampled,
                      description:'20180723_Bacterivores_PredVsObs',
                      fileNamePrefix:'20180723_Bacterivores_PredVsObs',
                      folder:'20180723_Nematode_PredVsObs'});


// Fungivores
var fungivoresCollection = fcWithFullNames.filterMetadata('Fungivores','not_equals',null).select('Fungivores');
print('Fungivores Collection',fungivoresCollection.limit(5));

// Sample the gap-filled image
var fungivoreFilledImage = gapFillAndExtendBounds.gapFillAndExtendBounds(fungivoreColl.mean(),fungivoreColl.mean().bandNames(),10000);
var fungivoreSampled = fungivoreFilledImage.sampleRegions({collection:fungivoresCollection,scale:927.6624232772797});

Export.table.toDrive({collection:fungivoreSampled,
                      description:'20180723_Fungivores_PredVsObs',
                      fileNamePrefix:'20180723_Fungivores_PredVsObs',
                      folder:'20180723_Nematode_PredVsObs'});


// Herbivores
var herbivoresCollection = fcWithFullNames.filterMetadata('Plant_feed','not_equals',null).select('Plant_feed');
print('Herbivores Collection',herbivoresCollection.limit(5));

// Sample the gap-filled image
var herbivoreFilledImage = gapFillAndExtendBounds.gapFillAndExtendBounds(herbivoreColl.mean(),herbivoreColl.mean().bandNames(),10000);
var herbivoreSampled = herbivoreFilledImage.sampleRegions({collection:herbivoresCollection,scale:927.6624232772797});

Export.table.toDrive({collection:herbivoreSampled,
                      description:'20180723_Herbivores_PredVsObs',
                      fileNamePrefix:'20180723_Herbivores_PredVsObs',
                      folder:'20180723_Nematode_PredVsObs'});


// Omnivores
var omnivoresCollection = fcWithFullNames.filterMetadata('Omnivores','not_equals',null).select('Omnivores');
print('Omnivores Collection',omnivoresCollection.limit(5));

// Sample the gap-filled image
var omnivoreFilledImage = gapFillAndExtendBounds.gapFillAndExtendBounds(omnivoreColl.mean(),omnivoreColl.mean().bandNames(),10000);
var omnivoreSampled = omnivoreFilledImage.sampleRegions({collection:omnivoresCollection,scale:927.6624232772797});

Export.table.toDrive({collection:omnivoreSampled,
                      description:'20180723_Omnivores_PredVsObs',
                      fileNamePrefix:'20180723_Omnivores_PredVsObs',
                      folder:'20180723_Nematode_PredVsObs'});


// Predators
var predatorsCollection = fcWithFullNames.filterMetadata('Predators','not_equals',null).select('Predators');
print('Predators Collection',predatorsCollection.limit(5));

// Sample the gap-filled image
var predatorFilledImage = gapFillAndExtendBounds.gapFillAndExtendBounds(predatorsColl.mean(),predatorsColl.mean().bandNames(),10000);
var predatorSampled = predatorFilledImage.sampleRegions({collection:predatorsCollection,scale:927.6624232772797});

Export.table.toDrive({collection:predatorSampled,
                      description:'20180723_Predators_PredVsObs',
                      fileNamePrefix:'20180723_Predators_PredVsObs',
                      folder:'20180723_Nematode_PredVsObs'});




/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/

// Instantiate a couple of palette options
var vibgYOR = ['330044', '220066', '1133cc', '33dd00', 'ffda21', 'ff6622', 'd10000'];
var rainbow100 = ["ff0000","ff0500","ff0a00","ff0f00","ff1400","ff1800","ff1d00","ff2200","ff2700","ff2c00","ff3100","ff3600","ff3b00","ff4000","ff4400","ff4900","ff4e00","ff5300","ff5800","ff5d00","ff6200","ff6700","ff6b00","ff7000","ff7500","ff7a00","ff7f00","ff8400","ff8900","ff8e00","ff9300","ff9800","ff9d00","ffa100","ffa600","ffab00","ffb000","ffb500","ffba00","ffbf00","ffc400","ffc900","ffce00","ffd300","ffd800","ffdd00","ffe100","ffe600","ffeb00","fff000","fff500","fffa00","ffff00","f5ff00","ebff00","e2ff00","d8ff00","ceff00","c4ff00","baff00","b1ff00","a7ff00","9dff00","93ff00","89ff00","7fff00","76ff00","6cff00","62ff00","58ff00","4eff00","45ff00","3bff00","31ff00","27ff00","1dff00","14ff00","0aff00","00ff00","00ff0a","00ff14","00ff1d","00ff27","00ff31","00ff3b","00ff45","00ff4e","00ff58","00ff62","00ff6c","00ff76","00ff80","00ff89","00ff93","00ff9d","00ffa7","00ffb1","00ffba","00ffc4","00ffce","00ffd8","00ffe2","00ffeb","00fff5","00ffff","00f5ff","00ebff","00e2ff","00d8ff","00ceff","00c4ff","00baff","00b1ff","00a7ff","009dff","0093ff","0089ff","007fff","0076ff","006cff","0062ff","0058ff","004eff","0045ff","003bff","0031ff","0027ff","001dff","0014ff","000aff","0000ff","0500ff","0b00ff","1000ff","1500ff","1b00ff","2000ff","2500ff","2b00ff","3000ff","3500ff","3b00ff","4000ff","4500ff","4b00ff","5000ff","5600ff","5b00ff","6000ff","6600ff","6b00ff","7000ff","7600ff","7b00ff","8000ff","8600ff","8b00ff"];


// Add layers to the map
Map.addLayer(totalNumberColl.mean(),{palette:vibgYOR,min:0,max:5000},'Total Number Ensemble');



// Export the imagery outside of Earth Engine
var unboundedGeo = ee.Geometry.Polygon([-180, 88, 0, 88, 180, 88, 180, -88, 0, -88, -180, -88], null, false);

// Total Number
Export.image.toDrive({
	image: totalNumberColl.mean(),
	description: '20180723_TotalNumber_EnsembleMap',
	fileNamePrefix:'20180723_TotalNumber_EnsembleMap',
	folder:'20180723_Nematode_Map_Exports',
	region:unboundedGeo,
	maxPixels:1e13
});

// Total Number Coefficient of Variation
Export.image.toDrive({
	image: ee.Image(totalNumberColl.reduce(ee.Reducer.stdDev())).divide(totalNumberColl.mean()),
	description: '20180723_TotalNumberCoefVar_EnsembleMap',
	fileNamePrefix:'20180723_TotalNumberCoefVar_EnsembleMap',
	folder:'20180723_Nematode_Map_Exports',
	region:unboundedGeo,
	maxPixels:1e13
});

// Bacterivores
Export.image.toDrive({
	image: bacterivoreColl.mean(),
	description: '20180723_Bacterivores_EnsembleMap',
	fileNamePrefix:'20180723_Bacterivores_EnsembleMap',
	folder:'20180723_Nematode_Map_Exports',
	region:unboundedGeo,
	maxPixels:1e13
});

// Fungivores
Export.image.toDrive({
	image: fungivoreColl.mean(),
	description: '20180723_Fungivores_EnsembleMap',
	fileNamePrefix:'20180723_Fungivores_EnsembleMap',
	folder:'20180723_Nematode_Map_Exports',
	region:unboundedGeo,
	maxPixels:1e13
});

// Herbivores
Export.image.toDrive({
	image: herbivoreColl.mean(),
	description: '20180723_Herbivores_EnsembleMap',
	fileNamePrefix:'20180723_Herbivores_EnsembleMap',
	folder:'20180723_Nematode_Map_Exports',
	region:unboundedGeo,
	maxPixels:1e13
});

// Omnivores
Export.image.toDrive({
	image: omnivoreColl.mean(),
	description: '20180723_Omnivores_EnsembleMap',
	fileNamePrefix:'20180723_Omnivores_EnsembleMap',
	folder:'20180723_Nematode_Map_Exports',
	region:unboundedGeo,
	maxPixels:1e13
});

// Predators
Export.image.toDrive({
	image: predatorsColl.mean(),
	description: '20180723_Predators_EnsembleMap',
	fileNamePrefix:'20180723_Predators_EnsembleMap',
	folder:'20180723_Nematode_Map_Exports',
	region:unboundedGeo,
	maxPixels:1e13
});

// Unidentified
Export.image.toDrive({
	image: unidentifiedColl.mean(),
	description: '20180723_Unidentified_Ensemble_Maps',
	fileNamePrefix:'20180723_Unidentified_Ensemble_Maps',
	folder:'20180723_Nematode_Map_Exports',
	region:unboundedGeo,
	maxPixels:1e13
});