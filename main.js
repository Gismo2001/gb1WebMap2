import './style.css';
import 'ol/ol.css';

import { createMap } from './js/map.js';
import { createBaseLayer, createGewLayer, createExpBwSleLayer, createExpBwWehLayer } from './js/layers.js';




// Basemap
const baseLayer = createBaseLayer();


// dein neuer Layer
const gewLayer = createGewLayer();

const exp_bw_SleLayer = createExpBwSleLayer();
const exp_bw_WehLayer = createExpBwWehLayer();

// Map erstellen
const map = createMap('map');

// Alternative:
map.addLayer(baseLayer);
map.addLayer(gewLayer);
map.addLayer(exp_bw_WehLayer);
map.addLayer(exp_bw_SleLayer);