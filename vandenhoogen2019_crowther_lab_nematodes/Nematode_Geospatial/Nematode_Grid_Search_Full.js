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

// Define the property to model / predict
var propertyToPredictAsString = 'Total_Numb';

// Finalize the selection of the property to sample and the input collection
var collToSample = fcWithFullNames;
var inputtedFeatureCollection = collToSample.select(propertyToPredictAsString);
print('Sample Points', inputtedFeatureCollection.limit(5));
print('Size of Sample Collection', inputtedFeatureCollection.size());
Map.addLayer(inputtedFeatureCollection, {}, "Nematode Points being sampled");

// Define the composite of interest to sample / classify
var imageToClassify = compositeOfInterest;

// Define K (for K-Fold cross validation)
var k = 10;

// Define the scale of the image (in meters)
var scaleToSample = 927.6624232772797;

// Input a list of classifier namess with provided tunning parameters
var listOfClassifiers = [
	ee.Classifier.randomForest({
		numberOfTrees: 300,
		variablesPerSplit: 3,
		bagFraction: 0.632,
		seed: 1
	}).setOutputMode('REGRESSION'),
		ee.Classifier.randomForest({
		numberOfTrees: 300,
		variablesPerSplit: 5,
		bagFraction: 0.632,
		seed: 1
	}).setOutputMode('REGRESSION'),
		ee.Classifier.randomForest({
		numberOfTrees: 300,
		variablesPerSplit: 6,
		bagFraction: 0.632,
		seed: 1
	}).setOutputMode('REGRESSION'),
		ee.Classifier.randomForest({
		numberOfTrees: 300,
		variablesPerSplit: 9,
		bagFraction: 0.632,
		seed: 1
	}).setOutputMode('REGRESSION'),
	ee.Classifier.randomForest({
		numberOfTrees: 300,
		variablesPerSplit: 10,
		bagFraction: 0.632,
		seed: 1
	}).setOutputMode('REGRESSION'),
		ee.Classifier.randomForest({
		numberOfTrees: 300,
		variablesPerSplit: 12,
		bagFraction: 0.632,
		seed: 1
	}).setOutputMode('REGRESSION'),
		ee.Classifier.randomForest({
		numberOfTrees: 300,
		variablesPerSplit: 15,
		bagFraction: 0.632,
		seed: 1
	}).setOutputMode('REGRESSION'),
		ee.Classifier.randomForest({
		numberOfTrees: 300,
		variablesPerSplit: 18,
		bagFraction: 0.632,
		seed: 1
	}).setOutputMode('REGRESSION'),
	ee.Classifier.randomForest({
		numberOfTrees: 300,
		variablesPerSplit: 20,
		bagFraction: 0.632,
		seed: 1
	}).setOutputMode('REGRESSION'),
	ee.Classifier.gmoLinearRegression({
		weight1: 0.1,
	}),
	ee.Classifier.gmoLinearRegression({
		weight1: 0.01,
	}),
	ee.Classifier.gmoLinearRegression({
		weight1: 0.001,
	}),
	ee.Classifier.gmoLinearRegression({
		weight2: 0.1,
	}),
	ee.Classifier.gmoLinearRegression({
		weight2: 0.01,
	}),
	ee.Classifier.gmoLinearRegression({
		weight2: 0.001,
	}),
];

// Input a list of names for the classifiers (must be the same length as the classifier list)
var classifierNameList = [
  'RF_nTrees300_vps03_BF632',
  'RF_nTrees300_vps05_BF632',
  'RF_nTrees300_vps06_BF632',
  'RF_nTrees300_vps09_BF632',
  'RF_nTrees300_vps10_BF632',
	'RF_nTrees300_vps12_BF632',
	'RF_nTrees300_vps15_BF632',
	'RF_nTrees300_vps18_BF632',
	'RF_nTrees300_vps20_BF632',
	'LinReg_W1_01',
	'LinReg_W1_001',
	'LinReg_W1_0001',
	'LinReg_W2_01',
	'LinReg_W2_001',
	'LinReg_W2_0001'
];


