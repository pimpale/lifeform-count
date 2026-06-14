/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/
// The following script creates a final nematode map based on the results
// of the cross validation

// It maps through a list of classifers (with their names) to create
// a series of images that can then be ensembled (via their parent
// image collection, which should be created beforehand)


/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/
// Prepare the feature collection of nematode points

// This code chunk prepares this table for input into the k-fold CV function

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
// print('Placeholder Keys',keys);
var values = placeHolderNameDict.values();
// print('Placeholder Values',values);

// Replace the placeholder names with the full names
var fcWithFullNames = nematodeTablePlaceholders.select(values, keys);
// print('Original Table',nematodeTablePlaceholders.limit(5));
// print('Table with New Names',fcWithFullNames.limit(5));

var collToFilter = fcWithFullNames;
print('Raw Sample Points', collToFilter.limit(5));
print('Size of Raw Sample Collection', collToFilter.size());
Map.addLayer(collToFilter, {}, "Nematode Points being filtered",false);

// Filter the data for the particular property
// Total_Numb
// Bacterivor
// Fungivores
// Omnivores
// Plant_feed
// Predators
// Unidentifi
var pOI = 'Unidentifi';
var filteredColl = collToFilter.filterMetadata(pOI, 'not_equals', null).select(pOI);
print('Filtered Sample Points', filteredColl.limit(5));
print('Size of Filtered Sample Collection', filteredColl.size());
Map.addLayer(filteredColl, {}, "Filtered Nematode Points",false);


// Input the name of the recipient image collection
// ETH_Nematodes/Nematode_Ensembles/20180720_Total_Number_Ensemble
// ETH_Nematodes/Nematode_Ensembles/20180720_Bacterivores_Ensemble
// ETH_Nematodes/Nematode_Ensembles/20180720_Fungivores_Ensemble
// ETH_Nematodes/Nematode_Ensembles/20180720_Omnivores_Ensemble
// ETH_Nematodes/Nematode_Ensembles/20180720_Herbivores_Ensemble
// ETH_Nematodes/Nematode_Ensembles/20180720_Predators_Ensemble
// ETH_Nematodes/Nematode_Ensembles/20180720_Unidentified_Ensemble

var pathOfParentIC = '20180720_Unidentified_Ensemble';


// Input the prepared feature collection
var inputtedFeatureCollection = filteredColl;

/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/

// Input the list of variables to select from the image and from the FC
var listOfVars = ['NDVI','EVI','Gpp','Npp','Nadir_Reflectance_Band1','Nadir_Reflectance_Band2','Nadir_Reflectance_Band3','Nadir_Reflectance_Band4','Nadir_Reflectance_Band5','Nadir_Reflectance_Band6','Nadir_Reflectance_Band7','Aridity_Index','PET','Global_Biomass_IPCC','elevation','slope','hillshade','northness','eastness','Annual_Mean_Temperature','Mean_Diurnal_Range','Isothermality','Temperature_Seasonality','Max_Temperature_of_Warmest_Month','Min_Temperature_of_Coldest_Month','Temperature_Annual_Range','Mean_Temperature_of_Wettest_Quarter','Mean_Temperature_of_Driest_Quarter','Mean_Temperature_of_Warmest_Quarter','Mean_Temperature_of_Coldest_Quarter','Annual_Precipitation','Precipitation_of_Wettest_Month','Precipitation_of_Driest_Month','Precipitation_Seasonality','Precipitation_of_Wettest_Quarter','Precipitation_of_Driest_Quarter','Precipitation_of_Warmest_Quarter','Precipitation_of_Coldest_Quarter','Population_Density','Depth_to_Bedrock','PredProb_of_R_Horizon','Bulk_Density_15cm','CatIonExcCap_15cm','Clay_Content_15cm','CorFragVolPerc_15cm','OrgCStockTHa_0to15cm','CContent_15cm','pHinHOX_15cm','Silt_Content_15cm','Sand_Content_15cm','CoOfVar_EVI_Hetero_1km','Contrast_EVI_Hetero_1km','Correlation_EVI_Hetero_1km','Dissimilarity_EVI_Hetero_1km','Entropy_EVI_Hetero_1km','Evenness_EVI_Hetero_1km','Homogeneity_EVI_Hetero_1km','Maximum_EVI_Hetero_1km','Range_EVI_Hetero_1km','Shannon_Index_1km','Simpson_Index_1km','Std_EVI_Hetero_1km','Uniformity_EVI_Hetero_1km','Variance_EVI_Hetero_1km','Annual_Mean_Radiation','Highest_Weekly_Radiation','Lowest_Weekly_Radiation','Radiation_Seasonality','Radiation_of_Wettest_Quarter','Radiation_of_Driest_Quarter','Radiation_of_Warmest_Quarter','Radiation_of_Coldest_Quarter','Human_Development'];

