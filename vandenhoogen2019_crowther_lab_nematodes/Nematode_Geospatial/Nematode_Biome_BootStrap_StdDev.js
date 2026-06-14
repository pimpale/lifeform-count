// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// This script takes bootstrap samples across the WWF biomes in order
// to assess large scale variability of the outputted maps


// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Create a bounding rectangle for the entire planet to use when
// reducing "unbounded" images
var unboundedGeo = ee.Geometry.Polygon([-180, 88, 0, 88, 180, 88, 180, -88, 0, -88, -180, -88], null, false);

// Scale for reduction (in meters):927.6624232772797
var scaleForReduction = 927.6624232772797;

// Create single images (i.e., ensembles) for each of the collections
var imageToSample = ee.Image(totalColl.mean()).rename('Total').addBands(wwfBiomes.int());
print('Image to sample', imageToSample);

// Prep the biomes of interest
var biomeNumbers = ee.List([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);

// Make the "biome" features in which to record the produced information
var biomeFC = ee.FeatureCollection(biomeNumbers.map(function(biomeNum) {
	return ee.Feature(null).set('Biome', biomeNum);
}));
// print('Biome Feature Collection',biomeFC);

// Instantiate a list of bootstrap sample numbers
var sampleNumbers = ee.List([10, 25, 50, 75, 100, 150, 250, 500]);

// Make the "number" features in which to record the produced information
var numOfSamplesFC = ee.FeatureCollection(sampleNumbers.map(function(numOfSamples) {
	return ee.Feature(null).set('NumOfSamples', numOfSamples);
}));
// print('Number of Samples Collection',numOfSamplesFC);

// Create a list of random seeds to repeat the random sampling multiple times
var randomSeedList = ee.List.sequence(1, 100);

// Make the "seed" features in which to record the produced information
var randomSeedFC = ee.FeatureCollection(randomSeedList.map(function(seeds) {
	return ee.Feature(null).set('Seed', seeds);
}));
// print('Random Seed',randomSeedFC);



// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Create the data to export

// Map through the number of bootstrap samples to get the average SD per 
// number of samples
var bootStrapSampleFCToCombine = numOfSamplesFC.map(function(numOfSamplesFeat) {

	// Map through the biomes to take the average standard deviation across
	// the same random seed
	var averageSDOverAllSeeds = biomeFC.map(function(biomeFeature) {

		// Map through the random seeds to make a feature collection of feature collections
		// that needs flattening (and that can then be filtered)
		var featureCollToFilter = randomSeedFC.map(function(randomSeed) {

			// Sample the image
			var samplesFC = imageToSample.stratifiedSample({
				numPoints: numOfSamplesFeat.get('NumOfSamples'),
				classBand: 'WWF_Biome',
				scale: scaleForReduction,
				region: unboundedGeo,
				seed: randomSeed.get('Seed')
			});
			// print('Samples',samplesFC.aggregate_total_sd('Total'));

			// Map through the biome numbers to take average values for every biome
			var biomeFeaturesWithMeans = biomeFC.map(function(biomeFeature) {
				var filteredFC = samplesFC.filterMetadata('WWF_Biome', 'equals', biomeFeature.get('Biome'));

				var featureToReturn = biomeFeature.set('StandardDev', ee.Number(filteredFC.aggregate_total_sd('Total')));

				return featureToReturn;
			});
			// print('Features with StdDev values',biomeFeaturesWithMeans);

			return biomeFeaturesWithMeans;

		}).flatten();
		// print('Feature Collection to Filter',featureCollToFilter);

		// Filter for the biome and take the average of the standard deviation values
		var averageSDBiomeFeature = biomeFeature.set('StandarDev',
				ee.Number(featureCollToFilter.filterMetadata('Biome', 'equals', biomeFeature.get('Biome'))
					.aggregate_mean('StandardDev')))
			.set('NumOfSamples', ee.Number(numOfSamplesFeat.get('NumOfSamples')))
			.set('StdError',ee.Number(featureCollToFilter.filterMetadata('Biome', 'equals', biomeFeature.get('Biome'))
					.aggregate_mean('StandardDev')).divide(ee.Number(numOfSamplesFeat.get('NumOfSamples')).sqrt()));

		return averageSDBiomeFeature;

	});

	return averageSDOverAllSeeds;
}).flatten();
// print('BootstrapSampleSD Full', bootStrapSampleFCToCombine);


// Export the outputted data
Export.table.toDrive({
	collection: bootStrapSampleFCToCombine,
	folder: '20180731_Nematode_BootStrap_StdError',
	description: '20180731_Nematode_BootStrap_StdError_100Seeds',
	fileNamePrefix: '20180731_Nematode_BootStrap_StdError_100Seeds'
});
