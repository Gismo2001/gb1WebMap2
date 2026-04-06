import './style.css';
import 'ol/ol.css';
import 'ol-ext/dist/ol-ext.css';   // 👈 unbedingt notwendig!
import './style.css';
import 'ol/ol.css';
import 'ol-ext/dist/ol-ext.css';
import { Vector as VectorLayer } from 'ol/layer.js';
import { Vector as VectorSource } from 'ol/source.js';
import GeoJSON from 'ol/format/GeoJSON.js';
import { Style, Fill, Stroke } from 'ol/style.js';

import { createMap } from './js/map.js';
//import { createLayerStructure } from './js/layers.js';
import { createLayerSwitcher } from './js/controls.js';
import { registerProjections } from './js/projection.js';

// Projektionen registrieren
registerProjections();

// 👉 Layerstruktur (inkl. Gruppen)
//const layers = createLayerStructure();

// 👉 Map erstellen (mit Layern!)
//const map = createMap('map', layers);
const map = createMap('map');

// 👉 LayerSwitcher hinzufügen
const layerSwitcher = createLayerSwitcher();
map.addControl(layerSwitcher);

const gew_layer_layer = new VectorLayer({
  source: new VectorSource({format: new GeoJSON(), url: function (extent) {return './myLayers/gew.geojson' + '?bbox=' + extent.join(','); } }),
  title: 'gew', 
  name: 'gew',
  style: new Style({fill: new Fill({ color: 'rgba(0,28, 240, 0.4)' }),stroke: new Stroke({ color: 'blue', width: 2 }) }),
  visible: true
})
map.addLayer(gew_layer_layer);