// Input the lists of variables to grid search
var listOfVarLists = 
  [
	["Lowest_Weekly_Radiation", "Min_Temperature_of_Coldest_Month", "Nadir_Reflectance_Band7", "Std_EVI_Hetero_1km", "Simpson_Index_1km"],
	["Lowest_Weekly_Radiation", "Min_Temperature_of_Coldest_Month", "Precipitation_of_Wettest_Quarter", "Nadir_Reflectance_Band7", "Sand_Content_15cm", "Std_EVI_Hetero_1km", "PredProb_of_R_Horizon", "Nadir_Reflectance_Band1", "Simpson_Index_1km", "hillshade"],
	["Lowest_Weekly_Radiation", "Min_Temperature_of_Coldest_Month", "Precipitation_of_Wettest_Quarter", "Precipitation_of_Driest_Quarter", "OrgCStockTHa_0to15cm", "Sand_Content_15cm", "Std_EVI_Hetero_1km", "PredProb_of_R_Horizon", "Nadir_Reflectance_Band1", "Simpson_Index_1km", "Human_Development", "Radiation_of_Warmest_Quarter", "Nadir_Reflectance_Band7", "Nadir_Reflectance_Band5", "hillshade"],
	["Lowest_Weekly_Radiation", "Min_Temperature_of_Coldest_Month", "Precipitation_of_Wettest_Quarter", "Precipitation_of_Driest_Quarter", "OrgCStockTHa_0to15cm", "Sand_Content_15cm", "Std_EVI_Hetero_1km", "PredProb_of_R_Horizon", "NDVI", "Simpson_Index_1km", "Global_Biomass_IPCC", "Radiation_of_Warmest_Quarter", "Nadir_Reflectance_Band7", "Nadir_Reflectance_Band4", "Nadir_Reflectance_Band5", "hillshade"],
	["Lowest_Weekly_Radiation", "Min_Temperature_of_Coldest_Month", "Precipitation_of_Wettest_Quarter", "Precipitation_of_Driest_Quarter", "OrgCStockTHa_0to15cm", "Std_EVI_Hetero_1km", "slope", "PredProb_of_R_Horizon", "NDVI", "Simpson_Index_1km", "Radiation_of_Warmest_Quarter", "Precipitation_Seasonality", "Nadir_Reflectance_Band4", "Nadir_Reflectance_Band5", "Nadir_Reflectance_Band7", "Silt_Content_15cm", "hillshade"],
	['Annual_Precipitation','Aridity_Index','Sand_Content_15cm','CatIonExcCap_15cm','OrgCStockTHa_0to15cm','NDVI','Annual_Mean_Temperature','Isothermality','Shannon_Index_1km','Precipitation_Seasonality','Temperature_Seasonality','pHinHOX_15cm','Nadir_Reflectance_Band1','Nadir_Reflectance_Band2','Nadir_Reflectance_Band3','Nadir_Reflectance_Band4','Nadir_Reflectance_Band5','Nadir_Reflectance_Band6','Nadir_Reflectance_Band7','Human_Development'],
	['Annual_Precipitation','Aridity_Index','Sand_Content_15cm','CatIonExcCap_15cm','OrgCStockTHa_0to15cm','NDVI','Annual_Mean_Temperature','Isothermality','Shannon_Index_1km','Precipitation_Seasonality','Temperature_Seasonality','pHinHOX_15cm','Nadir_Reflectance_Band1','Nadir_Reflectance_Band2','Nadir_Reflectance_Band3','Nadir_Reflectance_Band4','Nadir_Reflectance_Band5','Nadir_Reflectance_Band6','Nadir_Reflectance_Band7','Human_Development','Pixel_Lat','Pixel_Long'],
	['NDVI','EVI','Gpp','Npp','Nadir_Reflectance_Band1','Nadir_Reflectance_Band2','Nadir_Reflectance_Band3','Nadir_Reflectance_Band4','Nadir_Reflectance_Band5','Nadir_Reflectance_Band6','Nadir_Reflectance_Band7','Aridity_Index','PET','Global_Biomass_IPCC','elevation','slope','hillshade','northness','eastness','Annual_Mean_Temperature','Mean_Diurnal_Range','Isothermality','Temperature_Seasonality','Max_Temperature_of_Warmest_Month','Min_Temperature_of_Coldest_Month','Temperature_Annual_Range','Mean_Temperature_of_Wettest_Quarter','Mean_Temperature_of_Driest_Quarter','Mean_Temperature_of_Warmest_Quarter','Mean_Temperature_of_Coldest_Quarter','Annual_Precipitation','Precipitation_of_Wettest_Month','Precipitation_of_Driest_Month','Precipitation_Seasonality','Precipitation_of_Wettest_Quarter','Precipitation_of_Driest_Quarter','Precipitation_of_Warmest_Quarter','Precipitation_of_Coldest_Quarter','Population_Density','Depth_to_Bedrock','PredProb_of_R_Horizon','Bulk_Density_15cm','CatIonExcCap_15cm','Clay_Content_15cm','CorFragVolPerc_15cm','OrgCStockTHa_0to15cm','CContent_15cm','pHinHOX_15cm','Silt_Content_15cm','Sand_Content_15cm','CoOfVar_EVI_Hetero_1km','Contrast_EVI_Hetero_1km','Correlation_EVI_Hetero_1km','Dissimilarity_EVI_Hetero_1km','Entropy_EVI_Hetero_1km','Evenness_EVI_Hetero_1km','Homogeneity_EVI_Hetero_1km','Maximum_EVI_Hetero_1km','Range_EVI_Hetero_1km','Shannon_Index_1km','Simpson_Index_1km','Std_EVI_Hetero_1km','Uniformity_EVI_Hetero_1km','Variance_EVI_Hetero_1km','Annual_Mean_Radiation','Highest_Weekly_Radiation','Lowest_Weekly_Radiation','Radiation_Seasonality','Radiation_of_Wettest_Quarter','Radiation_of_Driest_Quarter','Radiation_of_Warmest_Quarter','Radiation_of_Coldest_Quarter','Human_Development'],
	['NDVI','EVI','Gpp','Npp','Nadir_Reflectance_Band1','Nadir_Reflectance_Band2','Nadir_Reflectance_Band3','Nadir_Reflectance_Band4','Nadir_Reflectance_Band5','Nadir_Reflectance_Band6','Nadir_Reflectance_Band7','Aridity_Index','PET','Global_Biomass_IPCC','elevation','slope','hillshade','northness','eastness','Annual_Mean_Temperature','Mean_Diurnal_Range','Isothermality','Temperature_Seasonality','Max_Temperature_of_Warmest_Month','Min_Temperature_of_Coldest_Month','Temperature_Annual_Range','Mean_Temperature_of_Wettest_Quarter','Mean_Temperature_of_Driest_Quarter','Mean_Temperature_of_Warmest_Quarter','Mean_Temperature_of_Coldest_Quarter','Annual_Precipitation','Precipitation_of_Wettest_Month','Precipitation_of_Driest_Month','Precipitation_Seasonality','Precipitation_of_Wettest_Quarter','Precipitation_of_Driest_Quarter','Precipitation_of_Warmest_Quarter','Precipitation_of_Coldest_Quarter','Population_Density','Depth_to_Bedrock','PredProb_of_R_Horizon','Bulk_Density_15cm','CatIonExcCap_15cm','Clay_Content_15cm','CorFragVolPerc_15cm','OrgCStockTHa_0to15cm','CContent_15cm','pHinHOX_15cm','Silt_Content_15cm','Sand_Content_15cm','CoOfVar_EVI_Hetero_1km','Contrast_EVI_Hetero_1km','Correlation_EVI_Hetero_1km','Dissimilarity_EVI_Hetero_1km','Entropy_EVI_Hetero_1km','Evenness_EVI_Hetero_1km','Homogeneity_EVI_Hetero_1km','Maximum_EVI_Hetero_1km','Range_EVI_Hetero_1km','Shannon_Index_1km','Simpson_Index_1km','Std_EVI_Hetero_1km','Uniformity_EVI_Hetero_1km','Variance_EVI_Hetero_1km','Annual_Mean_Radiation','Highest_Weekly_Radiation','Lowest_Weekly_Radiation','Radiation_Seasonality','Radiation_of_Wettest_Quarter','Radiation_of_Driest_Quarter','Radiation_of_Warmest_Quarter','Radiation_of_Coldest_Quarter','Human_Development','Pixel_Lat','Pixel_Long']
]
;

