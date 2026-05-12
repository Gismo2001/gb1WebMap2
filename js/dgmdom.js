import {bbox as bboxStrategy, tile} from 'ol/loadingstrategy.js';

import { WebGLTile as WebGLTileLayer } from 'ol/layer.js';
import { dgmKachelLayer } from  '../main';

import { fromArrayBuffer } from 'geotiff';
import {  createEmpty,  extend,  containsCoordinate} from 'ol/extent.js';


export let activeDgmRasterLayers = [];  
export let activeDomRasterLayers = [];  
export let activeDgmRasterData = [];  
export let activeDomRasterData = [];  


let dgmClickListener = null;
let domClickListener = null;

let dgmPointerMoveListener = null;
let domPointerMoveListener = null;

export let loadedDgms = [];   // speichert {tile_id, bbox}
export let loadedDoms = [];   // speichert {tile_id, bbox}


let profileMode = false;
let ismobile = false;

let profilePoints = [];
let profileDraw = null;


//const dgmData = await addDgmLayer(map, tifUrl, bbox, props.tile_id);
export let isDgmActive = false;
export let isDomActive = false;

export function setDgmActive(value) {
  isDgmActive = value;
}

export function setDomActive(value) {
  isDomActive = value;
}

import GeoTIFFSource from 'ol/source/GeoTIFF.js';

let dgmLayerCounter = 0;
let domLayerCounter = 0;

export async function addDgmLayer(map, url, bbox, id1) {
  dgmLayerCounter++;
// 👉 Proxy verwenden
  const proxyUrl = url.replace(
    'https://dgm1.s3.eu-de.cloud-object-storage.appdomain.cloud',
    '/dgm'
  );
  const { min, max } = await getMinMaxFromMetadata(proxyUrl);
  const TiffSource1 = new GeoTIFFSource({
    sources: [{ url: proxyUrl }],
    projection: 'EPSG:25832',
    normalize: false,
    crossOrigin: 'anonymous',
    sourceOptions: {
      allowFullFile: false,
      cache: true
    },
  });

  const layerNameWithCounter =
    `${dgmLayerCounter}_${id1} DGM_GeoTiff`;

  const GeoTIFFLayer1 = new WebGLTileLayer({
    source: TiffSource1,
    title: layerNameWithCounter,
    name: layerNameWithCounter,
    visible: true,
    style: createGeoTiffStyle(min, max),
  });

  GeoTIFFLayer1.bbox = bbox;

  map.addLayer(GeoTIFFLayer1);

  activeDgmRasterLayers.push(GeoTIFFLayer1);

  const dgmData = {
    bbox,
    min,
    max,
    layer: GeoTIFFLayer1
  };

  activeDgmRasterData.push(dgmData);
  const overall = getOverallDgmMinMax();
  activeDgmRasterData.forEach(dgm => {
    dgm.layer.setStyle(
      createGeoTiffStyle(overall.min, overall.max)
    );
  });

  return dgmData;
}


