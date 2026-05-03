import {bbox as bboxStrategy, tile} from 'ol/loadingstrategy.js';

let activeDgmRasterLayers = [];  
let activeDgmRasterData = [];  

let dgmClickListener = null;
let dgmPointerMoveListener = null;
let loadedDgms = [];   // speichert {tile_id, bbox}

let activeDomRasterLayers = [];  
let activeDomRasterData = [];  
let domClickListener = null;
let loadedDoms = [];   // speichert {tile_id, bbox}

let profileMode = false;
let ismobile = false;


let profilePoints = [];
let profileDraw = null;

let heightStatus = null;
//const heightStatus = document.getElementById('height-status-container');
let heightValue = null;

//const heightValue = document.getElementById('height-value-main');
//const dgmData = await addDgmLayer(tifUrl, bbox, props.tile_id);
export let isDgmActive = false;
export function setDgmActive(value) {
  isDgmActive = value;
}

export let isDomActive = false;


export function addDgmLayer(map, tifUrl, props) {
    let dgmLayerCounter = 0;
    const { min, max, raster, width, height } =  getMinMaxFromMetadata(url);
    const TiffSource1 = new GeoTIFFSource({ 
        sources: [{ url }], 
        projection: 'EPSG:25832', 
        normalize: false, 
        crossOrigin: 'anonymous', // Wichtig!
        sourceOptions: { allowFullFile: false, cache: true }, 
    });
    const layerNameWithCounter = `${dgmLayerCounter}_${id1} DGM_GeoTiff`;
    const GeoTIFFLayer1 = new WebGLTileLayer({
        source: TiffSource1,
        title: layerNameWithCounter,
        name: layerNameWithCounter,
        visible: true,
        //willReadFrequently: true,
        style: createGeoTiffStyle(min, max), // dynamische Graustufen
    });
    GeoTIFFLayer1.bbox = bbox;
    const dgmData = { raster, width, height, bbox, min, max, layer: GeoTIFFLayer1 };
    activeDgmRasterData.push(dgmData);
    const overall = getOverallDgmMinMax();
    activeDgmRasterData.forEach(dgm => {
        dgm.layer.setStyle(createGeoTiffStyle(overall.min, overall.max));
    });
    const totalBBox = getLoadedDgmExtent();
    if (totalBBox) {
        // map.getView().fit(totalBBox, { padding: [50, 50, 50, 50], duration: 700 });
    }
    return dgmData;

};

