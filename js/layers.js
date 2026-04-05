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

import {SleStyle, WehStyle, BruAndereStyle, BruNlwknStyle, DueStyle, QueStyle, getStyleForArtEin, getStyleForArtSonPun, getStyleForArtSonLin, getStyleForArtGewInfo} from './utils.js';
import LayerGroup from 'ol/layer/Group';


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
    name: 'sle',
    permalink: 'sle',
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


export function createExpBwSonPunLayer() {
  return new VectorLayer({
    source: new VectorSource({
      format: new GeoJSON(),
      url: function (extent) {
        return '/myLayers/exp_bw_son_pun.geojson?bbox=' + extent.join(',');
      },
      strategy: bboxStrategy
    }),
   title: 'Sonstige, Punkte', 
  name: 'son_pun', 
  permalink:'son_pun', 
  style: getStyleForArtSonPun,
  visible: false
  });
}
export function createExpBwSonLinLayer() {
  return new VectorLayer({
    source: new VectorSource({
      format: new GeoJSON(),
      url: function (extent) {
        return '/myLayers/exp_bw_son_lin.geojson?bbox=' + extent.join(',');
      },
      strategy: bboxStrategy
    }),
   title: 'Sonstige, Linien', 
  name: 'son_lin', 
  permalink:'son_lin', 
  style: getStyleForArtSonLin,
  visible: false 
  });
}

export function createExpGewInfoLayer() {
  return new VectorLayer({
    source: new VectorSource({
      format: new GeoJSON(),
      url: function (extent) {
        return '/myLayers/exp_gew_info.geojson?bbox=' + extent.join(',');
      },
      strategy: bboxStrategy
    }),
    title: 'Gew, Info', 
  name: 'gew_info',
  permalink: 'gew_info', 
  style: getStyleForArtGewInfo,
  visible: false
  });
}


export function createLayerStructure() {

  // Basiskarten
  const osmGrey = createOsmTileGr();
  const osmColor = createOsmTileCr();

  // Gewässernetz
  const gew = createGewLayer();

  //Thematische Layer
  const sle = createExpBwSleLayer();
  const weh = createExpBwWehLayer();
  const bruAndere = createExpBwBruAndereLayer();
  const bruNlwkn = createExpBwBruNlwknLayer();
  const due = createExpBwDueLayer();
  const que = createExpBwQueLayer();
  const ein = createExpBwEinLayer();
  const sonPun = createExpBwSonPunLayer();
  const sonLin = createExpBwSonLinLayer();
  const gewInfo = createExpGewInfoLayer();


  return [
    
    // 🗺️ Basiskarten
    new LayerGroup({
      title: 'Base',
      layers: [
        osmGrey,
        osmColor
      ]
    }),

   
     // 🏗️ Luftbilder
    new LayerGroup({
      title: 'Luftbilder',
      layers: [
       
        
      ]
    }),
    // 👉 Einzelner Layer (NICHT in Gruppe)
    gew,
         // 🏗️ WMS-Layer
    new LayerGroup({
      title: 'WMS-Layer',
      layers: [
       
        
      ]
    }),
     
    // 🏗️ km
    new LayerGroup({
      title: 'Station',
      layers: [
       
        
      ]
    }),

     // 🌊 Gewässer
    new LayerGroup({
      title: 'Bauw.(L)',
      layers: [
        sonLin,
        gewInfo
      ]
    }),
    // 🏗️ Bauwerke
    new LayerGroup({
      title: 'Bauw.(P)',
      layers: [
        sle,
        weh,
        bruAndere,
        bruNlwkn,
        due,
        que,
        ein,
        sonPun
        
      ]
    }),


 
  ];
}