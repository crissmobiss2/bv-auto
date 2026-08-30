// Comprehensive make/model database for cascading vehicle selectors
// Covers all major makes sold in the US with complete model lineups

export const VEHICLE_MAKES_MODELS: Record<string, string[]> = {
  Acura: ["CL","ILX","Integra","Legend","MDX","NSX","RDX","RLX","RSX","TL","TLX","TSX","ZDX"],
  "Alfa Romeo": ["147","156","159","164","4C","Giulia","GTV","Spider","Stelvio","Tonale"],
  "Aston Martin": ["DB7","DB9","DB11","DBS","Rapide","V8 Vantage","V12 Vantage","Vantage","Virage"],
  Audi: ["A3","A4","A4 Allroad","A5","A6","A6 Allroad","A7","A8","e-tron","e-tron GT","Q3","Q4 e-tron","Q5","Q5 e-tron","Q7","Q8","R8","RS3","RS4","RS5","RS6","RS7","S3","S4","S5","S6","S7","S8","SQ5","SQ7","SQ8","TT","TTS"],
  BMW: ["1 Series","2 Series","3 Series","4 Series","5 Series","6 Series","7 Series","8 Series","i3","i4","i5","i7","iX","M2","M3","M4","M5","M6","M8","X1","X2","X3","X4","X5","X6","X7","XM","Z3","Z4"],
  Buick: ["Cascada","Century","Enclave","Encore","Encore GX","Envision","Envista","LaCrosse","LeSabre","Lucerne","Park Avenue","Rainier","Regal","Rendezvous","Riviera","Skylark","Terraza","Verano"],
  Cadillac: ["ATS","CTS","CT4","CT5","CT6","DeVille","DTS","Eldorado","Escalade","Escalade ESV","Escalade EXT","ELR","Fleetwood","Lyriq","SRX","STS","XT4","XT5","XT6","XTS"],
  Chevrolet: ["Astro","Avalanche","Aveo","Blazer","Bolt EV","Bolt EUV","Camaro","Caprice","Captiva","City Express","Classic","Cobalt","Colorado","Corvette","Cruze","Equinox","Express","HHR","Impala","Malibu","Monte Carlo","Orlando","Silverado 1500","Silverado 2500HD","Silverado 3500HD","Sonic","Spark","Suburban","Tahoe","Tracker","TrailBlazer","Traverse","Trax","Uplander","Volt"],
  Chrysler: ["200","300","300C","300M","Aspen","Concorde","Crossfire","Grand Voyager","LHS","Pacifica","Prowler","PT Cruiser","Sebring","Town & Country","Voyager"],
  Dodge: ["Avenger","Caliber","Challenger","Charger","Dakota","Dart","Durango","Grand Caravan","Journey","Magnum","Neon","Nitro","Ram 1500","Ram 2500","Ram 3500","Sprinter","SX 2.0","Viper"],
  Ferrari: ["296 GTB","296 GTS","458 Italia","458 Speciale","458 Spider","488 GTB","488 Pista","488 Spider","599 GTB","612 Scaglietti","California","F12 Berlinetta","F40","F430","F8 Tributo","GTC4Lusso","LaFerrari","Portofino","Roma","SF90 Stradale"],
  Fiat: ["124 Spider","500","500 Abarth","500e","500L","500X","Bravo","Doblo","Freemont","Linea","Panda","Punto","Tipo"],
  Ford: ["Bronco","Bronco Sport","Crown Victoria","E-150","E-250","E-350","Edge","Escape","Expedition","Explorer","F-150","F-150 Lightning","F-250 Super Duty","F-350 Super Duty","F-450 Super Duty","Fiesta","Five Hundred","Flex","Focus","Freestyle","Fusion","Galaxy","GT","Maverick","Mustang","Mustang Mach-E","Ranger","Taurus","Thunderbird","Transit","Transit Connect"],
  Genesis: ["G70","G80","G90","GV70","GV80","GV60"],
  GMC: ["Acadia","Canyon","Envoy","Jimmy","Safari","Sierra 1500","Sierra 2500HD","Sierra 3500HD","Sonoma","Suburban","Terrain","Yukon","Yukon XL"],
  Honda: ["Accord","Civic","Clarity","CR-V","CR-Z","Crosstour","Element","Fit","HR-V","Insight","Odyssey","Passport","Pilot","Prologue","Ridgeline","S2000","Accord Hybrid","CR-V Hybrid","Civic Hatchback","Civic Si","Civic Type R"],
  Hyundai: ["Accent","Azera","Elantra","Elantra GT","Elantra N","Entourage","Equus","Genesis","Genesis Coupe","Ioniq","Ioniq 5","Ioniq 6","Kona","Kona Electric","Nexo","Palisade","Santa Cruz","Santa Fe","Santa Fe XL","Sonata","Sonata Hybrid","Tiburon","Tucson","Tucson Hybrid","Veracruz","Veloster","Venue"],
  Infiniti: ["EX35","EX37","FX35","FX37","FX45","FX50","G20","G25","G35","G37","I30","I35","JX35","M35","M37","M45","M56","Q40","Q45","Q50","Q60","Q70","QX30","QX50","QX55","QX56","QX60","QX70","QX80"],
  Jaguar: ["E-Pace","F-Pace","F-Type","I-Pace","S-Type","X-Type","XE","XF","XJ","XJ8","XJL","XJR","XK","XKR"],
  Jeep: ["Cherokee","Compass","Gladiator","Grand Cherokee","Grand Cherokee L","Grand Wagoneer","Liberty","Patriot","Renegade","Wagoneer","Wrangler","Wrangler 4xe"],
  Kia: ["Amanti","Borrego","Cadenza","Carnival","EV6","EV9","Forte","K5","K900","Niro","Niro EV","Optima","Rio","Rondo","Sedona","Seltos","Soul","Soul EV","Sorento","Sorento Hybrid","Spectra","Sportage","Stinger","Stonic","Telluride"],
  "Land Rover": ["Defender","Discovery","Discovery Sport","Freelander","LR2","LR3","LR4","Range Rover","Range Rover Evoque","Range Rover Sport","Range Rover Velar"],
  Lexus: ["CT 200h","ES 250","ES 300","ES 300h","ES 330","ES 350","GS 200t","GS 300","GS 350","GS 430","GS 450h","GS 460","GX 460","GX 470","IS 200t","IS 250","IS 300","IS 350","IS 500","LC 500","LC 500h","LFA","LS 400","LS 430","LS 460","LS 500","LS 600h","LX 470","LX 570","LX 600","NX 200t","NX 250","NX 300","NX 350","NX 350h","NX 450h+","RC 200t","RC 300","RC 350","RC F","RX 300","RX 330","RX 350","RX 350h","RX 400h","RX 450h","RX 500h","RZ 450e","SC 430","TX 350","TX 500h","UX 200","UX 250h"],
  Lincoln: ["Aviator","Blackwood","Continental","Corsair","MKC","MKS","MKT","MKX","MKZ","Mark LT","Navigator","Nautilus","Zephyr"],
  Maserati: ["Ghibli","Gran Turismo","GranCabrio","GranSport","Grecale","Levante","MC20","Quattroporte"],
  Mazda: ["2","3","5","6","626","929","B-Series","CX-3","CX-30","CX-5","CX-50","CX-60","CX-70","CX-90","MX-5 Miata","MX-30","Millenia","MPV","Protege","RX-7","RX-8","Tribute"],
  "Mercedes-Benz": ["A-Class","AMG GT","B-Class","C-Class","CLA","CLS","E-Class","EQB","EQC","EQE","EQE SUV","EQS","EQS SUV","G-Class","GLA","GLB","GLC","GLE","GLS","S-Class","SL","SLC","SLK","Sprinter","V-Class"],
  Mercury: ["Cougar","Grand Marquis","Marauder","Mariner","Milan","Montego","Monterey","Mountaineer","Mystique","Sable","Tracer","Villager"],
  MINI: ["Clubman","Coupe","Countryman","Hardtop","Paceman","Roadster"],
  Mitsubishi: ["3000GT","Diamante","Eclipse","Eclipse Cross","Endeavor","Expo","Galant","Galant ES","i-MiEV","Lancer","Lancer Evolution","Mirage","Montero","Montero Sport","Outlander","Outlander Sport","Outlander PHEV","Raider","Sigma"],
  Nissan: ["300ZX","350Z","370Z","Altima","Altima Hybrid","Armada","Ariya","Cube","Frontier","GT-R","Juke","Kicks","Leaf","Maxima","Murano","NV Cargo","NV Passenger","NV200","Pathfinder","Rogue","Rogue Select","Rogue Sport","Sentra","Stanza","Titan","Titan XD","Versa","Versa Note","Xterra","Z"],
  Oldsmobile: ["Achieva","Alero","Aurora","Bravada","Cutlass","Cutlass Supreme","Intrigue","LSS","Regency","Silhouette"],
  Pontiac: ["Aztek","Bonneville","Firebird","G3","G5","G6","G8","Grand Am","Grand Prix","Montana","Solstice","Sunfire","Torrent","Vibe"],
  Porsche: ["718 Boxster","718 Cayman","911","Cayenne","Cayenne Coupe","Macan","Panamera","Taycan"],
  Ram: ["1500","1500 Classic","2500","3500","4500","5500","ProMaster","ProMaster City"],
  Rivian: ["R1S","R1T"],
  "Rolls-Royce": ["Cullinan","Dawn","Ghost","Phantom","Spectre","Wraith"],
  Saturn: ["Astra","Aura","Ion","L-Series","Outlook","Relay","Sky","Vue"],
  Scion: ["FR-S","iA","iB","iM","iQ","tC","xA","xB","xD"],
  Subaru: ["Ascent","BRZ","Crosstrek","Crosstrek Hybrid","Forester","Impreza","Impreza WRX","Impreza WRX STI","Legacy","Outback","Outback Wilderness","Solterra","WRX"],
  Tesla: ["Cybertruck","Model 3","Model S","Model X","Model Y","Roadster"],
  Toyota: ["4Runner","86","Avalon","Avalon Hybrid","C-HR","Camry","Camry Hybrid","Camry Solara","Celica","Corolla","Corolla Cross","Corolla Cross Hybrid","Corolla Hatchback","Corolla Hybrid","Crown","Echo","FJ Cruiser","GR86","GR Corolla","GR Supra","Highlander","Highlander Hybrid","Land Cruiser","Matrix","MR2","Prius","Prius AWD-e","Prius C","Prius Prime","Prius V","RAV4","RAV4 Hybrid","RAV4 Prime","Sequoia","Sienna","Solara","Supra","T100","Tacoma","Tundra","Tundra Hybrid","Venza","Yaris","Yaris Cross"],
  Volkswagen: ["Arteon","Atlas","Atlas Cross Sport","Beetle","CC","EOS","Golf","Golf Alltrack","Golf GTI","Golf R","Golf SportWagen","ID.4","ID.Buzz","Jetta","Jetta GLI","Passat","Phaeton","Rabbit","Routan","Taos","Tiguan","Touareg"],
  Volvo: ["C30","C40 Recharge","C70","S40","S60","S60 Cross Country","S80","S90","V40","V50","V60","V60 Cross Country","V70","V90","V90 Cross Country","XC40","XC40 Recharge","XC60","XC70","XC90"],
};

export const VEHICLE_MAKES = Object.keys(VEHICLE_MAKES_MODELS).sort();

export function getModelsForMake(make: string): string[] {
  return VEHICLE_MAKES_MODELS[make] ?? [];
}

export const YEAR_RANGE = Array.from(
  { length: new Date().getFullYear() - 1984 },
  (_, i) => String(new Date().getFullYear() + 1 - i)
);
