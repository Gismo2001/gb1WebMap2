import './style.css';
import 'ol/ol.css';
import 'ol-ext/dist/ol-ext.css';   // 👈 unbedingt notwendig!
import './style.css';
import 'ol/ol.css';
import 'ol-ext/dist/ol-ext.css';

import { createMap } from './js/map.js';
import { createLayerStructure } from './js/layers.js';
import { createLayerSwitcher } from './js/controls.js';
import { registerProjections } from './js/projection.js';

// Projektionen registrieren
registerProjections();

// 👉 Layerstruktur (inkl. Gruppen)
const layers = createLayerStructure();

// 👉 Map erstellen (mit Layern!)
const map = createMap('map', layers);

// 👉 LayerSwitcher hinzufügen
const layerSwitcher = createLayerSwitcher();
map.addControl(layerSwitcher);