import { WebGLTile as WebGLTileLayer } from 'ol/layer.js';
import GeoTIFFSource from 'ol/source/GeoTIFF.js';
import { unByKey } from 'ol/Observable.js'; // WICHTIG: Hinzugefügt
import { fromArrayBuffer } from 'geotiff';
import { createEmpty, extend, containsCoordinate } from 'ol/extent.js';

// Exportierte Status-Listen
export let activeDgmRasterLayers = [];  
export let activeDomRasterLayers = [];  
export let activeDgmRasterData = [];  
export let activeDomRasterData = [];  

export let loadedDgms = [];   
export let loadedDoms = [];   

// Listener-Variablen (intern)
let dgmClickListener = null;
let domClickListener = null;
let dgmPointerMoveListener = null;
let domPointerMoveListener = null;

let ismobile = false; // Sollte ggf. von außen gesteuert werden

export let isDgmActive = false;
export let isDomActive = false;

export function setDgmActive(value) { isDgmActive = value; }
export function setDomActive(value) { isDomActive = value; }

let dgmLayerCounter = 0;
let domLayerCounter = 0;

// ==========================================
// DGM - FUNKTIONEN
// ==========================================

export async function addDgmLayer(map, url, bbox, id1) {
    dgmLayerCounter++;
    const proxyUrl = url.replace('https://dgm1.s3.eu-de.cloud-object-storage.appdomain.cloud', '/dgm');
    const { min, max } = await getMinMaxFromMetadata(proxyUrl, '/dgm');

    const TiffSource = new GeoTIFFSource({
        sources: [{ url: proxyUrl }],
        projection: 'EPSG:25832',
        normalize: false,
        sourceOptions: { allowFullFile: false, cache: true },
    });

    const layerName = `${dgmLayerCounter}_${id1} DGM_GeoTiff`;
    const layer = new WebGLTileLayer({
        source: TiffSource,
        title: layerName,
        name: layerName,
        visible: true,
        style: createGeoTiffStyle(min, max),
    });

    layer.bbox = bbox;
    map.addLayer(layer);
    activeDgmRasterLayers.push(layer);

    const dgmData = { bbox, min, max, layer };
    activeDgmRasterData.push(dgmData);

    const overall = getOverallDgmMinMax();
    activeDgmRasterData.forEach(d => d.layer.setStyle(createGeoTiffStyle(overall.min, overall.max)));

    return dgmData;
}

export function getOverallDgmMinMax() {
    if (activeDgmRasterData.length === 0) return null;
    let min = Infinity, max = -Infinity;
    activeDgmRasterData.forEach(d => {
        if (d.min < min) min = d.min;
        if (d.max > max) max = d.max;
    });
    return { min, max };
}

export async function handleDgmPointerMove(evt) {
    const heightStatus = document.getElementById('height-status-container');
    const heightValue = document.getElementById('height-value-main');
    if (evt.dragging || !heightStatus || !heightValue) return;

    const visibleLayers = activeDgmRasterLayers.filter(l => l.getVisible());
    if (visibleLayers.length === 0) {
        heightStatus.style.display = 'none';
        return;
    }

    const activeLayer = visibleLayers.slice().reverse().find(l => l.bbox && containsCoordinate(l.bbox, evt.coordinate));
    if (!activeLayer) {
        heightStatus.style.display = 'none';
        return;
    }

    const data = activeLayer.getData(evt.pixel);
    if (data && data[0] !== -9999 && !Number.isNaN(data[0])) {
        const layerNr = activeLayer.get('name').split('_')[0];
        heightValue.innerHTML = `DGM-Nr_${layerNr}: ${data[0].toFixed(2)} m`;
        heightStatus.style.display = 'block';
    } else {
        heightStatus.style.display = 'none';
    }
}

export function disableDgmInteraction() {
    if (dgmClickListener) { unByKey(dgmClickListener); dgmClickListener = null; }
    if (dgmPointerMoveListener) { unByKey(dgmPointerMoveListener); dgmPointerMoveListener = null; }
    
    const p = document.getElementById('popup1');
    if (p) p.style.display = 'none';
    
    const hs = document.getElementById('height-status-container');
    if (hs) hs.style.display = 'none';
}

// ==========================================
// DOM - FUNKTIONEN
// ==========================================

