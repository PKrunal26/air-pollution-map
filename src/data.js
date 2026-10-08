export const cities = [
 {id:'delhi',name:'New Delhi',country:'India',lat:28.61,lon:77.21,pm:68,profile:[18,20,17,9,16,7,8,5]},
 {id:'beijing',name:'Beijing',country:'China',lat:39.90,lon:116.41,pm:42,profile:[24,23,11,8,16,5,6,7]},
 {id:'london',name:'London',country:'United Kingdom',lat:51.51,lon:-0.13,pm:13,profile:[9,12,19,9,27,4,8,12]},
 {id:'lagos',name:'Lagos',country:'Nigeria',lat:6.52,lon:3.38,pm:49,profile:[17,15,8,12,19,14,10,5]},
 {id:'saopaulo',name:'São Paulo',country:'Brazil',lat:-23.55,lon:-46.63,pm:21,profile:[10,18,13,10,26,7,8,8]},
 {id:'newyork',name:'New York',country:'United States',lat:40.71,lon:-74.01,pm:11,profile:[14,11,8,9,28,6,13,11]},
 {id:'mumbai',name:'Mumbai',country:'India',lat:19.08,lon:72.88,pm:38,profile:[15,19,8,19,21,8,6,4]},
 {id:'tokyo',name:'Tokyo',country:'Japan',lat:35.68,lon:139.69,pm:12,profile:[15,19,8,9,22,4,9,14]},
 {id:'sydney',name:'Sydney',country:'Australia',lat:-33.87,lon:151.21,pm:8,profile:[9,10,12,11,24,6,11,17]},
 {id:'paris',name:'Paris',country:'France',lat:48.86,lon:2.35,pm:16,profile:[8,12,23,8,27,5,7,10]},
 {id:'cairo',name:'Cairo',country:'Egypt',lat:30.04,lon:31.24,pm:47,profile:[13,18,12,21,20,7,5,4]},
 {id:'jakarta',name:'Jakarta',country:'Indonesia',lat:-6.21,lon:106.85,pm:36,profile:[20,18,9,10,24,9,6,4]}
];
export const systems = [
 {id:'energy',name:'Energy',color:'#edb979',chemical:'SO₂ → sulfates',title:'Electricity has an atmosphere.',description:'Burning fuels for electricity releases particles and gases. Sulfur dioxide can transform into sulfate particles as the air moves.',origin:'Fuel combustion',intermediate:'Oxidation & mixing',outcome:'Sulfate particles',formula:'SO₂ + oxidants → sulfate → PM₂.₅',links:['Power generation','Fuel combustion','Atmospheric oxidation']},
 {id:'industry',name:'Industry',color:'#c69d8a',chemical:'Metals · SO₂ · PM',title:'Making things leaves traces.',description:'Processes such as cement and steel production can release dust, metals and combustion gases. The mixture depends on materials, fuels and controls.',origin:'Industrial processes',intermediate:'Transport & chemistry',outcome:'Particles & gases',formula:'Process dust + combustion gases → mixed aerosol',links:['Manufacturing','Process emissions','Airborne mixing']},
 {id:'agriculture',name:'Agriculture',color:'#bbcb92',chemical:'NH₃ → nitrates',title:'Fields can become particles.',description:'Ammonia from fertilisers and livestock can react with acids formed from traffic, energy and industrial gases, creating secondary particles.',origin:'Fertiliser & livestock',intermediate:'Ammonia meets acids',outcome:'Secondary PM₂.₅',formula:'NH₃ + HNO₃ ⇌ NH₄NO₃',links:['Fertiliser & livestock','Ammonia + nitric acid','Ammonium nitrate']},
 {id:'construction',name:'Construction',color:'#c8b999',chemical:'Dust · PM₁₀',title:'A city in motion stirs dust.',description:'Building, demolition and disturbed surfaces release dust. Some particles settle nearby; finer material can stay suspended and travel farther.',origin:'Building & demolition',intermediate:'Dust resuspension',outcome:'Suspended particles',formula:'Disturbed surfaces → dust → airborne PM',links:['Building & demolition','Suspended dust','Airborne particles']},
 {id:'transport',name:'Transportation',color:'#d19772',chemical:'NOₓ · soot · dust',title:'The road leaves more than exhaust.',description:'Engines release nitrogen oxides and soot. Tyre wear, brake wear and road dust also release particles, even when a vehicle has no exhaust.',origin:'Roads & engines',intermediate:'Wear & reactions',outcome:'Soot, dust & nitrates',formula:'NOₓ → nitric acid + NH₃ → nitrate particles',links:['Roads & engines','Wear + combustion','Particles & precursors']},
 {id:'waste',name:'Waste',color:'#bba197',chemical:'Soot · organics',title:'What we discard enters the air.',description:'Open burning can release soot, organic particles and gases. Waste composition and burning conditions influence the resulting pollutants.',origin:'Open waste burning',intermediate:'Incomplete combustion',outcome:'Soot & organics',formula:'Burning waste → soot + organic aerosol',links:['Discarded materials','Open burning','Combustion particles']},
 {id:'households',name:'Households',color:'#97bdb5',chemical:'Soot · fine PM',title:'Everyday fuel has a footprint.',description:'Cooking and heating with solid fuels can release fine particles. Indoor emissions can also enter outdoor air; ventilation changes exposure.',origin:'Cooking & heating',intermediate:'Fuel combustion',outcome:'Fine particles',formula:'Solid fuels → incomplete combustion → PM₂.₅',links:['Cooking & heating','Fuel combustion','Indoor & outdoor air']},
 {id:'regional',name:'Regional transport',color:'#a3b5c1',chemical:'Mixed aerosol',title:'Air does not stop at borders.',description:'Winds can carry pollutants and their precursors across regions. Weather, chemistry and terrain affect which particles arrive and where.',origin:'Upwind air',intermediate:'Wind & transformation',outcome:'Arriving aerosol',formula:'Emissions elsewhere + wind + chemistry → local air',links:['Upwind systems','Wind & transformation','Arriving mixture']}
];
export const concentrations = (city,year,month,scenario=0) => Math.round(city.pm * (1 + (2024-year)*0.027) * [1.22,1.16,1.04,.89,.83,.71,.68,.75,.92,1.10,1.31,1.26][month] * (1-scenario*.0024));
export const seasons=['January','February','March','April','May','June','July','August','September','October','November','December'];
export const evidence = [
 {title:'Particle composition & formation',url:'https://www.epa.gov/pmcourse/what-particle-pollution'},
 {title:'Health effects of particle pollution',url:'https://www.epa.gov/pm-pollution/health-and-environmental-effects-particulate-matter-pm'},
 {title:'Ammonia & secondary particles',url:'https://www.epa.gov/sites/default/files/2020-07/documents/naaqs-pm_ria_final_2006-10.pdf'}
];
