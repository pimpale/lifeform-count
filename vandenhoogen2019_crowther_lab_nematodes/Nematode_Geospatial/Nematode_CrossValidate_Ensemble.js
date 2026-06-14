// This script cross validates ensembles of random forest models for each
// nematode functional group

/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/
// Prepare the feature collection of nematode points

// This code chunk prepares this table for input into the k-fold CV function

// Instantiate a dictionary that translates the placeholder names
// to the actual band names from the composite image
// !! Taken from the "ChangeCSVColumnNamesBeforeShapefile.ipynb" file
var placeHolderNameDict = ee.Dictionary({'Abs_Lat': 'A', 'Annual_Mean_Radiation': 'B', 'Annual_Mean_Temperature': 'C', 'Annual_Precipitation': 'D', 'Aridity_Index': 'E', 'Bacterivor': 'F', 'Bulk_Density_15cm': 'G', 'CContent_15cm': 'H', 'CatIonExcCap_15cm': 'I', 'Clay_Content_15cm': 'J', 'CoOfVar_EVI_Hetero_1km': 'K', 'Contrast_EVI_Hetero_1km': 'L', 'CorFragVolPerc_15cm': 'M', 'Correlation_EVI_Hetero_1km': 'N', 'Depth_to_Bedrock': 'O', 'Dissimilarity_EVI_Hetero_1km': 'P', 'EVI': 'Q', 'Entropy_EVI_Hetero_1km': 'R', 'Evenness_EVI_Hetero_1km': 'S', 'Fpar': 'T', 'Fungivores': 'U', 'Global_Biomass_IPCC': 'V', 'Gpp': 'W', 'Highest_Weekly_Radiation': 'X', 'Homogeneity_EVI_Hetero_1km': 'Y', 'Human_Development': 'Z', 'Isothermality': 'AA', 'Lai': 'AB', 'Lowest_Weekly_Radiation': 'AC', 'Max_Temperature_of_Warmest_Month': 'AD', 'Maximum_EVI_Hetero_1km': 'AE', 'Mean_Diurnal_Range': 'AF', 'Mean_Temperature_of_Coldest_Quarter': 'AG', 'Mean_Temperature_of_Driest_Quarter': 'AH', 'Mean_Temperature_of_Warmest_Quarter': 'AI', 'Mean_Temperature_of_Wettest_Quarter': 'AJ', 'Min_Temperature_of_Coldest_Month': 'AK', 'NDVI': 'AL', 'Nadir_Reflectance_Band1': 'AM', 'Nadir_Reflectance_Band2': 'AN', 'Nadir_Reflectance_Band3': 'AO', 'Nadir_Reflectance_Band4': 'AP', 'Nadir_Reflectance_Band5': 'AQ', 'Nadir_Reflectance_Band6': 'AR', 'Nadir_Reflectance_Band7': 'AS', 'Npp': 'AT', 'Omnivores': 'AU', 'OrgCStockTHa_0to15cm': 'AV', 'PET': 'AW', 'Pixel_Lat': 'AX', 'Pixel_Long': 'AY', 'Plant_feed': 'AZ', 'Population_Density': 'BA', 'Precipitation_Seasonality': 'BB', 'Precipitation_of_Coldest_Quarter': 'BC', 'Precipitation_of_Driest_Month': 'BD', 'Precipitation_of_Driest_Quarter': 'BE', 'Precipitation_of_Warmest_Quarter': 'BF', 'Precipitation_of_Wettest_Month': 'BG', 'Precipitation_of_Wettest_Quarter': 'BH', 'PredProb_of_R_Horizon': 'BI', 'Predators': 'BJ', 'Radiation_Seasonality': 'BK', 'Radiation_of_Coldest_Quarter': 'BL', 'Radiation_of_Driest_Quarter': 'BM', 'Radiation_of_Warmest_Quarter': 'BN', 'Radiation_of_Wettest_Quarter': 'BO', 'Range_EVI_Hetero_1km': 'BP', 'Sand_Content_15cm': 'BQ', 'Shannon_Index_1km': 'BR', 'Silt_Content_15cm': 'BS', 'Simpson_Index_1km': 'BT', 'Std_EVI_Hetero_1km': 'BU', 'Temperature_Annual_Range': 'BV', 'Temperature_Seasonality': 'BW', 'Total_Numb': 'BX', 'Unidentifi': 'BY', 'Uniformity_EVI_Hetero_1km': 'BZ', 'Variance_EVI_Hetero_1km': 'CA', 'eastness': 'CB', 'elevation': 'CC', 'hillshade': 'CD', 'northness': 'CE', 'pHinHOX_15cm': 'CF', 'slope': 'CG'});
var keys = placeHolderNameDict.keys();
// print('Placeholder Keys',keys);
var values = placeHolderNameDict.values();
// print('Placeholder Values',values);

// Replace the placeholder names with the full names
var fcWithFullNames = nematodeTablePlaceholders.select(values, keys);
// print('Original Table',nematodeTablePlaceholders.limit(5));
// print('Table with New Names',fcWithFullNames.limit(5));
var collToFilter = fcWithFullNames;