// Choose the bands of interest from the composite
var compositeToClassify = compositeOfInterest.select(listOfVars);


// Input the name of the property of interest
var propertyToPredictAsString = pOI;

// Input a list of classifier namess with provided tunning parameters
var listOfClassifiers = [
	ee.Classifier.randomForest({
		numberOfTrees: 500,
		variablesPerSplit: 3,
		bagFraction: 0.632,
		seed: 1
	}).setOutputMode('REGRESSION'),
	ee.Classifier.randomForest({
		numberOfTrees: 500,
		variablesPerSplit: 3,
		bagFraction: 0.632,
		seed: 2
	}).setOutputMode('REGRESSION'),
	ee.Classifier.randomForest({
		numberOfTrees: 500,
		variablesPerSplit: 3,
		bagFraction: 0.632,
		seed: 3
	}).setOutputMode('REGRESSION'),
	ee.Classifier.randomForest({
		numberOfTrees: 500,
		variablesPerSplit: 3,
		bagFraction: 0.632,
		seed: 4
	}).setOutputMode('REGRESSION'),
	ee.Classifier.randomForest({
		numberOfTrees: 500,
		variablesPerSplit: 3,
		bagFraction: 0.632,
		seed: 5
	}).setOutputMode('REGRESSION'),
	ee.Classifier.randomForest({
		numberOfTrees: 500,
		variablesPerSplit: 3,
		bagFraction: 0.632,
		seed: 6
	}).setOutputMode('REGRESSION'),
	ee.Classifier.randomForest({
		numberOfTrees: 500,
		variablesPerSplit: 3,
		bagFraction: 0.632,
		seed: 7
	}).setOutputMode('REGRESSION'),
	ee.Classifier.randomForest({
		numberOfTrees: 500,
		variablesPerSplit: 3,
		bagFraction: 0.632,
		seed: 8
	}).setOutputMode('REGRESSION'),
	ee.Classifier.randomForest({
		numberOfTrees: 500,
		variablesPerSplit: 3,
		bagFraction: 0.632,
		seed: 9
	}).setOutputMode('REGRESSION'),
	ee.Classifier.randomForest({
		numberOfTrees: 500,
		variablesPerSplit: 3,
		bagFraction: 0.632,
		seed: 0
	}).setOutputMode('REGRESSION'),

];


// Input a list of names for the classifiers (must be the same length as the classifier list)
var classifierNameList = ['RF_nTrees500_vps03_BF632_seed1',
	'RF_nTrees500_vps03_BF632_seed2',
	'RF_nTrees500_vps03_BF632_seed3',
	'RF_nTrees500_vps03_BF632_seed4',
	'RF_nTrees500_vps03_BF632_seed5',
	'RF_nTrees500_vps03_BF632_seed6',
	'RF_nTrees500_vps03_BF632_seed7',
	'RF_nTrees500_vps03_BF632_seed8',
	'RF_nTrees500_vps03_BF632_seed9',
	'RF_nTrees500_vps03_BF632_seed0'
];


// Input the list of kernels to use
var kernelToUse = ee.Kernel.square({
	radius: 0,
	units: 'pixels',
	normalize: true
});
// print('List of Kernels',listOfKernels);


// Create a bounding box for the map export
var unboundedGeo = ee.Geometry.Polygon([-180, 88, 0, 88, 180, 88, 180, -88, 0, -88, -180, -88], null, false);




/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/
// Map over the list of classifiers and export the images to parent image collections
listOfClassifiers.map(function(classifierOfChoice) {
  
  // Gap fill the composite image
  var gapFillAndExtendBounds = require('users/devinrouth/toolbox:GapFillAndExtendBounds.js');
  var filledImage = gapFillAndExtendBounds.gapFillAndExtendBounds(compositeToClassify,compositeToClassify.bandNames(),10000);
	
	// Sample the image
	var trainingData = filledImage.sampleRegions(inputtedFeatureCollection);
	
	// Classify and (attempt to) display the final image
	var finalClassifiedImage = compositeToClassify.classify(classifierOfChoice
			.train(trainingData, propertyToPredictAsString, filledImage.bandNames()));
			// .convolve(kernelToUse);


	// Retrieve the name of the image
	var nameOfEnsembleImage = classifierNameList[listOfClassifiers.indexOf(classifierOfChoice)];


	// Export the image of choice as an asset
	Export.image.toAsset({
		image: finalClassifiedImage,
		description: pathOfParentIC+'_'+nameOfEnsembleImage,
		assetId: 'users/devinrouth/ETH_Nematodes/Nematode_Ensembles/'+pathOfParentIC+'/'+pOI+'_'+nameOfEnsembleImage,
		region: unboundedGeo,
		crs:'EPSG:4326',
    crsTransform:[0.008333333333333333,0,-180,0,-0.008333333333333333,90],
		maxPixels: 1e12
	});

});
