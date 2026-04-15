import './style.css';
import 'ol/ol.css';
import 'ol-ext/dist/ol-ext.css';   // 👈 unbedingt notwendig!
import 'tabulator-tables/dist/css/tabulator.min.css';

import { createMap } from './js/map.js';

import { createLayerStructure } from './js/layers.js';

import { createLayerSwitcher } from './js/controls.js';
import { createMainToolbar } from './js/controls.js';

import { registerProjections } from './js/projection.js';

import { initTable } from './js/table.js';
import { closeTable } from './js/table.js';
import { switchLayerData } from './js/table.js';
import { getTableActive } from './js/table.js';  

import { initMapClick } from './js/mapEvents.js';
import {switcherDrawList} from './js/mapEvents.js';
import {switcherToggle} from './js/mapEvents.js';
import { getClickResults } from './js/mapEvents.js';
import { updateTableFromVisibleLayers  } from './js/mapEvents.js';
import { getVisibleVectorFeatures } from './js/mapEvents.js';

import { searchControlFunc } from './js/controls.js';
import { initSearchEvents } from './js/mapEvents.js'; // Import hinzufügen
import { initPtn } from './js/ptn.js'; // 👈 Sicherstellen, dass initPtn importiert ist!




let splitInstance = null;

// Projektionen registrieren
registerProjections();

// 👉 Layerstruktur (inkl. Gruppen)
const layers = createLayerStructure();



// 👉 Map erstellen (mit Layern!)
const map = createMap('map', layers);

// 👉 LayerSwitcher hinzufügen
const layerSwitcher = createLayerSwitcher(map);
map.addControl(layerSwitcher);

// Toolbar erstellen
const toolbar = createMainToolbar(map);
map.addControl(toolbar);


// ... Karte erstellen ...

const searchControl = searchControlFunc();
map.addControl(searchControl);
initSearchEvents(searchControl, map); // Nutzt jetzt das mapRef aus initPtn

initMapClick(map);
switcherDrawList(layerSwitcher);
switcherToggle(layerSwitcher);

map.updateSize();

initPtn(map);   // 👈 Diesen Aufruf unbedingt hinzufügen!

document.getElementById('layer-selector').addEventListener('change', () => {
  // 1. Hole WMS Klick-Daten
  const clickResults = getClickResults();
  
  // 2. Hole aktuelle Vektor-Daten (Bauw. L/P etc.)
  const vectorResults = getVisibleVectorFeatures(map); // map muss hier verfügbar sein

  // 3. Kombiniere beide
  const combinedResults = { ...clickResults, ...vectorResults };
  
  // 4. Update Tabelle
  switchLayerData(combinedResults);
});

// nach map-Erstellung
initTable(map);

document.getElementById('close-table-btn')
  .addEventListener('click', closeTable);


map.on('moveend', () => {
  // Nur wenn der User die Tabelle offen hat, führen wir das Update aus
  if (getTableActive()) {
    updateTableFromVisibleLayers(map);
  }
});