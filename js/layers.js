import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';

import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import {bbox as bboxStrategy} from 'ol/loadingstrategy';

import Style from 'ol/style/Style';
import Fill from 'ol/style/Fill';
import Stroke from 'ol/style/Stroke';

import {SleStyle} from './utils.js';
import {WehStyle} from './utils.js';

// 👉 dein neuer Layer
export function createGewLayer() {
  return new VectorLayer({
    source: new VectorSource({
      format: new GeoJSON(),
      url: function (extent) {
        return '/myLayers/gew.geojson?bbox=' + extent.join(',');
      },
      strategy: bboxStrategy
    }),
    title: 'gew',
    name: 'gew',
    style: new Style({
      fill: new Fill({ color: 'rgba(0,28,240,0.4)' }),
      stroke: new Stroke({ color: 'blue', width: 2 })
    }),
    visible: true
  });
}

export function createBaseLayer() {
  return new TileLayer({
    source: new OSM(),
  });
}

export function createExpBwSleLayer() {
  return new VectorLayer({
    source: new VectorSource({
      format: new GeoJSON(),
      url: function (extent) {
        return '/myLayers/exp_bw_sle.geojson?bbox=' + extent.join(',');
      },
      strategy: bboxStrategy
    }),
    title: 'Schleuse',
    name: 'Sle',
    permalink: 'Sle',
    style: SleStyle,
    visible: true,
  });
}

export function createExpBwWehLayer() {
  return new VectorLayer({
    source: new VectorSource({
      format: new GeoJSON(),
      url: function (extent) {
        return '/myLayers/exp_bw_weh.geojson?bbox=' + extent.join(',');
      },
      strategy: bboxStrategy
    }),
    title: 'Schleuse',
    name: 'Weh',
    permalink: 'Weh',
    style: WehStyle,
    visible: true,
  });
}
