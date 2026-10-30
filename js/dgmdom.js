import { WebGLTile as WebGLTileLayer } from 'ol/layer.js';
import GeoTIFFSource from 'ol/source/GeoTIFF.js';
import { unByKey } from 'ol/Observable.js'; // WICHTIG: Hinzugefügt
import { fromArrayBuffer } from 'geotiff';
import { createEmpty, extend, containsCoordinate } from 'ol/extent.js';
import { dgmGroup, domGroup } from './layers.js';


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

// DGM - FUNKTIONEN
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
    layer.set('serviceConfig', {
        type: 'DGM',
        url: proxyUrl,
        bbox: [...bbox],
        min,
        max,
        tileId: id1
    });
    //map.addLayer(layer);
    dgmGroup.getLayers().push(layer);
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
    const layerName = activeLayer.get('name');
    const data = activeLayer.getData(evt.pixel);
    
    if (data && data[0] !== -9999 && !Number.isNaN(data[0]) && layerName) {
    const parts = layerName.split('_');
    const layerId = parts[0]; // Das wäre "1", "2" oder "Lokal"

    if (layerId === 'Lokal') {
        // Schöne Anzeige für selbst geladene Dateien
        heightValue.innerHTML = `Lokal: ${data[0].toFixed(2)} m`;
    } else {
        // Klassische Anzeige für deine Server-DGM
        heightValue.innerHTML = `DGM-Nr_${layerId}: ${data[0].toFixed(2)} m`;
    }
    
    heightStatus.style.display = 'block';
} else {
    heightStatus.style.display = 'none';
}

}
export function disableDgmInteraction() {
    if (dgmClickListener) { unByKey(dgmClickListener); dgmClickListener = null; }
    if (dgmPointerMoveListener) { unByKey(dgmPointerMoveListener); dgmPointerMoveListener = null; }
    
    const p = document.getElementById('popupForDgmDom');
    if (p) p.style.display = 'none';
    
    const hs = document.getElementById('height-status-container');
    if (hs) hs.style.display = 'none';
}

// DOM - FUNKTIONEN
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
    layer.set('serviceConfig', {
        type: 'DOM',
        url: proxyUrl,
        bbox: [...bbox],
        min,
        max,
        tileId: id1
    });
    //map.addLayer(layer);
    domGroup.getLayers().push(layer);
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
// Wenn es ein Float-Raster ist, sollte data ein Float32Array sein.
// Wenn normalize: false aktiv ist, steht der echte Wert in data[0].

if (data && data.length > 0) {
    const rawValue = data[0];
    
    if (rawValue !== -9999 && !isNaN(rawValue) && rawValue !== 0) {
        // Jetzt sollte hier 16.34 etc. stehen
        //console.log("Echter Höhenwert erkannt:", rawValue);
        
        const layerName = activeLayer.get('name') || "";
        const layerNr = layerName.split('_')[0];
        heightValue.innerHTML = `DGM: ${rawValue.toFixed(2)} m`;
        heightStatus.style.display = 'block';
    }
}

}
export function disableDomInteraction() {
    if (domClickListener) { unByKey(domClickListener); domClickListener = null; }
    if (domPointerMoveListener) { unByKey(domPointerMoveListener); domPointerMoveListener = null; }
    
    const p = document.getElementById('popupForDgmDom');
    if (p) p.style.display = 'none';
    
    const hs = document.getElementById('height-status-container');
    if (hs) hs.style.display = 'none';
}

// ALLGEMEINE HILFSFUNKTIONEN
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

export function createRasterLayerFromConfig(config) {
    const { type, url, bbox, min, max, tileId } = config || {};
    if ((type !== 'DGM' && type !== 'DOM') ||
        typeof url !== 'string' ||
        !url ||
        !Array.isArray(bbox) ||
        bbox.length !== 4 ||
        !bbox.every(Number.isFinite) ||
        !Number.isFinite(min) ||
        !Number.isFinite(max)) {
        throw new Error('Die GeoTIFF-Kachelkonfiguration ist unvollständig.');
    }

    const layer = new WebGLTileLayer({
        source: new GeoTIFFSource({
            sources: [{ url }],
            projection: 'EPSG:25832',
            normalize: false,
            sourceOptions: { allowFullFile: false, cache: true }
        }),
        title: config.title,
        name: config.properties && config.properties.name || config.title,
        visible: config.visible,
        opacity: config.opacity,
        style: createGeoTiffStyle(min, max)
    });
    layer.bbox = [...bbox];
    layer.set('serviceConfig', { type, url, bbox: [...bbox], min, max, tileId });
    return layer;
}

export function syncRestoredRasterLayers(layers) {
    const restoredLayers = [];
    const collectLayers = layer => {
        restoredLayers.push(layer);
        if (typeof layer.getLayers === 'function') {
            layer.getLayers().forEach(collectLayers);
        }
    };
    layers.forEach(collectLayers);
    const restoredLayerSet = new Set(restoredLayers);
    const dgmLayers = activeDgmRasterLayers.filter(layer => restoredLayerSet.has(layer));
    const domLayers = activeDomRasterLayers.filter(layer => restoredLayerSet.has(layer));
    const dgmData = activeDgmRasterData.filter(data => restoredLayerSet.has(data.layer));
    const domData = activeDomRasterData.filter(data => restoredLayerSet.has(data.layer));
    const restoredDgms = [];
    const restoredDoms = [];

    restoredLayers.forEach(layer => {
        const config = layer.get('serviceConfig');
        if (!config || (config.type !== 'DGM' && config.type !== 'DOM')) return;

        const data = { bbox: config.bbox, min: config.min, max: config.max, layer };
        if (config.type === 'DGM') {
            if (!dgmLayers.includes(layer)) dgmLayers.push(layer);
            if (!dgmData.some(item => item.layer === layer)) dgmData.push(data);
            restoredDgms.push({ tile_id: config.tileId, bbox: config.bbox });
        } else {
            if (!domLayers.includes(layer)) domLayers.push(layer);
            if (!domData.some(item => item.layer === layer)) domData.push(data);
            restoredDoms.push({ tile_id: config.tileId, bbox: config.bbox });
        }
    });

    activeDgmRasterLayers.splice(0, activeDgmRasterLayers.length, ...dgmLayers);
    activeDomRasterLayers.splice(0, activeDomRasterLayers.length, ...domLayers);
    activeDgmRasterData.splice(0, activeDgmRasterData.length, ...dgmData);
    activeDomRasterData.splice(0, activeDomRasterData.length, ...domData);
    loadedDgms.splice(0, loadedDgms.length, ...restoredDgms);
    loadedDoms.splice(0, loadedDoms.length, ...restoredDoms);

    const dgmRange = getOverallDgmMinMax();
    if (dgmRange) {
        dgmData.forEach(data => data.layer.setStyle(createGeoTiffStyle(dgmRange.min, dgmRange.max)));
    }
    const domRange = getOverallDomMinMax();
    if (domRange) {
        domData.forEach(data => data.layer.setStyle(createGeoTiffStyle(domRange.min, domRange.max)));
    }
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