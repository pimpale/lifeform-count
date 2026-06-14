// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// This script performs global nematode abundance calculations for each of
// the final maps, including code to calculate biome abundances for each
// of the WWF biomes


// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Prepare the necessary inputs for the calculations

// Prepare an unbounded geometry for reductions
var unboundedGeo = ee.Geometry.Rectangle([-180, -88, 180, 88], "EPSG:4326", false);

// Prepare the proportional pixel area layer for image arithmetic
var landCoverClassesToUse = landCover.select(0,2,4,5,6,7,8,9,10,11)
                            .mask(landCover.select('OpenWater').neq(100));

var percentLandAreaPrep = landCoverClassesToUse.reduce('sum')
                          .rename('areaPercentage').divide(100);
Map.addLayer(percentLandAreaPrep,{min:0,max:100},'Percent Land Area',false);


// Prepare the bulk density layer for image arithmetic
var bulkDensityLayers = sgColl.filter(ee.Filter.inList('system:index',['BLDFIE_M_sl1_1km_ll',
                                                                       'BLDFIE_M_sl2_1km_ll',
                                                                       'BLDFIE_M_sl3_1km_ll']));
// print('Bulk Density Layers from Soil Grids',bulkDensityLayers);

var bulkDensityMean = bulkDensityLayers.mean();


// Make a function to compute the abundance of nematodes given a density image
var computeAbundance = function(densityImage){
  
  var abundancePerPixel = densityImage
                                  // Convert from "nematodes per 100g of soil" to "nematodes per 1kg of soil"
                                  .multiply(10)
                                  // Convert from "nematodes per 1kg of soil" to "number of nematodes"
                                  .multiply(
                                    // Multiply pixel area in meters by 0.15m (which is the sample depth)
                                    // to compute the volume of soil area in each pixel in cubic meters
                                    ee.Image.pixelArea().multiply(0.15)
                                    // Scale it by the available land area per pixel
                                    .multiply(percentLandAreaPrep)
                                    // Multiply the volume of the soil in cubic meters by the bulk density,
                                    // which is in kg soil per cubic meter, to compute the mass of soil
                                    // in each pixel
                                    .multiply(bulkDensityMean));  
  
  return abundancePerPixel;
};


// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Compute the total number of nematodes from each image

// Total Number
var totalNumberDensity = totalNumberColl.mean().rename('Total_Number');

var totalNematodesPerPixel = computeAbundance(totalNumberDensity);
// Map.addLayer(totalNematodesPerPixel,{},'Total Number of nematodes per pixel');

// Compute the total number of nematodes across the image of interest
var totalNematodeAbundance = totalNematodesPerPixel.reduceRegion({
                            reducer:'sum',
                            geometry:unboundedGeo,
                            maxPixels:1e13,
                            scale:927.6624232772797
}).get('Total_Number');
print('Total Nematode Abundance',totalNematodeAbundance);


// Bacterivores
var bacterivoreDensity = bacterivoresColl.mean().rename('Bacterivores');

var bacterivoresPerPixel = computeAbundance(bacterivoreDensity);
// Map.addLayer(bacterivoresPerPixel,{},'Bacterivore nematodes per pixel');

// Compute the total number of nematodes across the image of interest
var bacterivoreNematodeAbundance = bacterivoresPerPixel.reduceRegion({
                            reducer:'sum',
                            geometry:unboundedGeo,
                            maxPixels:1e13,
                            scale:927.6624232772797
}).get('Bacterivores');
print('Bacterivore Nematode Abundance',bacterivoreNematodeAbundance);


// Fungivores
var fungivoresDensity = fungivoresColl.mean().rename('Fungivores');

var fungivoresPerPixel = computeAbundance(fungivoresDensity);
// Map.addLayer(fungivoresPerPixel,{},'Fungivores nematodes per pixel');

// Compute the total number of nematodes across the image of interest
var fungivoreNematodeAbundance = fungivoresPerPixel.reduceRegion({
                            reducer:'sum',
                            geometry:unboundedGeo,
                            maxPixels:1e13,
                            scale:927.6624232772797
}).get('Fungivores');
print('Fungivores Nematode Abundance',fungivoreNematodeAbundance);


// Herbivores
var herbivoresDensity = herbivoresColl.mean().rename('Herbivores');

