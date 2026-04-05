import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';

import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import {bbox as bboxStrategy} from 'ol/loadingstrategy';

import Style from 'ol/style/Style';
import Fill from 'ol/style/Fill';
import Stroke from 'ol/style/Stroke';

import {SleStyle, WehStyle, BruAndereStyle, BruNlwknStyle, DueStyle, QueStyle, getStyleForArtEin} from './utils.js';


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

export function createOsmTileGr() {
  return new TileLayer({
    title: 'osm-grey',
    name: 'osmgrey',
    permalink: 'osmgrey',
    type: 'base',
    source: new XYZ({
      url: 'https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png',
      attributions: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }),
    opacity: 1,
    visible: true,
  });
}

export function createOsmTileCr() {
  return new TileLayer({
    title: 'osm-color',
    name: 'osmcolor',
    permalink: 'osmcolor',
    className: 'base',
    type: 'base',
    source: new OSM({
      url: 'https://{a-c}.tile.openstreetmap.de/{z}/{x}/{y}.png',
      //attributions: ['© OpenStreetMap contributors', 'Tiles courtesy of <a href="https://www.openstreetmap.org/"></a>'],
    }),
    opacity: 1,
    visible: false,
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
  title: 'Wehr', 
  name: 'weh', 
  permalink:'weh',
  style: WehStyle,
  visible: false
  });
}

export function createExpBwBruAndereLayer() {
  return new VectorLayer({
    source: new VectorSource({
      format: new GeoJSON(),
      url: function (extent) {
        return '/myLayers/exp_bw_bru_andere.geojson?bbox=' + extent.join(',');
      },
      strategy: bboxStrategy
    }),
    title: 'Brücke (andere)',
    name: 'bru_andere', 
    permalink:'bru_andere',  
    style: BruAndereStyle,
    visible: false
  });
}

export function createExpBwBruNlwknLayer() {
  return new VectorLayer({
    source: new VectorSource({
      format: new GeoJSON(),
      url: function (extent) {
        return '/myLayers/exp_bw_bru_nlwkn.geojson?bbox=' + extent.join(',');
      },
      strategy: bboxStrategy
    }),
    title: 'Brücke (NLWKN)', 
    name: 'bru_nlwkn', // Titel für den Layer-Switcher
    permalink:'bru_nlwkn',  // Um Permalink zu setzen
    style: BruNlwknStyle,
    visible: false
  });
}

export function createExpBwDueLayer() {
  return new VectorLayer({
    source: new VectorSource({
      format: new GeoJSON(),
      url: function (extent) {
        return '/myLayers/exp_bw_due.geojson?bbox=' + extent.join(',');
      },
      strategy: bboxStrategy
    }),
   title: 'Düker', 
  name: 'due', 
  permalink:'due',  
  style: DueStyle,
  visible: false
  });
}

export function createExpBwQueLayer() {
  return new VectorLayer({
    source: new VectorSource({
      format: new GeoJSON(),
      url: function (extent) {
        return '/myLayers/exp_bw_que.geojson?bbox=' + extent.join(',');
      },
      strategy: bboxStrategy
    }),
  title: 'Querung', 
  name: 'que', 
  permalink:'que',  
  style: QueStyle,
  visible: false
  });
}


export function createExpBwEinLayer() {
  return new VectorLayer({
    source: new VectorSource({
      format: new GeoJSON(),
      url: function (extent) {
        return '/myLayers/exp_bw_ein.geojson?bbox=' + extent.join(',');
      },
      strategy: bboxStrategy
    }),
  title: 'Einläufe', 
  name: 'ein', 
  permalink:'ein',  
  style: getStyleForArtEin,
  visible: false
  });
}
