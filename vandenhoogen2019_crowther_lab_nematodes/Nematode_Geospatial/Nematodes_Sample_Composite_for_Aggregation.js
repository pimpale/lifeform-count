/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/
// Source the sampled Nematode Points


// Load the current nematode collection
var nematodeFC = nematodePoints;

var collToSample = nematodeFC;
print('Sample Points',collToSample.limit(5));
print('Size of Sample Collection',collToSample.size());
Map.addLayer(collToSample,{},"Nematode Points being sampled");


/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/
// Gap fill and extend bounds to sample points falling outside of land masses
// Doing so "snaps" points that fall outside the pixel grid to the nearest
// pixel (e.g., points that are taken near the ocean may slightly fall off
// the pixel gride; this function corrects these points)

print('Composite Bands',compositeOfInterest);

// Define the list of bands to fill / extend
var listOfBandsToFill = [
'Pixel_Long',
'Pixel_Lat'
];

// Load the function from the shared repository
var gapFillAndExtendBounds = require('users/devinrouth/toolbox:GapFillAndExtendBounds.js');

var filledImage = gapFillAndExtendBounds.gapFillAndExtendBounds(compositeOfInterest.select(listOfBandsToFill),listOfBandsToFill,10000);
// print('Filled Image', filledImage);
Map.addLayer(compositeOfInterest.select(listOfBandsToFill),{},'Image being filled',false);
Map.addLayer(filledImage,{},'Filled Image',false);


// The code below allows for sampling the collection without dropping missing values
var samplesForTrainingWithMissing = filledImage.reduceRegions({
	reducer: ee.Reducer.first(),
	collection: collToSample,
	scale: compositeOfInterest.projection().nominalScale().getInfo()
});
print('Sampled Points with Missing Values',samplesForTrainingWithMissing.limit(5));


// The code below allows for the export of the sampled points
Export.table.toDrive({
	collection: samplesForTrainingWithMissing,
	description:'20180706_Nematode_Points_Pixel_Locations',
	fileNamePrefix: '20180706_Nematode_Points_Pixel_Locations',
});