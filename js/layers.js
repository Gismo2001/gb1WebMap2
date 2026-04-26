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

import {SleStyle, WehStyle, BruAndereStyle, BruNlwknStyle, DueStyle, QueStyle, getStyleForArtEin, getStyleForArtSonPun, getStyleForArtSonLin, getStyleForArtGewInfo, getStyleForArtUmn, Km10scalStyle, Km100scalStyle, Km500scalStyle, getStyleForArtFSK } from './utils.js';
import LayerGroup from 'ol/layer/Group';
import TileWMS from 'ol/source/TileWMS';




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
export function creategnAtlasNI2023Layer() {
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
export function creategnAtlasNI2020Layer() {
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
export function creategnAtlasNI2017Layer() {
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
export function creategnAtlasNI2014Layer() {
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
export function creategnAtlasNOH2012Layer() {
return new TileLayer({
  title: 'NOH2012',
  name: 'NOH2012',
  permalink:'NOH2012',
  source: new TileWMS(({
      url: "https://geo.grafschaft.de/arcgis/services/Migratrion_Okt_2020/BAS_Luftbilder_2/MapServer/WMSServer",
      attributions: ' ',
     params: {"LAYERS": "9", "TILED": "true", "VERSION": "1.3.0"},
    })),
  opacity: 1,
  visible: false,
});
}
export function creategnAtlasNI2011Layer() {
return new TileLayer({
  title: 'NI2011',
  name: 'NI2011',
  permalink:'NNI2011',
  source: new TileWMS(({
    url: "https://opendata.lgln.niedersachsen.de/doorman/noauth/doph_wms?",
    attributions: ' ',
    params: {"LAYERS": "ni_dop20h_rgb_2011", "TILED": "true", "VERSION": "1.3.0"},
  })),
  opacity: 1,
  visible: false,
});
}
export function creategnAtlasNOH2010Layer () {
return new TileLayer({
  title: 'NOH2010',
  name: 'NOH2010',
  permalink:'NOH2010',
  source: new TileWMS(({
      url: "https://geo.grafschaft.de/arcgis/services/Migratrion_Okt_2020/BAS_Luftbilder_2/MapServer/WMSServer",
      attributions: ' ',
     params: {"LAYERS": "8", "TILED": "true", "VERSION": "1.3.0"},
    })),
  opacity: 1,
  visible: false,
});
}
export function creategnAtlasNI2009Layer () {
return new TileLayer({
  title: 'NI2009',
  name: 'NI2009',
  permalink:'NI2009',
   source: new TileWMS(({
    url: "https://opendata.lgln.niedersachsen.de/doorman/noauth/doph_wms?",
    attributions: ' ',
    params: {"LAYERS": "ni_dop20h_rgb_2009", "TILED": "true", "VERSION": "1.3.0"},
  })),
  opacity: 1,
  visible: false,
});
}
export function creategnAtlasNOH2009Layer () {
return new TileLayer({
  title: 'NOH2009',
  name: 'NOH2009',
  permalink:'NOH2009',
  source: new TileWMS(({
      url: "https://geo.grafschaft.de/arcgis/services/Migratrion_Okt_2020/BAS_Luftbilder_2/MapServer/WMSServer",
      attributions: ' ',
     params: {"LAYERS": "7", "TILED": "true", "VERSION": "1.3.0"},
    })),
  opacity: 1,
  visible: false,
});
}
export function creategnAtlasNOH2002Layer() {
return new TileLayer({
  title: 'NOH2002',
  name: 'NOH2002',
  permalink:'NOH2002',
  source: new TileWMS(({
      url: "https://geo.grafschaft.de/arcgis/services/Migratrion_Okt_2020/BAS_Luftbilder_2/MapServer/WMSServer",
      attributions: ' ',
     params: {"LAYERS": "6", "TILED": "true", "VERSION": "1.3.0"},
    })),
  opacity: 1,
  visible: false,
});
}
export function creategnAtlasNOH1990Layer() {
return new TileLayer({
  title: 'NOH1990',
  name: 'NOH1990',
  permalink:'NOH1990',
  source: new TileWMS(({
      url: "https://geo.grafschaft.de/arcgis/services/Migratrion_Okt_2020/BAS_Luftbilder_2/MapServer/WMSServer",
      attributions: ' ',
     params: {"LAYERS": "5", "TILED": "true", "VERSION": "1.3.0"},
    })),
  opacity: 1,
  visible: false,
});
}
export function creategnAtlasNOH1980Layer() {
return new TileLayer({
  title: 'NOH1980',
  name: 'NOH1980',
  permalink:'NOH1980',
  source: new TileWMS(({
      url: "https://geo.grafschaft.de/arcgis/services/Migratrion_Okt_2020/BAS_Luftbilder_2/MapServer/WMSServer",
      attributions: ' ',
     params: {"LAYERS": "4", "TILED": "true", "VERSION": "1.3.0"},
    })),
  opacity: 1,
  visible: false,
});
}
export function creategnAtlasNOH1970Layer() {
return new TileLayer({
  title: 'NOH1970',
  name: 'NOH1970',
  permalink:'NOH1970',
  source: new TileWMS(({
      url: "https://geo.grafschaft.de/arcgis/services/Migratrion_Okt_2020/BAS_Luftbilder_2/MapServer/WMSServer",
      attributions: ' ',
     params: {"LAYERS": "3", "TILED": "true", "VERSION": "1.3.0"},
    })),
  opacity: 1,
  visible: false,
});
}
export function creategnAtlasNOH1957Layer() {
return new TileLayer({
  title: 'NOH1957',
  name: 'NOH1957',
  permalink:'NOH1957',
  source: new TileWMS(({
      url: "https://geo.grafschaft.de/arcgis/services/Migratrion_Okt_2020/BAS_Luftbilder_2/MapServer/WMSServer",
      attributions: ' ',
     params: {"LAYERS": "2", "TILED": "true", "VERSION": "1.3.0"},
    })),
  opacity: 1,
  visible: false,
});
}
export function creategnAtlasNOH1937Layer () {
return new TileLayer({
  title: 'NOH1937',
  name: 'NOH1937',
  permalink:'NOH1937',
  source: new TileWMS(({
      url: "https://geo.grafschaft.de/arcgis/services/Migratrion_Okt_2020/BAS_Luftbilder_2/MapServer/WMSServer",
      attributions: ' ',
     params: {"LAYERS": "1", "TILED": "true", "VERSION": "1.3.0"},
    })),
  opacity: 1,
  visible: false,
});
}

// Station (Kilometrierung) Layer
export function createKm10scalLayer() {
 return new VectorLayer({
  source: new VectorSource({format: new GeoJSON(), url: function (extent) {return '/myLayers/km_10_scal.geojson' + '?bbox=' + extent.join(','); }, strategy: bboxStrategy }),
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
 source: new VectorSource({format: new GeoJSON(), url: function (extent) {return '/myLayers/km_100_scal.geojson' + '?bbox=' + extent.join(','); }, strategy: bboxStrategy }),
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
 source: new VectorSource({format: new GeoJSON(), url: function (extent) {return '/myLayers/km_500_scal.geojson' + '?bbox=' + extent.join(','); }, strategy: bboxStrategy }),
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
      attributions: ['© OpenStreetMap contributors', 'Tiles courtesy of <a href="https://www.openstreetmap.org/"></a>'],
    }),
    opacity: 0.75,
    visible: true, 
  });
}
export function createOsmTileGr() {
  return new TileLayer({
    title: 'osm-grey',
    name: 'osmgrey',
    permalink: 'osmgrey',
    className: 'base-grey',
    type: 'base',
    
    source: new OSM({
      url: 'http://tile.openstreetmap.org/{z}/{x}/{y}.png',
      
      attributions: ['© OpenStreetMap contributors', 'Tiles courtesy of <a href="https://www.openstreetmap.org/"></a>'],
    }),
    opacity: 1,
    visible: false,
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

export function createbaseTopPlusLayer() {
return new TileLayer({
title: 'TopPlus',
  name: 'TopPlus',
  permalink:'TopPlus',
  type: 'base',
  'TopPlusOpen': 'https://sgx.geodatenzentrum.de/wms_topplus_open?request=GetCapabilities&service=wms',

  source: new TileWMS({
    url: "https://sgx.geodatenzentrum.de/wms_topplus_open",
    attributions: '© GeoBasis-DE / BKG (Jahr des letzten Datenbezugs) CC BY 4.0',
    params: {
      "LAYERS": "web",
      "TILED": true,
      "VERSION": "1.3.0"
    },
  }),
  opacity: 1,
  visible: true,


}

)


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

export function createFskLayer(){
return  new VectorLayer({
  source: new VectorSource({
    format: new GeoJSON(), 
    url: function (extent) 
    {return '/myLayers/exp_allgm_fsk.geojson?bbox=' + extent.join(',');

     }, 
    strategy: bboxStrategy
    }),
  title: 'fsk',
  name: 'fsk', 
  permalink:'fsk', 
  style: getStyleForArtFSK,
  visible: false,
  minResolution: 0,
  maxResolution: 4
})


}

// Bauwerke Linien
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
export function createExpBwUMassnLayer() {
  return new VectorLayer({
    source: new VectorSource({
      format: new GeoJSON(), 
      url: function (extent) {
        return '/myLayers/exp_gew_umn.geojson' + '?bbox=' + extent.join(','); 
      }, 
      strategy: bboxStrategy
    }),
  title: 'U-Maßnahmen', 
  name: 'gew_umn',
  permalink: 'gew_umn',
  style: getStyleForArtUmn,
  visible: false
  });
}

// FSK-Layer

//WMS-Layer
export function createGewWmsFgLayer() {
  return new TileLayer({
  source: new TileWMS({
    url:  'https://www.umweltkarten-niedersachsen.de/arcgis/services/Hydro_wms/MapServer/WMSServer',
    params: {
      'LAYERS': 'Gewässernetz',
      'FORMAT': 'image/png',
      'TRANSPARENT': true,
      'TILED': true,
    },
  }),
  title: 'gewWms',
  name: 'Gewaesser',
  permalink:'Gewaesser',
  visible: false,
  opacity: 1,
});
}
export function createWmsWrrlFgLayer() {
  return new TileLayer({
  source: new TileWMS({
    url:  'https://www.umweltkarten-niedersachsen.de/arcgis/services/WRRL_wms/MapServer/WMSServer',
    params: {
      'LAYERS': 'Natuerliche_erheblich_veraenderte_und_kuenstliche_Fliessgewaesser',
      'FORMAT': 'image/png',
      'TRANSPARENT': true,
      'TILED': true,
    },
  }),
  title: 'Fließgew.',
  name: 'Fließgew',
  permalink:'Fließgew',
  visible: true,
  opacity: 1,
});
}
export function createwmsUesgLayer() {
  return new TileLayer({
  source: new TileWMS({
    url:  'https://www.umweltkarten-niedersachsen.de/arcgis/services/HWSchutz_wms/MapServer/WMSServer',
    params: {
      'LAYERS': 'Überschwemmungsgebiete_Verordnungsfläechen_Niedersachsen11182',
      'FORMAT': 'image/png',
      'TRANSPARENT': true,
      'TILED': true,
    },
  }),  
  title: 'ÜSG',
  name: 'UESG',
  permalink:'UESG',
  visible: false,
  opacity: .5,

});
}
export function createwmsNsgLayer() {
  return new TileLayer({

  title: "NSG",
  name: "NSG",
  permalink:'NSG',  
  source: new TileWMS({
    url: 'https://www.umweltkarten-niedersachsen.de/arcgis/services/Natur_wms/MapServer/WMSServer',
    params: {
      'LAYERS': 'Naturschutzgebiet',
      'FORMAT': 'image/png',
      'TRANSPARENT': true,
      'TILED': true,
    },
  }),
  visible: false,
  opacity: .5,
});
}
export function createwmsLsgLayer() {
  return new TileLayer({
  title: "LSG",
  name: "LSG",
  permalink:'LSG',  
  source: new TileWMS({
    url: 'https://www.umweltkarten-niedersachsen.de/arcgis/services/Natur_wms/MapServer/WMSServer',
    params: {
      'LAYERS': 'Landschaftsschutzgebiet',
      'FORMAT': 'image/png',
      'TRANSPARENT': true,
      'TILED': true,
    },
  }),
  attributions: '© Mu Niedersachsen',
  visible: false,
  opacity: .5,
});
}
export function createwmsNibisLayer() {
  return new TileLayer({
  title: "Nibis Bohrdaten", // Für die Anzeige im LayerSwitcher
  name: "Nibis Bohrdaten",
  permalink: 'nibis_bohrdaten', 
  source: new TileWMS({
    url: 'https://nibis.lbeg.de/net3/public/ogc.ashx?PkgId=37',
    params: {
      'LAYERS': 'group_817',
      'FORMAT': 'image/png',
      'TRANSPARENT': true,
      'TILED': true,
      'VERSION': '1.3.0' // Sicherstellen, dass die Koordinatenordnung stimmt
    },
    attributions: '© LBEG Niedersachsen',
    crossOrigin: 'anonymous' // Wichtig, falls du später Export-Funktionen nutzt
  }),
  visible: false,
});
}

export function createwmsAlkisLayer() {
  return new TileLayer({
  title: 'ALKIS',
  name: 'ALKIS',
  permalink:'ALKIS',
  type: 'base',
  source: new TileWMS({
    url: "https://opendata.lgln.niedersachsen.de/doorman/noauth/alkis_wms?",
    attributions: '© LGLN',
    params: {
      "LAYERS": "ALKIS",
      "TILED": true, // "true" sollte ohne Anführungszeichen sein
      "VERSION": "1.3.0"
    },
  }),
  attributions: 'LGLN',
  visible: false,  
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
  const topoPlus = createbaseTopPlusLayer();

  //Luftbilder Layer
  const NOH1937 = creategnAtlasNOH1937Layer();
  const NOH1957 = creategnAtlasNOH1957Layer ();
  const NOH1970 = creategnAtlasNOH1970Layer();
  const NOH1980 = creategnAtlasNOH1980Layer();
  const NOH1990 = creategnAtlasNOH1990Layer();
  const NOH2002 = creategnAtlasNOH2002Layer();
  const NI2009 = creategnAtlasNI2009Layer();
  const NOH2009 = creategnAtlasNOH2009Layer();
  const NOH2010 = creategnAtlasNOH2010Layer();
  const NI2011 = creategnAtlasNI2011Layer();
  const NOH2012 = creategnAtlasNOH2012Layer();
  const NI2014 = creategnAtlasNI2014Layer();
  const NI2017 = creategnAtlasNI2017Layer();
  const NI2020 = creategnAtlasNI2020Layer();
  const NI2023 = creategnAtlasNI2023Layer();
  
  //FSK-Layer
  const fsk = createFskLayer();

  // Gewässernetz
  const gew = createGewLayer();

  //WMS-Layer
  const gewWms = createGewWmsFgLayer();
  const fgWrrlWms = createWmsWrrlFgLayer();
  const uesgWms = createwmsUesgLayer();
  const nsgWms = createwmsNsgLayer();
  const lsgWms = createwmsLsgLayer() ;
  const nibisWms = createwmsNibisLayer();
  const alkisWms = createwmsAlkisLayer();

  //Kilometrierung
  const Km10scal = createKm10scalLayer();
  const Km100scal = createKm100scalLayer();
  const Km500scal = createKm500scalLayer();

   //Linien  Layer
  const umnLin = createExpBwUMassnLayer();
  const sonLin = createExpBwSonLinLayer();
  const gewInfo = createExpGewInfoLayer();

  //Punkte  Layer
  const sle = createExpBwSleLayer();
  const weh = createExpBwWehLayer();
  const bruAndere = createExpBwBruAndereLayer();
  const bruNlwkn = createExpBwBruNlwknLayer();
  const due = createExpBwDueLayer();
  const que = createExpBwQueLayer();
  const ein = createExpBwEinLayer();
  const sonPun = createExpBwSonPunLayer();
 
   

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
        osmColor,
        topoPlus
      ]
    }),
     // 🏗️ Luftbilder
    new LayerGroup({
      title: 'Luftbilder',
      layers: [
        NOH1937, 
        NOH1957,
        NOH1970,
        NOH1980,
        NOH1990,
        NOH2002,
        NOH2009,
        NI2009,
        NOH2010,
        NI2011,
        NOH2012,
        NI2014,
        NI2017,
        NI2020,
        NI2023
        
      ],
      visible: false
    }),
    
    // 🏗️ FSK-Layer
    fsk,

    // 👉 GEW Layer 
    gew,
         // 🏗️ WMS-Layer
    new LayerGroup({
      title: 'WMS-Layer',
      visible: false,
      layers: [
        alkisWms,
        nibisWms,
        nsgWms,
        lsgWms,
        uesgWms,
        fgWrrlWms,
        gewWms

       ]
    }),
    // 🏗️ Station
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
        umnLin,
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