// Input the list of names for the variable lists (must be the same length as the variables list)
var listOfVarListNames = [
  'ClustOfVar5',
  'ClustOfVar10',
  'ClustOfVar15',
  'ClustOfVar20',
  'ClustOfVar25',
  'Selection',
  'Selection_wCoords',
  'AllCovars_sansCoords',
  'AllCovars_wCoords'
  ];

// Input the list of kernels to use
var listOfKernels = [
	ee.Kernel.square({
		radius: 0,
		units: 'pixels',
		normalize: true
	}),
	ee.Kernel.square({
		radius: 5,
		units: 'pixels',
		normalize: true
	}),
	ee.Kernel.square({
		radius: 10,
		units: 'pixels',
		normalize: true
	})
];
// print('List of Kernels',listOfKernels);

// Input the list of kernel names as strings (must be the same length as the list of Kernels)
var listOfKernelNames = [
  'square0',
  'square5',
  'square10'
];

// Input the drive folder in which to send the results
var driveFolderOI = '20180720_Nematode_GridSearch_FullModelRun';

/*————————————————————*/
// Call the function to grid search

var GridSearchWithCVConvolveGapFill = require('users/devinrouth/toolbox:GridSearchWithCVConvolveGapFill.js');

GridSearchWithCVConvolveGapFill.gridSearchWithCVConvolveGapFill(imageToClassify,
	inputtedFeatureCollection,
	propertyToPredictAsString,
	listOfVarLists,
	listOfVarListNames,
	listOfClassifiers,
	classifierNameList,
	listOfKernels,
	listOfKernelNames,
	scaleToSample,
	k,
	driveFolderOI);
