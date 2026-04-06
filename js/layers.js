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

import {SleStyle, WehStyle, BruAndereStyle, BruNlwknStyle, DueStyle, QueStyle, getStyleForArtEin, getStyleForArtSonPun, getStyleForArtSonLin, getStyleForArtGewInfo, Km10scalStyle, Km100scalStyle, Km500scalStyle } from './utils.js';
import LayerGroup from 'ol/layer/Group';
import { TileWMS } from 'ol/source.js';





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

//Luftbilder Layer
export function creategnAtlas2023Layer() {
return new TileLayer({
  title: 'NI2023',
  name: 'NI2023',
  permalink:'NI2023',
  source: new TileWMS(({
    url: "https://opendata.lgln.niedersachsen.de/doorman/noauth/dop_wms",
    attributions: 'Orthophotos Niedersachsen, LGLN',
    params: {"LAYERS": "ni_dop20", "TILED": "true", "VERSION": "1.3.0"},
  })),
  opacity: 1,
  visible: true,
});
}
export function creategnAtlas2020Layer() {
return new TileLayer({
  title: 'NI2020',
  name: 'NI2020',
  permalink:'NI2020',
 source: new TileWMS(({
    url: "https://opendata.lgln.niedersachsen.de/doorman/noauth/doph_wms?",
    attributions: ' ',
    params: {"LAYERS": "ni_dop20h_rgb_2020", "TILED": "true", "VERSION": "1.3.0"},
  })),
  opacity: 1,
  visible: false,
});
}
export function creategnAtlas2017Layer() {
return new TileLayer({
  title: 'NI2017',
  name: 'NI2017',
  permalink:'NI2017',
  source: new TileWMS(({
    url: "https://opendata.lgln.niedersachsen.de/doorman/noauth/doph_wms?",
    attributions: ' ',
    params: {"LAYERS": "ni_dop20h_rgb_2017", "TILED": "true", "VERSION": "1.3.0"},
  })),
  opacity: 1,
  visible: false,
});
}

export function creategnAtlas2014Layer() {
return new TileLayer({
  title: 'NI2014',
  name: 'NI2014',
  permalink:'NI2014',
 source: new TileWMS(({
    url: "https://opendata.lgln.niedersachsen.de/doorman/noauth/doph_wms?",
    attributions: ' ',
    params: {"LAYERS": "ni_dop20h_rgb_2014", "TILED": "true", "VERSION": "1.3.0"},
  })),
  opacity: 1,
  visible: false,
});
}

// Station (Kilometrierung) Layer
export function createKm10scalLayer() {
 return new VectorLayer({
  source: new VectorSource({format: new GeoJSON(), url: function (extent) {return './myLayers/km_10_scal.geojson' + '?bbox=' + extent.join(','); }, strategy: bboxStrategy }),
  title: 'Km10scal',
  name: 'Km10scal',
  permalink:'Km10scal',
  style: Km10scalStyle,
  visible: true,
  minResolution: 0,
  maxResolution: 1
 });
}
export function createKm100scalLayer() {
 return new VectorLayer({
 source: new VectorSource({format: new GeoJSON(), url: function (extent) {return './myLayers/km_100_scal.geojson' + '?bbox=' + extent.join(','); }, strategy: bboxStrategy }),
  title: 'Km100scal',
  name: 'Km100scal',
  permalink:'Km100scal',
  style: function(feature, resolution) {return Km100scalStyle(feature, feature.get('km'), resolution);  },
  visible: true,
  minResolution: 0,
  maxResolution: 3 
 });
}
export function createKm500scalLayer() {
 return new VectorLayer({
 source: new VectorSource({format: new GeoJSON(), url: function (extent) {return './myLayers/km_500_scal.geojson' + '?bbox=' + extent.join(','); }, strategy: bboxStrategy }),
  title: 'Km500scal',
  name: 'Km500scal',
  permalink:'Km500scal',
  style: function(feature, resolution) {return Km500scalStyle(feature, feature.get('km'), resolution);  },
  visible: true
 
 });
}


