## This folder contains all of the geospatially related scripts for the nematode abundance work.
### !! Please note: this repository contains the scripts used to run the actual analysis presented in the manuscript. Since the time of publication, aspects of Google Earth Engine have changed and thus some of these scripts will create errors that did not originally occur. If you would like to use these approaches for mapping your own datasets, we encourage you to instead contact the Crowther Lab directly, as we keep current/continuously updated versions of our mapping approaches that  work without errors on Google Earth Engine.

### Here is a an outline describing how the analyses took place:
1. Aggregate the original nematode locations by the composite pixels, averaging all nematode values that fall within the same 1-km<sup>2</sup> pixel; the associated scripts are:
	- Nematodes_Sample_Composite_for_Aggregation.js
	- Nematode_Aggregate_By_Location.ipynb
2. Sample the covariate layers at each unique pixel location; the associated script is:
	- Nematode_Sample_Points_for_ClustOfVar.js
3. Perform variable reduction analyses to acquire potential variable lists; the associated script is:
	- Nematode_ClustOfVar.ipynb
4. Grid search across all models of interests and variable lists of interests; the associated script is:
	- ChangeCSVColumnNamesBeforeShapefile.ipynb
	- Nematode_Grid_Search_Full.js
5. Choose the "best model", ensemble it with itself (in the case of random forest), and produce the final maps
	- Nematode_Grid_Search_Results_Full_Model_Run.ipynb
	- Nematode_CrossValidate_Ensemble.js
	- Nematode_Final_Map_Creation_1.js
	- Nematode_Final_Map_Creation_2.js
	- Nematode_Ensembled_CV_Results.ipynb
6. Perform post hoc analyses, including total abundance calculations, bootstrapping for confidence estimates, interpolation/extrapolation mapping, and predicted/observed assessment
	- Nematode_Global_Abundance_Calculations.js
	- Nematode_Biome_BootStrap_StdDev.js
	- Nematode_Bootstrapped_CIntervals.js
	- Nematode_Map_of_ExtInt.js
	- Nematode_Principal_Components_Analysis.ipynb
	- Nematode_PCA_ConvexHull_IntExt.js
	- Nematode_Predicted_Vs_Observed_Plots.ipynb