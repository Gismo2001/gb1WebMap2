import './style.css';
import 'ol/ol.css';
import 'ol-ext/dist/ol-ext.css';   // 👈 unbedingt notwendig!

import { createMap } from './js/map.js';
import { 
    createOsmTileCr, 
    createOsmTileGr, 
    createGewLayer, 
    createExpBwSleLayer, 
    createExpBwWehLayer,
    createExpBwBruAndereLayer,
    createExpBwBruNlwknLayer,
    createExpBwDueLayer,
    createExpBwQueLayer
} from './js/layers.js';

import { createLayerSwitcher } from './js/controls.js';

import { registerProjections } from './js/projection.js';
registerProjections();


const osmTileCr = createOsmTileCr();
const osmTileGr = createOsmTileGr();

const gewLayer = createGewLayer();
const exp_bw_SleLayer = createExpBwSleLayer();
const exp_bw_WehLayer = createExpBwWehLayer();
const exp_bw_BruAndereLayer = createExpBwBruAndereLayer();
const exp_bw_BruNlwknLayer = createExpBwBruNlwknLayer();
const exp_bw_DueLayer = createExpBwDueLayer();
const exp_bw_QueLayer = createExpBwQueLayer();

// Map erstellen
const map = createMap('map');

// Alternative:
map.addLayer(osmTileCr);
map.addLayer(osmTileGr);

map.addLayer(gewLayer);
map.addLayer(exp_bw_WehLayer);
map.addLayer(exp_bw_SleLayer);
map.addLayer(exp_bw_BruAndereLayer);
map.addLayer(exp_bw_BruNlwknLayer);
map.addLayer(exp_bw_DueLayer);
map.addLayer(exp_bw_QueLayer);



// LayerSwitcher hinzufügen
const layerSwitcher = createLayerSwitcher();
map.addControl(layerSwitcher);