// Basiskarten
export function creategoogleHybLayer() {
return new TileLayer({
  title: 'GoogleHybrid',
  name: 'googleHybrid',
  permalink:'googleHybrid',
  type: 'base',
  baseLayer: false,
  opacity: 1,
  visible: false,
  source: new XYZ({
    attributions: '© Google',
    url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
  })
 });
}
export function creategoogleSatLayer() {
return new TileLayer({
  title: 'GoogleSat',
  name: 'googleSat',
  permalink:'googleSat',
  type: 'base',
  baseLayer: false,
  opacity: 1,
  visible: false,
  source: new XYZ({
    attributions: '© Google',
    url: 'http://mt1.google.com/vt/lyrs=s&hl=pl&&x={x}&y={y}&z={z}'
  })
 });
}
export function createEsriWorldImageryLayer() {
return new TileLayer({
  title: 'ESRI-Sat',
  name: 'ESRISat',
  permalink:'ESRISat',
  type: 'base',
  source: new XYZ({
    attributions: 'Powered by Esri',
    url: 'https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
  }),
  opacity: 1,
  visible: false,
});
}
export function createESRIWorldGreyLayer() {
return new TileLayer({

  title: 'ESRI-Grey',
  name: 'ESRIGrey',
  permalink:'ESRIGrey',
  type: 'base',
  source: new XYZ({
      attributions: 'Powered by Esri',
      url: 'http://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}'
  }),
  opacity: 1,
  visible: false,  
});
}
export function createDop20niLayer() {
  return new TileLayer({
  title: 'DOP20 NI',
  name: 'dop20ni',
  permalink:'dop20ni',
  type: 'base',
  source: new TileWMS({
    url: "https://opendata.lgln.niedersachsen.de/doorman/noauth/dop_wms",
    attributions: 'Orthophotos Niedersachsen, LGLN',
    params: {
      "LAYERS": "ni_dop20",
      "TILED": true, 
      "VERSION": "1.3.0"
    },
  }),
  opacity: 1,
  visible: false,  
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
export function createbaseDECrLayer() {
  return new TileLayer({
     title: 'Base-DE-color',
  name: 'baseDeCr',
  permalink:'baseDECr',
  type: 'base',
  source: new TileWMS({
    url: "https://sgx.geodatenzentrum.de/wms_basemapde",
    attributions: '© GeoBasis-DE / BKG (Jahr des letzten Datenbezugs) CC BY 4.0',
    params: {
      "LAYERS": "de_basemapde_web_raster_farbe",
      "TILED": true,
      "VERSION": "1.3.0"
    },
  }),
  opacity: 1,
  visible: false,
    
  });
}
export function createbaseDEGrLayer() {
  return new TileLayer({
     title: 'Base-DE-grey',
  name: 'baseDeGr',
  permalink:'baseDEGr',
  type: 'base',
    source: new TileWMS({
    url: "https://sgx.geodatenzentrum.de/wms_basemapde",
    attributions: '© GeoBasis-DE / BKG (Jahr des letzten Datenbezugs) CC BY 4.0',
    params: {
      "LAYERS": "de_basemapde_web_raster_grau",
      "TILED": true,
      "VERSION": "1.3.0"
    },
  }),
  opacity: 1,
  visible: false,
    
  });
}


// Bauwerke Punkte
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


// Bauwerke Linien
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
  const ESRIGrey = createESRIWorldGreyLayer();
  const ESRISat = createEsriWorldImageryLayer();
  const googleHyb = creategoogleHybLayer();
  const googleSat = creategoogleSatLayer();
  const dop20ni = createDop20niLayer();
  const baseDEGr = createbaseDEGrLayer();
  const baseDECr = createbaseDECrLayer();
  const osmGrey = createOsmTileGr();
  const osmColor = createOsmTileCr();

  //Luftbilder Layer
  const NI2014 = creategnAtlas2014Layer();
  const NI2017 = creategnAtlas2017Layer();
  const NI2020 = creategnAtlas2020Layer();
  const NI2023 = creategnAtlas2023Layer();
  

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

  //Kilometrierung
  const Km10scal = createKm10scalLayer();
  const Km100scal = createKm100scalLayer();
  const Km500scal = createKm500scalLayer();


  return [
    // 🗺️ Basiskarten
    new LayerGroup({
      title: 'Base',
      layers: [
        ESRIGrey,
        ESRISat,
        googleHyb,
        googleSat,
        dop20ni,
        baseDEGr,
        baseDECr,
        osmGrey,
        osmColor
      ]
    }),
     // 🏗️ Luftbilder
    new LayerGroup({
      title: 'Luftbilder',
      layers: [
       NI2014,
        NI2017,
        NI2020,
        NI2023
        
      ],
      visible: false
    }),
    // 👉 GEW Layer 
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
      Km10scal,
      Km100scal,
      Km500scal
        
      ]
    }),

     // 🌊 Bauwerke Linien
    new LayerGroup({
      title: 'Bauw.(L)',
      layers: [
        sonLin,
        gewInfo
      ]
    }),
    // 🏗️ Bauwerke Punkte
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

