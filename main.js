import './style.css';
import 'ol/ol.css';
import 'ol-ext/dist/ol-ext.css';   // 👈 unbedingt notwendig!
import 'tabulator-tables/dist/css/tabulator.min.css';


import { createMap } from './js/map.js';
import { createLayerStructure } from './js/layers.js';
import { createLayerSwitcher } from './js/controls.js';
import { registerProjections } from './js/projection.js';


import { createMainToolbar } from './js/controls.js';

import { initMapClick } from './js/mapEvents.js';
import { getClickResults } from './js/mapEvents.js';

import { initTable } from './js/table.js';
import { closeTable } from './js/table.js';
import { switchLayerData } from './js/table.js';
import { updateTableFromVisibleLayers } from './js/mapEvents.js';





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

initMapClick(map);

map.updateSize();

document.getElementById('layer-selector')
  .addEventListener('change', () => {
    switchLayerData(getClickResults());
  });


// nach map-Erstellung
initTable(map);

document.getElementById('close-table-btn')
  .addEventListener('click', closeTable);



map.on('moveend', () => {
  
  updateTableFromVisibleLayers(map);
});
