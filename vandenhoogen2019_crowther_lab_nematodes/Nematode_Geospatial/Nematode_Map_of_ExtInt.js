/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/
// Prepare the feature collection of nematode points
var nematodeTablePlaceholders = ee.FeatureCollection("users/devinrouth/ETH_Nematodes/Nematode_Samples/20180706_NematodePointsSampled_wPlacehold");

// Instantiate a dictionary that translates the placeholder names
// to the actual band names from the composite image
// !! Taken from the "ChangeCSVColumnNamesBeforeShapefile.ipynb" file
var placeHolderNameDict = ee.Dictionary({
	'Abs_Lat': 'A',
	'Annual_Mean_Radiation': 'B',
	'Annual_Mean_Temperature': 'C',
	'Annual_Precipitation': 'D',
	'Aridity_Index': 'E',
	'Bacterivor': 'F',
	'Bulk_Density_15cm': 'G',
	'CContent_15cm': 'H',
	'CatIonExcCap_15cm': 'I',
	'Clay_Content_15cm': 'J',
	'CoOfVar_EVI_Hetero_1km': 'K',
	'Contrast_EVI_Hetero_1km': 'L',
	'CorFragVolPerc_15cm': 'M',
	'Correlation_EVI_Hetero_1km': 'N',
	'Depth_to_Bedrock': 'O',
	'Dissimilarity_EVI_Hetero_1km': 'P',
	'EVI': 'Q',
	'Entropy_EVI_Hetero_1km': 'R',
	'Evenness_EVI_Hetero_1km': 'S',
	'Fpar': 'T',
	'Fungivores': 'U',
	'Global_Biomass_IPCC': 'V',
	'Gpp': 'W',
	'Highest_Weekly_Radiation': 'X',
	'Homogeneity_EVI_Hetero_1km': 'Y',
	'Human_Development': 'Z',
	'Isothermality': 'AA',
	'Lai': 'AB',
	'Lowest_Weekly_Radiation': 'AC',
	'Max_Temperature_of_Warmest_Month': 'AD',
	'Maximum_EVI_Hetero_1km': 'AE',
	'Mean_Diurnal_Range': 'AF',
	'Mean_Temperature_of_Coldest_Quarter': 'AG',
	'Mean_Temperature_of_Driest_Quarter': 'AH',
	'Mean_Temperature_of_Warmest_Quarter': 'AI',
	'Mean_Temperature_of_Wettest_Quarter': 'AJ',
	'Min_Temperature_of_Coldest_Month': 'AK',
	'NDVI': 'AL',
	'Nadir_Reflectance_Band1': 'AM',
	'Nadir_Reflectance_Band2': 'AN',
	'Nadir_Reflectance_Band3': 'AO',
	'Nadir_Reflectance_Band4': 'AP',
	'Nadir_Reflectance_Band5': 'AQ',
	'Nadir_Reflectance_Band6': 'AR',
	'Nadir_Reflectance_Band7': 'AS',
	'Npp': 'AT',
	'Omnivores': 'AU',
	'OrgCStockTHa_0to15cm': 'AV',
	'PET': 'AW',
	'Pixel_Lat': 'AX',
	'Pixel_Long': 'AY',
	'Plant_feed': 'AZ',
	'Population_Density': 'BA',
	'Precipitation_Seasonality': 'BB',
	'Precipitation_of_Coldest_Quarter': 'BC',
	'Precipitation_of_Driest_Month': 'BD',
	'Precipitation_of_Driest_Quarter': 'BE',
	'Precipitation_of_Warmest_Quarter': 'BF',
	'Precipitation_of_Wettest_Month': 'BG',
	'Precipitation_of_Wettest_Quarter': 'BH',
	'PredProb_of_R_Horizon': 'BI',
	'Predators': 'BJ',
	'Radiation_Seasonality': 'BK',
	'Radiation_of_Coldest_Quarter': 'BL',
	'Radiation_of_Driest_Quarter': 'BM',
	'Radiation_of_Warmest_Quarter': 'BN',
	'Radiation_of_Wettest_Quarter': 'BO',
	'Range_EVI_Hetero_1km': 'BP',
	'Sand_Content_15cm': 'BQ',
	'Shannon_Index_1km': 'BR',
	'Silt_Content_15cm': 'BS',
	'Simpson_Index_1km': 'BT',
	'Std_EVI_Hetero_1km': 'BU',
	'Temperature_Annual_Range': 'BV',
	'Temperature_Seasonality': 'BW',
	'Total_Numb': 'BX',
	'Unidentifi': 'BY',
	'Uniformity_EVI_Hetero_1km': 'BZ',
	'Variance_EVI_Hetero_1km': 'CA',
	'eastness': 'CB',
	'elevation': 'CC',
	'hillshade': 'CD',
	'northness': 'CE',
	'pHinHOX_15cm': 'CF',
	'slope': 'CG'
});
var keys = placeHolderNameDict.keys();
var values = placeHolderNameDict.values();

