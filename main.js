import './style.css';
import 'core-js/stable';
import 'ol/ol.css';
import 'ol-ext/dist/ol-ext.css'; 
import 'tabulator-tables/dist/css/tabulator.min.css';

import { createMap } from './js/map.js';
import { createLayerStructure } from './js/layers.js';

import { createLayerSwitcher } from './js/controls.js';
import { createMainToolbar } from './js/controls.js';

import { registerProjections } from './js/projection.js';

import { initTable } from './js/table.js';
import { closeTable, getTableDocument } from './js/table.js';
import { switchLayerData } from './js/table.js';
import { getTableActive } from './js/table.js';  



import { initMapClick } from './js/mapEvents.js';
import { initPopup } from './js/mapEvents.js';
import { switcherDrawList } from './js/mapEvents.js';
import { switcherToggle } from './js/mapEvents.js';
import { getClickResults } from './js/mapEvents.js';
import { updateTableFromVisibleLayers  } from './js/mapEvents.js';
import { getVisibleVectorFeatures } from './js/mapEvents.js';
import { isTableActive } from './js/controls.js';

import { searchPlaceControlFunc } from './js/controls.js';
import { initSearchEvents } from './js/mapEvents.js'; // Import hinzufügen
import { initPtn } from './js/ptn.js'; // 👈 Sicherstellen, dass initPtn importiert ist!

import { initPrintControl } from './js/controls.js';
import { initializeWMS } from './js/controls.js'; // Pfad anpassen

import { isDgmActive, addDgmLayer, getLoadedDgmExtent,getOverallDgmMinMax } from './js/dgmdom.js';
import { isDomActive, addDomLayer, getLoadedDomExtent,getOverallDomMinMax } from './js/dgmdom.js';
import { getMinMaxFromMetadata , createGeoTiffStyle } from './js/dgmdom.js';

import { createDgmKachelLayer, createDomKachelLayer } from './js/layers.js';
import $ from 'jquery';
import Chart from 'chart.js/auto';

import { detachTableWindow, getTableChildWindow } from './js/table.js';

import { createProfilLayer } from './js/layers.js';
import { profileMode } from './js/chart.js';

import { fromArrayBuffer } from 'geotiff';

import { loadedDgms, loadedDoms } from './js/dgmdom.js';  

import { initPermalinkButton  } from './js/controls.js';

import { initDrawing } from './js/myDraw.js'; // 💡 Hierher verschieben!

window.$ = window.jQuery = $;
window.Chart = Chart;


let activeTableInstance = null;

let activeDgmRasterData = [];  
let activeDomRasterData = [];  


//Variable für die Split-Instanz, damit sie global zugänglich ist
let splitInstance = null;

// Projektionen registrieren (Projection.js)
registerProjections();


// Layer erstellen
const layers = createLayerStructure();

// Layer zur Map
export const map = createMap('map', layers);

// LayerSwitcher hinzufügen
const layerSwitcher = createLayerSwitcher(map);
map.addControl(layerSwitcher);
export { layerSwitcher };

// Toolbar erstellen und hinzufügen
const toolbar = createMainToolbar(map);
map.addControl(toolbar);

// ... Karte erstellen ...
const searchPlaceControl = searchPlaceControlFunc(); // Die Ortssuche und der zugehörige Button wird erstellt (control.js)
map.addControl(searchPlaceControl); // Ortssuche hinzugefügen
initSearchEvents(searchPlaceControl, map); // eventhandler Ortssuche erstellen
initMapClick(map); // eventhandler für Click auf die Karte (mapEvents.js)
initPopup(map); // Popup-Overlay erstellen (mapEvents.js)
initPrintControl(map);//Contols laden für den Print-Button (control.js)
switcherDrawList(layerSwitcher);
switcherToggle(layerSwitcher);

initializeWMS(map);

map.updateSize();

// permalinkButton aktivieren, 
initPermalinkButton(map);

initDrawing(map);

export const dgmKachelLayer = createDgmKachelLayer();
export const domKachelLayer = createDomKachelLayer();
const container = document.getElementById('popup-content');
//Hier vielleicht if für dgm oder dom
container.addEventListener('click', async function (event) {
  if (event.target.classList.contains('popup-link')) {
    const tifUrl = event.target.dataset.tif;
    const tileId = event.target.dataset.tile_id;
    const bbox = JSON.parse(event.target.dataset.bbox);
    enableDgmInteraction(map);
    const dgmData = await addDgmLayer(map, tifUrl, bbox, tileId);
    const totalBBox = getLoadedDgmExtent();
    if (totalBBox) {
      // map.getView().fit(totalBBox, { padding: [50,50,50,50], duration: 700 });
    }
    container.style.display = 'none';
  }
});
  
getTableDocument().getElementById('layer-selector').addEventListener('change', () => {
  // 1. Hole WMS Klick-Daten
  const clickResults = getClickResults();
  // 2. Hole aktuelle Vektor-Daten (Bauw. L/P etc.)
  const vectorResults = getVisibleVectorFeatures(map); // map muss hier verfügbar sein
  // 3. Kombiniere beide
  const combinedResults = { ...clickResults, ...vectorResults };
  // 4. Update Tabelle
  switchLayerData(combinedResults);
});

initTable(map);
initPtn(map); 
// Der Event-Listener für den Popout-Button in main.js
document.getElementById('popout-table-btn').addEventListener('click', () => {
    const childWin = getTableChildWindow();
    if (childWin && !childWin.closed) {
        childWin.focus();
    } else {
        // Einfach nur aufrufen – kein "table" mehr übergeben!
        detachTableWindow(); 
    }
});

// 2. Schließen-Button Event-Listener in main.js
document.getElementById('close-table-btn').addEventListener('click', function(e) {
    //e.stopPropagation(); 
    closeTable(); 
});

map.on('moveend', () => {
  // Nur wenn der User die Tabelle offen hat, führen wir das Update aus
  if (getTableActive()) {
    //updateTableFromVisibleLayers(map);
  }
});
