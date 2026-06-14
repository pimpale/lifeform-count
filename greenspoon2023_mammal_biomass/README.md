Mammal Biomass
==============
This repository contains all source data and code for the analysis found in "The Global Biomass of Wild Mammals" by Lior Greenspoon*, Eyal Krieger*, Ron Sender, Yuval Rosenberg, Yinon M. Bar-On, Uri Moran, Tomer Antman, Shai Meiri, Uri Roll, Elad Noor and Ron Milo
https://www.weizmann.ac.il/plants/Milo/home

An index for the structure of this repository is given below:

* `setup.py`| A Python script to create the virtual environment. This is set up to run from the beginning of each notebook.
    
* Estimating the global biomass of wild land-mammals:

    1. `preprocess_data.ipynb`| A Jupyter notebook to preprocess raw data prior to running the models
    
    2. `preproc_raster_data.R`| An R script to estimate Extent of Suitable Habitat for each wild land-mammal species. This is called directly from the `preprocess_data.ipynb` notebook.
    
    3. `population_reports_from_sources_outside_IUCN.R`

    4. `infer_wild_land_mammal_biomass.ipynb`| A Jupyter notebook estimating density (ind/km^2) of wild land-mammal species using the "global model" (see Methods section for full detail)
    
    5. `svr_generic.py`| A python script containing the functions required to run the global model. This is called directly from the `infer_wild_land_mammal_biomass.ipynb` notebook.

* Estimating the global biomass of other mammals:

    1. `human_and_domesticated_biomass.ipynb`| A Jupyter notebook estimating the total biomass of livestock

    2. `marine_biomass.ipynb`| A Jupyter notebook estimating the total biomass of wild marine mammals

* Generate plots:
    1. `plot_results.ipynb`| A Jupyter notebook estimating the total biomass of wild marine mammals
    
    2. `generate_map.py`| A python script containing the functions required to generate the global mass density of wild land-mammals. This is called directly from the `plot_results.ipynb` notebook. 
    
    3. `gen_mass_density_raster.R`| An R script generating a mass density raster file. This is called directly from the `plot_results.ipynb` notebook.
    
    4. `mass_by_cont.R`| An R script calculating the total biomass of wild land-mammals in each continent. This is called directly from the `plot_results.ipynb` notebook.
    


In order to run the code in this repository, first intall the dependencies of the code. To install the dependencies run the following script:
`sudo pip install -r requirements.txt`

The code was tested on the following software versions:


Tested on Ubuntu version 20.04 & 21.04


### Additional data files required to run our code
A description of the files required to run the code can be found in the first section of each notebook.