export async function addDomLayer(map, url, bbox, id1) {
    domLayerCounter++;
    const proxyUrl = url.replace('https://dom1.s3.eu-de.cloud-object-storage.appdomain.cloud', '/dom');
    const { min, max } = await getMinMaxFromMetadata(proxyUrl, '/dom');

    const TiffSource = new GeoTIFFSource({
        sources: [{ url: proxyUrl }],
        projection: 'EPSG:25832',
        normalize: false,
        sourceOptions: { allowFullFile: false, cache: true },
    });

    const layerName = `${domLayerCounter}_${id1} DOM_GeoTiff`;
    const layer = new WebGLTileLayer({
        source: TiffSource,
        title: layerName,
        name: layerName,
        visible: true,
        style: createGeoTiffStyle(min, max),
    });

    layer.bbox = bbox;
    map.addLayer(layer);
    activeDomRasterLayers.push(layer);

    const domData = { bbox, min, max, layer };
    activeDomRasterData.push(domData);

    const overall = getOverallDomMinMax();
    activeDomRasterData.forEach(d => d.layer.setStyle(createGeoTiffStyle(overall.min, overall.max)));

    return domData;
}

export function getOverallDomMinMax() {
    if (activeDomRasterData.length === 0) return null;
    let min = Infinity, max = -Infinity;
    activeDomRasterData.forEach(d => {
        if (d.min < min) min = d.min;
        if (d.max > max) max = d.max;
    });
    return { min, max };
}

export async function handleDomPointerMove(evt) {
    const heightStatus = document.getElementById('height-status-container');
    const heightValue = document.getElementById('height-value-main');
    if (evt.dragging || !heightStatus || !heightValue) return;

    const visibleLayers = activeDomRasterLayers.filter(l => l.getVisible());
    if (visibleLayers.length === 0) {
        heightStatus.style.display = 'none';
        return;
    }

    const activeLayer = visibleLayers.slice().reverse().find(l => l.bbox && containsCoordinate(l.bbox, evt.coordinate));
    if (!activeLayer) {
        heightStatus.style.display = 'none';
        return;
    }

    const data = activeLayer.getData(evt.pixel);
    if (data && data[0] !== -9999 && !Number.isNaN(data[0])) {
        const layerNr = activeLayer.get('name').split('_')[0];
        heightValue.innerHTML = `DOM-Nr_${layerNr}: ${data[0].toFixed(2)} m`;
        heightStatus.style.display = 'block';
    } else {
        heightStatus.style.display = 'none';
    }
}

export function disableDomInteraction() {
    if (domClickListener) { unByKey(domClickListener); domClickListener = null; }
    if (domPointerMoveListener) { unByKey(domPointerMoveListener); domPointerMoveListener = null; }
    
    const p = document.getElementById('popup1');
    if (p) p.style.display = 'none';
    
    const hs = document.getElementById('height-status-container');
    if (hs) hs.style.display = 'none';
}

// ==========================================
// ALLGEMEINE HILFSFUNKTIONEN
// ==========================================

export function createGeoTiffStyle(minHeight, maxHeight) {
    const NO_DATA = -9999;
    const range = (maxHeight - minHeight) || 1;
    const step = (p) => minHeight + range * p;
    return {
        color: [
            'case',
            ['any', ['==', ['band', 1], NO_DATA], ['<=', ['band', 1], 0], ['<', ['band', 1], minHeight]],
            [0, 0, 0, 0],
            ['interpolate', ['linear'], ['band', 1],
                minHeight, [30, 60, 150, 1],
                step(0.15), [60, 180, 75, 1],
                step(0.4),  [220, 220, 100, 1],
                step(0.7),  [120, 70, 30, 1],
                maxHeight,  [255, 255, 255, 1]
            ]
        ]
    };
}

export async function getMinMaxFromMetadata(url, typePath = '/dgm') {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Status ${response.status}`);
        const buffer = await response.arrayBuffer();
        const tiff = await fromArrayBuffer(buffer);
        const image = await tiff.getImage();
        const meta = image.getGDALMetadata();

        if (meta?.STATISTICS_MINIMUM && meta?.STATISTICS_MAXIMUM) {
            return {
                min: parseFloat(meta.STATISTICS_MINIMUM),
                max: parseFloat(meta.STATISTICS_MAXIMUM)
            };
        }

        const raster = await image.readRasters({ samples: [0] });
        const band = raster[0];
        let min = Infinity, max = -Infinity;
        for (let i = 0; i < band.length; i += 10) {
            const v = band[i];
            if (v !== -9999 && !Number.isNaN(v)) {
                if (v < min) min = v;
                if (v > max) max = v;
            }
        }
        return { min: min === Infinity ? 0 : min, max: max === -Infinity ? 100 : max };
    } catch (err) {
        console.error('Statistik-Fehler:', err);
        return { min: 0, max: 100 };
    }
}

export function getLoadedDgmExtent() {
  if (loadedDgms.length === 0) return null;
  let extent = createEmpty();
  loadedDgms.forEach(dgm => { extend(extent, dgm.bbox); });
  return extent;
}

export function getLoadedDomExtent() {
  if (loadedDoms.length === 0) return null;
  let extent = createEmpty();
  loadedDoms.forEach(dom => { extend(extent, dom.bbox); }); // Hier stand vorher dgm.bbox
  return extent;
}