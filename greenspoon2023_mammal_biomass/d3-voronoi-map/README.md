Voronoi Treemap for the global mass of all mammals
=============================================================

Marine mammals, common names and groups of families:

* Baleen whales - Balaenidae, Balaenopteridae, Neobalaenidae, Eschrichtiidae
* Sperm whales - Physeteridae,Kogiidae
* Beaked whales - Ziphiidae
* Dolphins and Porpoises - Monodontidae, Platanistidae, Iniidae, Lipotidae, Delphinidae, Pontoporiidae, Phocoenidae
* Sea cows - Trichechidae, Dugongidae
* Otaries - Otariidae
* True seals - Phocidae
* Other Carnivores - Ursidae, Mustelidae, Odobenidae

Terrestrial, by order:

* Elephants - Proboscidea 
* Primates - Primates 
* Odd-hoofed mammals - Perissodactyla 
* Rabbits and Hares - Lagomorpha 
* Marsupials- Diprotodontia 
* Bats - Chiroptera 
* Even-hoofed mammals - terrestrial Cetartiodactyla 
* Carnivores- Carnivora
* Other mammals - all the rest



## Instructions for generating a Treemap


### Collecting the mass values in a CSV file

First, make sure you have the results organized in a comma-separated-values file with the following structure:

|  Level_1    | Level_2       | mass  |
|-------------|---------------|-------|
|  Marine     | Otaries       | 0.81  |
|  Human      | Human         | 472.3 |
|  ...        | ...           | ...   |

### Converting the CSV file to a JSON file

Then, run the python script called that converts the CSV file into a JSON file
```bash
python -m generate_json CSV_FNAME > JSON_FNAME
```

### Generating the Proteomap

* Run the command: `python -m http.server`
* Open the following link in your browser [http://0.0.0.0:8000/](http://0.0.0.0:8000/)
* You can refresh the page several times until the layout looks good enough
* Save the webpage, open the HTML file with a text editor and copy the SVG object into a new file