// Replace the placeholder names with the full names
var fcWithFullNames = nematodeTablePlaceholders.select(values, keys);
// print(fcWithFullNames.limit(5));

/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/
// !! Input the composite being used (with the matching variable/band names)
var originalBandNames = compositeToUse.bandNames();
var finalBandsToUse = originalBandNames.removeAll(['Abs_Lat', 'Pixel_Long', 'Pixel_Lat', 'Fpar', 'Lai']);
// print('Band Names for Int/Ext analysis',finalBandsToUse);

// Create a feature collection with only the values from the image bands
// !! Input the final feature collection of points (with the sampled properties from the image) here
var fcForMinMax = fcWithFullNames.select(finalBandsToUse);
// print(fcForMinMax.limit(5));

// Create a final list of properties
var propertiesToUse = ee.Feature(fcForMinMax.toList(1).get(0)).propertyNames().remove('system:index');

// Map across every band of the collection to get the min and max values

// Make a FC with the band names for better parallelization
var fcWithBandNames = finalBandsToUse.map(function(bN) {
	return ee.Feature(ee.Geometry.Point([0, 0])).set('BandName', bN)
});

var fcWithMinMaxValues = ee.FeatureCollection(fcWithBandNames).map(function(fOI) {
	var bandBeingComputed = ee.Feature(fOI).get('BandName');
	var maxValueToSet = fcForMinMax.reduceColumns(ee.Reducer.minMax(), [bandBeingComputed]);
	return ee.Feature(fOI).set('MaxValue', maxValueToSet.get('max')).set('MinValue', maxValueToSet.get('min'));
});

Export.table.toAsset({
	collection: fcWithMinMaxValues,
	description: '20190204_Nematode_MinMax_Values',
	assetId: 'users/devinrouth/ETH_Nematodes/Nematode_Samples/20190204_Nematode_MinMax_Values',
});

// Import the prepped / exported feature collection
var fcPrepped = ee.FeatureCollection('users/devinrouth/ETH_Nematodes/Nematode_Samples/20190204_Nematode_MinMax_Values');
// var fcPrepped = fcWithMinMaxValues;
// print("Feature collection with computed Min/Max Values",fcPrepped);

// Make two images from these values (a min and a max image)
var nameValueList = fcPrepped.reduceColumns(ee.Reducer.toList(), ['BandName']).get('list');
var maxValuesWNulls = fcPrepped.toList(100).map(function(f) {
	return ee.Feature(f).get('MaxValue')
});
var maxDict = ee.Dictionary.fromLists(nameValueList, maxValuesWNulls);
var minValuesWNulls = fcPrepped.toList(100).map(function(f) {
	return ee.Feature(f).get('MinValue')
});
var minDict = ee.Dictionary.fromLists(nameValueList, minValuesWNulls);
var minImage = minDict.toImage();
Map.addLayer(minImage, {}, 'minImage Image', false);
var maxImage = maxDict.toImage();
Map.addLayer(maxImage, {}, 'maxImage Image', false);

// Select the bands from the composite to match the properties of the FC
var compForExtInt = compositeToUse.select(finalBandsToUse);
Map.addLayer(compForExtInt, {}, 'Composite', false);

// Finalize the new percentile images

// All bands image
var totalBandsBinary = compForExtInt.gt(minImage.select(finalBandsToUse)).and(compForExtInt.lt(maxImage.select(finalBandsToUse)));
Map.addLayer(totalBandsBinary, {}, 'Binary Image to Sum', false);
var totalBandsPercentage = totalBandsBinary.reduce('sum').divide(compForExtInt.bandNames().length());
// print(totalBandsBinary)

// Display the maps
var royGBIV = ['d10000', 'ff6622', 'ffda21', '33dd00', '1133cc', '220066', '330044'];
Map.addLayer(totalBandsPercentage, {
	palette: royGBIV,
	min: 0,
	max: 1
}, 'Percentile Image - All Bands', false);

// Create a bounding rectangle for the entire planet to use when exporting the image
var unboundedGeo = ee.Geometry.Polygon([-180, 88, 0, 88, 180, 88, 180, -88, 0, -88, -180, -88], null, false);

Export.image.toDrive({
	image: totalBandsPercentage,
	description: '20190205_Nematode_IntExt_Map',
	fileNamePrefix: '20190205_Nematode_IntExt_Map',
	folder: '20190205_Nematode_IntExt_Map',
	region: unboundedGeo,
	crs: 'EPSG:4326',
	crsTransform: [0.008333333333333333, 0, -180, 0, -0.008333333333333333, 90],
	maxPixels: 1e13
});