export async function getMinMaxFromMetadata(url) {

  try {

    // 👉 Proxy verwenden
    const proxyUrl = url.replace(
      'https://dgm1.s3.eu-de.cloud-object-storage.appdomain.cloud',
      '/dgm'
    );

    const response = await fetch(proxyUrl);

    if (!response.ok) {
      throw new Error(`Server lieferte Status ${response.status}`);
    }

    const buffer = await response.arrayBuffer();

    // TIFF-Prüfung
    const view = new Uint8Array(buffer.slice(0, 2));

    const isTiff =
      (view[0] === 0x49 && view[1] === 0x49) ||
      (view[0] === 0x4d && view[1] === 0x4d);

    if (!isTiff) {
      throw new Error("Keine gültige TIFF-Datei");
    }

    const tiff = await fromArrayBuffer(buffer);

    const image = await tiff.getImage();

    const meta = image.getGDALMetadata();

    if (meta?.STATISTICS_MINIMUM && meta?.STATISTICS_MAXIMUM) {

      return {
        min: parseFloat(meta.STATISTICS_MINIMUM),
        max: parseFloat(meta.STATISTICS_MAXIMUM)
      };
    }

    // Fallback
    const raster = await image.readRasters({ samples: [0] });

    const band = raster[0];

    let min = Infinity;
    let max = -Infinity;

    for (let i = 0; i < band.length; i += 10) {

      const v = band[i];

      if (v !== -9999 && !Number.isNaN(v)) {

        if (v < min) min = v;
        if (v > max) max = v;
      }
    }

    return {
      min: min === Infinity ? 0 : min,
      max: max === -Infinity ? 100 : max
    };

  } catch (err) {

    console.error('Statistik-Fehler:', err);

    return {
      min: 0,
      max: 100
    };
  }
}
export function getOverallDgmMinMax() {
  if(activeDgmRasterData.length === 0) return null;

  let overallMin = Infinity;
  let overallMax = -Infinity;

  activeDgmRasterData.forEach(dgm => {
    if(dgm.min < overallMin) overallMin = dgm.min;
    if(dgm.max > overallMax) overallMax = dgm.max;
  });

  return {min: overallMin, max: overallMax};
}
export function getOverallDomMinMax() {
  if(activeDomRasterData.length === 0) return null;

  let overallMin = Infinity;
  let overallMax = -Infinity;

  activeDomRasterData.forEach(dom => {
    if(dom.min < overallMin) overallMin = dom.min;
    if(dom.max > overallMax) overallMax = dom.max;
  });

  return {min: overallMin, max: overallMax};
}
export function getLoadedDgmExtent() {
  if (loadedDgms.length === 0) return null;
  let extent = createEmpty();
  loadedDgms.forEach(dgm => { extend(extent, dgm.bbox);  });
  return extent;
}
export function getLoadedDomExtent() {
  if (loadedDoms.length === 0) return null;
  let extent = createEmpty();
  loadedDoms.forEach(dom => {   extend(extent, dgm.bbox);  });
  return extent;
}
export function createGeoTiffStyle(minHeight, maxHeight) {
  const NO_DATA = -9999;
  const range = (maxHeight - minHeight) || 1;
  const step = (p) => minHeight + range * p;
  return {
    color: [
      'case',
      // WICHTIG: Prüfe zusätzlich auf <= 0, um den blauen Rahmen zu vermeiden
      ['any', ['==', ['band', 1], NO_DATA], ['<=', ['band', 1], 0], ['<', ['band', 1], minHeight]],
      [0, 0, 0, 0],
      
      [
        'interpolate',
        ['linear'],
        ['band', 1],
        minHeight, [30, 60, 150, 1],      // Dunkelblau (Tief)
        step(0.15), [60, 180, 75, 1],     // Saftiges Grün (Flachland)
        step(0.4),  [220, 220, 100, 1],   // Sandiges Gelb (Hügel)
        step(0.7),  [120, 70, 30, 1],     // Dunkelbraun (Hochland)
        maxHeight,  [255, 255, 255, 1]    // Weiß (Gipfel)
      ]
    ]
  };
}


// =========================================================
// 🟢 POINTER MOVE
// =========================================================
export async function handleDgmPointerMove(evt) {
  const heightStatus = document.getElementById('height-status-container');
  const heightValue = document.getElementById('height-value-main');
  if (evt.dragging) return;
  if (!heightStatus || !heightValue) return;
  const pixel = evt.pixel;
  const coord = evt.coordinate;
  const visibleDgmLayers =
    activeDgmRasterLayers.filter(
      l => l.getVisible()
    );
  // ---------------------------------------------------------
  // keine Layer
  // ---------------------------------------------------------
  if (visibleDgmLayers.length === 0) {
    heightStatus.style.display = 'none';
    return;
  }
  // ---------------------------------------------------------
  // passenden Layer finden
  // ---------------------------------------------------------

  const activeLayer =
    visibleDgmLayers.find(layer =>
    layer.bbox &&
      containsCoordinate(
        layer.bbox,
        coord
      )
    );
  if (!activeLayer) {
    heightStatus.style.display = 'none';
    return;
  }
  // ---------------------------------------------------------
  // Höhenwert lesen
  // ---------------------------------------------------------
  const data =
    activeLayer.getData(pixel);
  if (
    data &&
    data[0] !== -9999 &&
    !Number.isNaN(data[0])
  ) {
    const layerNr =
      activeLayer
        .get('name')
        .split('_')[0];

    const height = data[0];
    heightValue.innerHTML =
      `Nr_${layerNr}: ${height.toFixed(2)} m`;
    heightStatus.style.display = 'block';
  } else {
    heightStatus.style.display = 'none';
  }
}

// =========================================================
// 🟢 ENABLE
// =========================================================
export function enableDgmInteraction(map) {

  // CLICK

  if (!dgmClickListener) {

    dgmClickListener = map.on(

      'singleclick',

      (evt) =>
        handleDgmClick(map, evt)
    );
  }

  // POINTERMOVE

  if (
    !ismobile &&
    !dgmPointerMoveListener
  ) {

    dgmPointerMoveListener = map.on(

      'pointermove',

      (evt) =>
        handleDgmPointerMove(evt)
    );
  }
}
// =========================================================
// 🔴 DISABLE
// =========================================================

export function disableDgmInteraction() {

  if (dgmClickListener) {

    unByKey(dgmClickListener);

    dgmClickListener = null;
  }

  if (dgmPointerMoveListener) {

    unByKey(dgmPointerMoveListener);

    dgmPointerMoveListener = null;
  }

  // Popup

  const popup1 =
    document.getElementById('popup1');

  if (popup1) {
    popup1.style.display = 'none';
  }

  // Hover Anzeige

  if (heightStatus) {
    heightStatus.style.display = 'none';
  }
}