// Filter the data for the particular property
// Total_Numb
// Bacterivor
// Fungivores
// Omnivores
// Plant_feed
// Predators
// Unidentifi
var pOI = 'Unidentifi';
var filteredColl = collToFilter.filterMetadata(pOI, 'not_equals', null);

var inputtedFeatureCollection = filteredColl.select(pOI);
print('Sample Points', inputtedFeatureCollection.limit(5));
print('Size of Sample Collection', inputtedFeatureCollection.size());
Map.addLayer(inputtedFeatureCollection, {}, "Nematode Points being sampled");


// Input the drive folder in which to send the results
// 20180720_Bacterivore_CV_Ensemble
// 20180720_Fungivore_CV_Ensemble
// 20180720_Omnivore_CV_Ensemble
// 20180720_Herbivore_CV_Ensemble
// 20180720_Predator_CV_Ensemble
// 20180720_Unidentified_CV_Ensemble
var driveFolderOI = '20180720_Unidentified_CV_Ensemble';

// Input the name of the file 
var nematodeFileName = '20180720_Unidentified_CV_Ensemble';

// Input the lists of variables
var listOfVars = ['NDVI','EVI','Gpp','Npp','Nadir_Reflectance_Band1','Nadir_Reflectance_Band2','Nadir_Reflectance_Band3','Nadir_Reflectance_Band4','Nadir_Reflectance_Band5','Nadir_Reflectance_Band6','Nadir_Reflectance_Band7','Aridity_Index','PET','Global_Biomass_IPCC','elevation','slope','hillshade','northness','eastness','Annual_Mean_Temperature','Mean_Diurnal_Range','Isothermality','Temperature_Seasonality','Max_Temperature_of_Warmest_Month','Min_Temperature_of_Coldest_Month','Temperature_Annual_Range','Mean_Temperature_of_Wettest_Quarter','Mean_Temperature_of_Driest_Quarter','Mean_Temperature_of_Warmest_Quarter','Mean_Temperature_of_Coldest_Quarter','Annual_Precipitation','Precipitation_of_Wettest_Month','Precipitation_of_Driest_Month','Precipitation_Seasonality','Precipitation_of_Wettest_Quarter','Precipitation_of_Driest_Quarter','Precipitation_of_Warmest_Quarter','Precipitation_of_Coldest_Quarter','Population_Density','Depth_to_Bedrock','PredProb_of_R_Horizon','Bulk_Density_15cm','CatIonExcCap_15cm','Clay_Content_15cm','CorFragVolPerc_15cm','OrgCStockTHa_0to15cm','CContent_15cm','pHinHOX_15cm','Silt_Content_15cm','Sand_Content_15cm','CoOfVar_EVI_Hetero_1km','Contrast_EVI_Hetero_1km','Correlation_EVI_Hetero_1km','Dissimilarity_EVI_Hetero_1km','Entropy_EVI_Hetero_1km','Evenness_EVI_Hetero_1km','Homogeneity_EVI_Hetero_1km','Maximum_EVI_Hetero_1km','Range_EVI_Hetero_1km','Shannon_Index_1km','Simpson_Index_1km','Std_EVI_Hetero_1km','Uniformity_EVI_Hetero_1km','Variance_EVI_Hetero_1km','Annual_Mean_Radiation','Highest_Weekly_Radiation','Lowest_Weekly_Radiation','Radiation_Seasonality','Radiation_of_Wettest_Quarter','Radiation_of_Driest_Quarter','Radiation_of_Warmest_Quarter','Radiation_of_Coldest_Quarter','Human_Development'];

// Define the composite of interest to sample / classify (with selected covariates)
var imageToClassify = compositeOfInterest.select(listOfVars);


// Define K
var k = 10;

// Define the property to model / predict
var propertyToPredictAsString = pOI;

// Define the scale of the image (in meters)
var scaleToSample = 927.6624232772797;
// print('Scale to Sample',compositeOfInterest.projection().nominalScale());

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

// Input a list of classifier weights (input all 1's if doing a standard average/mean)
var listOfClassifierWeights = [
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1
  ];

// Input the "gap fill" distance
var gapFillDistance = 10000;


// Input the list of kernels to use
var convolutionKernel = ee.Kernel.square({radius:0,units:'pixels',normalize:true});


// Call the function
var KFoldCrossValConvolveGapFill = require('users/devinrouth/toolbox:KFoldCrossValConvolveGapFillEnsemble.js');

var kFoldCVResults = KFoldCrossValConvolveGapFill.KFoldCrossValConvolveGapFill(inputtedFeatureCollection,
                                                                               imageToClassify,
                                                                               k,
                                                                               listOfClassifiers,
                                                                               listOfClassifierWeights,
                                                                               propertyToPredictAsString,
                                                                               scaleToSample,
                                                                               convolutionKernel,
                                                                               gapFillDistance);
// print('k-Fold Cross Validation Results', kFoldCVResults);

// Export the results
Export.table.toDrive({collection:kFoldCVResults,description:nematodeFileName,fileNamePrefix:nematodeFileName});