/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/
// Compute the percentage of interpolated pixels across the world per band

// Make an unbounded geometry for reductions
var unboundedGeo = ee.Geometry.Rectangle([-180, -90, 180, 90], "EPSG:4326", false);


// Find the total non-null pixels per band
var nonNullPixelCount = compForExtInt.reduceRegion({
	reducer: 'count',
	geometry: unboundedGeo,
	scale: 927.6624232772797,
	maxPixels: 1e13,
	tileScale: 16
});

Export.table.toAsset({
	collection: ee.FeatureCollection(ee.Feature(ee.Geometry.Point([0, 0])).set(nonNullPixelCount)),
	description: '20190204_Nematode_Total_Pixel_Counts',
	assetId: 'users/devinrouth/ETH_Nematodes/Nematode_Samples/20190204_Nematode_Total_Pixel_Counts'
});

var nonNullPixelCountsPerBand = ee.Feature(ee.FeatureCollection('users/devinrouth/ETH_Nematodes/Nematode_Samples/20190204_Nematode_Total_Pixel_Counts')
	.toList(1).get(0)).toDictionary();
print('Non Null Pixel Counts across all bands', nonNullPixelCountsPerBand);
// print(nonNullPixelCountsPerBand.toArray());


// Compute the total number of pixels interpolated for the total bands image

// All bands pixel count
var totalBandsIntPixelCount = totalBandsBinary.reduceRegion({
	reducer: 'sum',
	geometry: unboundedGeo,
	scale: 927.6624232772797,
	maxPixels: 1e13,
	tileScale: 16
});

Export.table.toAsset({
	collection: ee.FeatureCollection(ee.Feature(ee.Geometry.Point([0, 0])).set(totalBandsIntPixelCount)),
	description: '20190204_Nematode_AllBandsInt_Pixel_Counts',
	assetId: 'users/devinrouth/ETH_Nematodes/Nematode_Samples/20190204_Nematode_AllBandsInt_Pixel_Counts'
});

var allBandsPixelIntCount = ee.Feature(ee.FeatureCollection('users/devinrouth/ETH_Nematodes/Nematode_Samples/20190204_Nematode_AllBandsInt_Pixel_Counts')
	.toList(1).get(0)).toDictionary();
print('Interpolated Pixel Counts across all bands', allBandsPixelIntCount);
// print(allBandsPixelIntCount.toArray());


// Compute the percentage of interpolated pixels per band
var percentOfInterpolatedPixels = (allBandsPixelIntCount.toArray()).divide(nonNullPixelCountsPerBand.toArray());
print('Percent of interpolated pixels per band', ee.Dictionary.fromLists(allBandsPixelIntCount.keys(), percentOfInterpolatedPixels.toList()));


// Compute histograms of the interpolation images, showing how many pixels are covered by particular percentages

// All bands histogram
var totalBandsIntHistogram = totalBandsPercentage.reduceRegion({
	reducer: ee.Reducer.fixedHistogram(0, 1, 10),
	geometry: unboundedGeo,
	scale: 927.6624232772797,
	maxPixels: 1e13,
	tileScale: 16
});

// Convert the histogram to a dictionary for export purposes
var keysForDict_AllBands = ee.Array(totalBandsIntHistogram.get('sum')).slice(1, 0, 1).multiply(100).round().int().toList().flatten().map(function(n) {
	return ee.String('PercentBin_').cat(ee.String(n))
});
var valuesForDictNonNorm_AllBands = ee.Array(totalBandsIntHistogram.get('sum')).slice(1, 1, 2).project([0]);
var summedValues_AllBands = ee.Array(valuesForDictNonNorm_AllBands).project([0]).reduce('sum', [0]).repeat(0, keysForDict_AllBands.length());
var valuesForDict_AllBands = valuesForDictNonNorm_AllBands.divide(summedValues_AllBands).toList().flatten();
var dictForExportAllBands = ee.Dictionary.fromLists(keysForDict_AllBands, valuesForDict_AllBands);

Export.table.toAsset({
	collection: ee.FeatureCollection(ee.Feature(ee.Geometry.Point([0, 0])).set(dictForExportAllBands)),
	description: '20190205_Nematode_TotalBandsInt_Histogram',
	assetId: 'users/devinrouth/ETH_Nematodes/Nematode_Samples/20190205_Nematode_TotalBandsInt_Histogram'
});

var finalizedHistogram_AllBands = ee.FeatureCollection('users/devinrouth/ETH_Nematodes/Nematode_Samples/20190205_Nematode_TotalBandsInt_Histogram');
print('Histogram of interpolation across all bands', finalizedHistogram_AllBands);
