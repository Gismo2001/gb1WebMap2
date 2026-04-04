import './style.css';
import 'ol/ol.css';

import { createMap } from './js/map.js';
import { createBaseLayer } from './js/layers.js';
import { logMessage } from './js/utils.js';

const baseLayer = createBaseLayer();

const map = createMap('map', [baseLayer]);

logMessage("Karte erfolgreich geladen!");