var herbivoresPerPixel = computeAbundance(herbivoresDensity);
// Map.addLayer(herbivoresPerPixel,{},'Herbivores nematodes per pixel');

// Compute the total number of nematodes across the image of interest
var herbivoreNematodeAbundance = herbivoresPerPixel.reduceRegion({
                            reducer:'sum',
                            geometry:unboundedGeo,
                            maxPixels:1e13,
                            scale:927.6624232772797
}).get('Herbivores');
print('Herbivores Nematode Abundance',herbivoreNematodeAbundance);


// Omnivores
var omnivoresDensity = omnivoresColl.mean().rename('Omnivores');

var omnivoresPerPixel = computeAbundance(omnivoresDensity);
// Map.addLayer(herbivoresPerPixel,{},'Omnivores nematodes per pixel');

// Compute the total number of nematodes across the image of interest
var omnivoreNematodeAbundance = omnivoresPerPixel.reduceRegion({
                            reducer:'sum',
                            geometry:unboundedGeo,
                            maxPixels:1e13,
                            scale:927.6624232772797
}).get('Omnivores');
print('Omnivores Nematode Abundance',omnivoreNematodeAbundance);


// Predators
var predatorsDensity = predatorsColl.mean().rename('Predators');

var predatorsPerPixel = computeAbundance(predatorsDensity);
// Map.addLayer(herbivoresPerPixel,{},'Predators nematodes per pixel');

// Compute the total number of nematodes across the image of interest
var predatorNematodeAbundance = predatorsPerPixel.reduceRegion({
                            reducer:'sum',
                            geometry:unboundedGeo,
                            maxPixels:1e13,
                            scale:927.6624232772797
}).get('Predators');
print('Predators Nematode Abundance',predatorNematodeAbundance);


// Unidentified Nematodes
var unidentifiedDensity = unidentifiedColl.mean().rename('Unidentified');

var unidentifiedPerPixel = computeAbundance(unidentifiedDensity);
// Map.addLayer(herbivoresPerPixel,{},'Unidentified nematodes per pixel');

// Compute the total number of nematodes across the image of interest
var unidentifiedNematodeAbundance = unidentifiedPerPixel.reduceRegion({
                            reducer:'sum',
                            geometry:unboundedGeo,
                            maxPixels:1e13,
                            scale:927.6624232772797
}).get('Unidentified');
print('Unidentified Nematode Abundance',unidentifiedNematodeAbundance);


// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Compute the total abundances per biome

// Create a bounding rectangle for the entire planet to use when
// reducing "unbounded" images
var unboundedGeo = ee.Geometry.Polygon([-180, 88, 0, 88, 180, 88, 180, -88, 0, -88, -180, -88], null, false);

// Scale for reduction (in meters):927.6624232772797
var scaleForReduction = 927.6624232772797;

// Concatenate the images into a single image
var combinedImage = ee.Image.cat(totalNematodesPerPixel,
bacterivoresPerPixel,
fungivoresPerPixel,
herbivoresPerPixel,
omnivoresPerPixel,
predatorsPerPixel);
// print('Combined Image',combinedImage);

// Instantiate a list of biome numbers
var biomeNumbers = ee.List([1,2,3,4,5,6,7,8,9,10,11,12,13,14]);

// Map accross the biome numbers, calculating means for each functional group
var results = ee.FeatureCollection(biomeNumbers.map(function(number){
  // Make a feature designated with each biome
  var biomeFeature = ee.Feature(null).set('Biome',number);
  
  // Make a mask layer for each biome using the WWF Biome layer
  var wwfMask = wwfBiomes.eq(ee.Image.constant(number));
  
  // Mask the combined image using the WWF mask
  var maskedImage = combinedImage.updateMask(wwfMask);
  
  // Reduce the masked image to compute the statistics
  var reducedDictionary = maskedImage.reduceRegion({reducer:'sum',
                                                    geometry:unboundedGeo,
                                                    scale:scaleForReduction,
                                                    maxPixels:1e13
  });
  
  return biomeFeature.set(reducedDictionary);
}));
// print('Results',results);


// Export the results
Export.table.toDrive({
  collection:results,
  folder:'20180724_Biome_Abundances',
  description:'20180724_Biome_Abundances',
  fileNamePrefix:'20180724_Biome_Abundances'
});