export async function getMinMaxFromMetadata(url) {
  try {
    const response = fetch(url);
    if (!response.ok) {
      // Wenn Netlify eine 404 oder 500 Seite liefert, bricht er hier ab
      // statt zu versuchen, das HTML als TIFF zu parsen.
      throw new Error(`Server lieferte Status ${response.status}`);
    }

    const buffer = response.arrayBuffer();
    
    // Prüfen, ob die ersten Bytes überhaupt ein TIFF sind (II oder MM)
    const view = new Uint8Array(buffer.slice(0, 2));
    const isTiff = (view[0] === 0x49 && view[1] === 0x49) || (view[0] === 0x4d && view[1] === 0x4d);
    
    if (!isTiff) {
      throw new Error("Die empfangenen Daten sind kein gültiges GeoTIFF (evtl. Proxy-Fehlerseite).");
    }

    const tiff = fromArrayBuffer(buffer);
    const image = tiff.getImage();
    const meta = image.getGDALMetadata();

    // ... Rest deiner Statistik-Logik bleibt gleich ...
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
      if (v !== -9999 && !v.isNaN) { // Nutze v.isNaN oder !isNaN(v)
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
  let extent = createEmptyExtent();
  loadedDgms.forEach(dgm => {
    extendExtent(extent, dgm.bbox);
  });
  return extent;
}

export function getLoadedDomExtent() {
  if (loadedDoms.length === 0) return null;
  let extent = createEmptyExtent();
  loadedDoms.forEach(dom => {
    extendExtent(extent, dom.bbox);
  });
  return extent;
}


// Code für DGM-Interaktion
export function enableDgmInteraction(map) {

  // 👉 Klick-Listener nur einmal setzen
  if (!dgmClickListener) {
    dgmClickListener = map.on('singleclick', (evt) => handleDgmClick(map, evt));
  }

  // 👉 PointerMove nur Desktop
  if (!ismobile && !dgmPointerMoveListener) {
    dgmPointerMoveListener = map.on('pointermove', handleDgmPointerMove());
  }
}
export async function handleDgmClick(map, evt) {
  const kachelnVisible = dgmKachelLayer && dgmKachelLayer.getVisible();
  console.log(evt.target.dataset);
  // 👉 Popup holen oder erstellen
  let popup1 = document.getElementById('popup1');
  if (!popup1) {
    popup1 = document.createElement('div');
    popup1.id = 'popup1';
    popup1.style.cssText = `
      position: absolute;
      background: white;
      padding: 6px;
      border-radius: 6px;
      border: 1px solid #ccc;
      font-size: 13px;
      z-index: 10000;
    `;
    document.body.appendChild(popup1);
  }

  // =========================================================
  // 🟢 FALL 1: DGM-Kacheln auswählen
  // =========================================================
  if (kachelnVisible) {
    let featureFound = false;

    map.forEachFeatureAtPixel(evt.pixel, (feature) => {
      featureFound = true;

      const props = feature.getProperties();

      const originalTifUrl = props.dgm1;
      const tifUrl = originalTifUrl.replace(
        'https://dgm1.s3.eu-de.cloud-object-storage.appdomain.cloud',
        '/dgm'
      );

      const bbox = feature.getGeometry().getExtent();

      const alreadyLoaded = loadedDgms.some(
        (d) => d.tile_id === props.tile_id
      );

      // 👉 Popup positionieren
      popup1.style.left = evt.pixel[0] + 'px';
      popup1.style.top = evt.pixel[1] + 'px';

const safeBbox = bbox ? JSON.stringify(bbox) : 'null';
      // 👉 Inhalt
 popup1.innerHTML = `
  <b>Kachel:</b> ${props.tile_id}<br>
  <b>Datum:</b> ${props.Aktualitaet}<br>
  ${alreadyLoaded ? '<i>bereits geladen</i><br>' : ''}
   <button 
    class="load-dgm-btn"
    data-tif="${tifUrl}"
    data-bbox='${safeBbox}'
    data-id="${props.tile_id}"
  >
    DGM laden
  </button>
`;

      popup1.style.display = 'block';

      // 👉 Button-Handler
      document.getElementById('loadDgmBtn').onclick = async function () {
        if (!alreadyLoaded) {
          const dgmData = await addDgmLayer(tifUrl, bbox, props.tile_id);

          loadedDgms.push({ tile_id: props.tile_id, bbox });
          activeDgmRasterData.push(dgmData);

          const overall = getOverallDgmMinMax();

          activeDgmRasterData.forEach((dgm) => {
            dgm.layer.setStyle(
              createGeoTiffStyle(overall.min, overall.max)
            );
          });

          const totalBBox = getLoadedDgmExtent();
          if (totalBBox) {
            // optional:
            // map.getView().fit(totalBBox, { padding: [50,50,50,50], duration: 700 });
          }
        }

        popup1.style.display = 'none';
      };
    });

    // 👉 Kein Feature getroffen
    if (!featureFound) {
      popup1.style.display = 'none';
    }

    return; // 🔴 Wichtig: danach NICHT weiter machen!
  }

  // =========================================================
  // 🔵 FALL 2: Höhenabfrage (DGM aktiv)
  // =========================================================

  const coord = map.getCoordinateFromPixel(evt.pixel);

  const dgmLayers = map.getLayers().getArray().filter((layer) => {
    const name = layer.get('name');
    return name && name.endsWith('DGM_GeoTiff') && layer.getVisible();
  });

  if (dgmLayers.length === 0) {
    popup1.style.display = 'none';
    return;
  }

  let height = null;
  let foundLayer = null;

  for (const layer of dgmLayers) {
    if (!layer.bbox || !containsCoordinate(layer.bbox, coord)) continue;

    const val = await readHeightFromGeoTIFFLayer(layer, evt.pixel);

    if (val !== null && val !== undefined && !Number.isNaN(val)) {
      height = val;
      foundLayer = layer;
      break;
    }
  }

  popup1.style.left = evt.pixel[0] + 10 + 'px';
  popup1.style.top = evt.pixel[1] - 15 + 'px';

  if (height !== null) {
    const layerNr = foundLayer.get('name').split('_')[0];

    popup1.innerHTML = `H_Nr_${layerNr}: <b>${height.toFixed(2)}</b>`;
  } else {
    popup1.innerHTML = `<i>Keine DGM-Daten an dieser Position verfügbar</i>`;
  }

  popup1.style.display = 'block';
}
function handleDgmPointerMove(evt) {
if (evt.dragging) return;
  const pixel = evt.pixel;
  const coord = evt.coordinate;
  const visibleDgmLayers = activeDgmRasterLayers.filter(l => l.getVisible());
  const heightStatus = document.getElementById('height-status');
  if (visibleDgmLayers.length === 0) {
    heightStatus.style.display = 'none';
    return;
  }
  // passenden Layer finden
  const activeLayer = visibleDgmLayers.find(layer =>
    layer.bbox && containsCoordinate(layer.bbox, coord)
  );
  //console.log('Aktive DGM-Layer:', visibleDgmLayers.map(l => l.get('name')));
  if (!activeLayer) {
    heightStatus.style.display = 'none';
    return;
  }

  const data = activeLayer.getData(pixel);

  if (data && data[0] !== -9999 && !Number.isNaN(data[0])) {

    const layerNr = activeLayer.get('name').split('_')[0];
    const height = data[0];

    heightValue.innerHTML = `Nr_${layerNr}: ${height.toFixed(2)} m`;
    heightStatus.style.display = 'block';

  } else {
    heightStatus.style.display = 'none';
  }

}