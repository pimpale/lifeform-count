// Print info on the points and display them (optionally)
// print(sampledNematodePoints);
// Map.addLayer(sampledNematodePoints);

// Correct the floating point issue with the WWF Biome integers
var collToBootsrap = sampledNematodePoints.map(function(f) {
	return ee.Feature(null).set('WWF_Biome', ee.Number(f.get('WWF_Biome')).round()).copyProperties({
		source: f,
		exclude: ['WWF_Biome']
	});
});

// Instantiate a classifier of interest
var randomForestClassifier = ee.Classifier.randomForest({
	numberOfTrees: 300,
	variablesPerSplit: 3,
	bagFraction: 0.632,
	seed: 1
}).setOutputMode('REGRESSION');


// Make a list of covariates to use
var covarsToUse = sampledNematodePoints.first().propertyNames().removeAll(['Total_Numb',
	'system:index',
	'Pixel_Long',
	'Pixel_Lat',
	'WWF_Biome'
]);
// print('Covariates being used', covarsToUse);

// Input the name of the property being modelled
var propToModel = 'Total_Numb';

// Input the name of the stratification variable
var stratVariable = 'WWF_Biome';

// Make a list of seeds to use for the bootstrapping
function JSsequence(i) {
	return i ? JSsequence(i - 1).concat(i) : []
}
var numberOfSubsets = 2;
var seedsForBootstrapping = JSsequence(numberOfSubsets);

// Create an unbounded geometry for exports
var unboundedGeo = ee.Geometry.Polygon([-180, 88, 0, 88, 180, 88, 180, -88, 0, -88, -180, -88], null, false);

// Boostrap the collection before training the classififers, then apply the classifier to create
// the bootstrapped images

// Input a base image name for exporting and organizational purposes
var bootstrapFileName = 'Nematode_Bootstrap_';

// Input the recipient image collection path
// !! Please contact Devin Routh at the Crowther Lab for the specific path used in this analysis
var recipientImageCollectionPath = 'XXXX';

// Load the bootstrap function
var bootStrap = require('users/devinrouth/toolbox:Stratified_Bootstrap_FeatureCollection.js');

// Make a function to pad numbers with leading zeroes for formatting purposes
function pad(num, size) {
	var s = num + "";
	while (s.length < size) s = "0" + s;
	return s;
}

// seedsForBootstrapping.map(function(seedToUse) {

// 	var boostrapSampleForTraining = bootStrap.makeStratBootStrapFeatureCollection(collToBootsrap,stratVariable, 100, seedToUse);

// 	// Train the classifers with the sampled points
// 	var trainedBootstrapClassifier = randomForestClassifier.train({
// 		features: boostrapSampleForTraining,
// 		classProperty: propToModel,
// 		inputProperties: covarsToUse
// 	});

// 	// Apply the classifier to the composite to make the final map
// 	var bootstrapImage = compositeToUse.select(covarsToUse).classify(trainedBootstrapClassifier);

// 	// Export the image
// 	Export.image.toAsset({
// 		image: bootstrapImage,
// 		description: bootstrapFileName + pad(seedToUse,2),
// 		assetId: recipientImageCollectionPath + '/' + bootstrapFileName + pad(seedToUse,2),
// 		region: unboundedGeo,
// 		crs: 'EPSG:4326',
// 		crsTransform: [0.008333333333333333, 0, -180, 0, -0.008333333333333333, 90],
// 		maxPixels: 1e13
// 	});

// });


// Once the boostrap iterations are complete, run the upper and lower confidence interval bounds
// (assuming a non-parametric bootstrap)
print('Bootstrap Iterations Collection', bootsrapIterations);

var upperLowerCIImage = bootsrapIterations.reduce({
	reducer: ee.Reducer.percentile([2.5, 97.5], ['lower', 'upper'])
});

// Export the image
Export.image.toAsset({
	image: upperLowerCIImage,
	description: 'Boostrapped_Confidence_Interval_Image',
	assetId: 'users/devinrouth/ETH_Nematodes/Nematode_ConfidenceIntervals/Nematode_Confidence_Interval_Image',
	region: unboundedGeo,
	crs: 'EPSG:4326',
	crsTransform: [0.008333333333333333, 0, -180, 0, -0.008333333333333333, 90],
	maxPixels: 1e13
});
