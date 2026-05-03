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
import { closeTable } from './js/table.js';
import { switchLayerData } from './js/table.js';
import { getTableActive } from './js/table.js';  


import { initMapClick } from './js/mapEvents.js';
import { initPopup } from './js/mapEvents.js';
import { switcherDrawList } from './js/mapEvents.js';
import { switcherToggle } from './js/mapEvents.js';
import { getClickResults } from './js/mapEvents.js';
import { updateTableFromVisibleLayers  } from './js/mapEvents.js';
import { getVisibleVectorFeatures } from './js/mapEvents.js';

import { searchPlaceControlFunc } from './js/controls.js';
import { initSearchEvents } from './js/mapEvents.js'; // Import hinzufügen
import { initPtn } from './js/ptn.js'; // 👈 Sicherstellen, dass initPtn importiert ist!

import { initPrintControl } from './js/controls.js';
import { initializeWMS } from './js/controls.js'; // Pfad anpassen

import { isDgmActive, addDgmLayer, getLoadedDgmExtent,getLoadedDomExtent,getOverallDgmMinMax,getOverallDomMinMax, getMinMaxFromMetadata, enableDgmInteraction} from './js/dgmdom.js';
import { createDgmKachelLayer } from './js/layers.js';



//Variable für die Split-Instanz, damit sie global zugänglich ist
let splitInstance = null;

// Projektionen registrieren (Projection.js)
registerProjections();

// 👉 Hier werden zuerst die Layer erstellt (layers.js)
const layers = createLayerStructure();

// 👉 Mier wird map mit Layern erstellt (map.js)
const map = createMap('map', layers);

// 👉 LayerSwitcher wird hinzugefügt (control.js)
const layerSwitcher = createLayerSwitcher(map);
map.addControl(layerSwitcher);


// Toolbar wird erstellt und hinzugefügt (control.js)
const toolbar = createMainToolbar(map);
map.addControl(toolbar);

// ... Karte erstellen ...
const searchPlaceControl = searchPlaceControlFunc(); // Die Ortssuche und der zugehörige Button wird erstellt (control.js)
map.addControl(searchPlaceControl); // und hinzugefügt (control.js)
initSearchEvents(searchPlaceControl, map); // eventhandler fü+r searchPlaceControl wird erstellt (mapEvents.js)
initMapClick(map); // eventhandler für Click auf die Karte (mapEvents.js)
initPopup(map); // Popup-Overlay wird erstellt (mapEvents.js)
initPrintControl(map);//Contols laden für den Print-Button (control.js)
switcherDrawList(layerSwitcher);
switcherToggle(layerSwitcher);

initializeWMS(map);

map.updateSize();

const dgmKachelLayer = createDgmKachelLayer();

const container = document.getElementById('popup-content');
container.addEventListener('click', function (event) {
  if (event.target.classList.contains('popup-link')) {

    const tifUrl = event.target.dataset.tif;
    const tileId = event.target.dataset.tile_id;
    const bbox = JSON.parse(event.target.dataset.bbox);

    console.log("tifUrl:", tifUrl);
    console.log("tileId:", tileId);
    console.log("bbox:", bbox);

    enableDgmInteraction(map);

    const dgmData = addDgmLayer(tifUrl, bbox, tileId);

    loadedDgms.push({ tile_id: tileId, bbox: bbox });
    activeDgmRasterData.push(dgmData);

    const overall = getOverallDgmMinMax();
    activeDgmRasterData.forEach(dgm => {
      dgm.layer.setStyle(createGeoTiffStyle(overall.min, overall.max));
    });

    const totalBBox = getLoadedDgmExtent();
    if (totalBBox) {
      // map.getView().fit(totalBBox, { padding: [50,50,50,50], duration: 700 });
    }

    container.style.display = 'none';
  }
});



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
initPtn(map);   // 👈 Diesen Aufruf unbedingt hinzufügen!

//Eventlistener für den "Schließen"-Button der Tabelle, damit die Karte wieder 100% bekommt
document.getElementById('close-table-btn') 
  .addEventListener('click', closeTable);


map.on('moveend', () => {
  // Nur wenn der User die Tabelle offen hat, führen wir das Update aus
  if (getTableActive()) {
    updateTableFromVisibleLayers(map);
  }
});
