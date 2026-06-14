/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/
// Source the sampled Nematode Points


// Load the current nematode collection
var nematodeFC = nematodePointsAggregated;
var collToSample = nematodeFC.select('Total_Numb',
                                     'Bacterivor',
                                     'Fungivores',
                                     'Omnivores',
                                     'Plant_feed',
                                     'Predators',
                                     'Unidentifi');
print('Sample Points',collToSample.limit(5));
print('Size of Sample Collection',collToSample.size());
Map.addLayer(collToSample,{},"Nematode Points being sampled");


/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/
// Gap fill and extend bounds to sample points falling outside of land masses
// This is the same function used in the "Nematodes_Sample_Composite_for_Aggregation.js"
// script, and allows points falling in pixel gaps to sample the nearest
// pixel value rather than being dropped in the analysis due to a missing/NA
// value; per the function input below, the range of this "gap filling" is
// 10000 meters (or 10 pixels)

print('Composite Bands',compositeOfInterest);

// Define the list of bands to fill / extend
var listOfBandsToFill = compositeOfInterest.bandNames();

// Load the function from the shared repository
var gapFillAndExtendBounds = require('users/devinrouth/toolbox:GapFillAndExtendBounds.js');

// Gap fill the image of interest
var filledImage = gapFillAndExtendBounds.gapFillAndExtendBounds(compositeOfInterest,listOfBandsToFill,10000);
// print('Filled Image', filledImage);
Map.addLayer(filledImage,{},'Filled Image',false);


// The code below allows for sampling the collection without dropping missing values
var samplesForTrainingWithMissing = filledImage.reduceRegions({
	reducer: ee.Reducer.first(),
	collection: collToSample,
	scale: compositeOfInterest.projection().nominalScale().getInfo()
});
// print('Sampled Points with Missing Values',samplesForTrainingWithMissing.limit(5));


// The code below allows for the export of the sampled points
Export.table.toDrive({
	collection: samplesForTrainingWithMissing,
	description:'20180706_NematodePoints_SampledPixelValues',
	fileNamePrefix: '20180706_NematodePoints_SampledPixelValues',
});