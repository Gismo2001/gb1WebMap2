import './style.css';
import 'core-js/stable';
import 'ol/ol.css';
import 'ol-ext/dist/ol-ext.css'; 
import 'tabulator-tables/dist/css/tabulator.min.css';


import { createMap } from './js/map.js';
import { createLayerStructure } from './js/layers.js';

import { createLayerSwitcher } from './js/controls.js';
import { createMainToolbar } from './js/controls.js';

import { registerProjections } from './js/projection.js';

import { initTable } from './js/table.js';
import { closeTable, getTableDocument } from './js/table.js';
import { switchLayerData } from './js/table.js';
import { getTableActive } from './js/table.js';  



import { initMapClick } from './js/mapEvents.js';
import { initPopup } from './js/mapEvents.js';
import { switcherDrawList } from './js/switcher.js';
import { switcherToggle } from './js/switcher.js';
import { getClickResults } from './js/mapEvents.js';
import { updateTableFromVisibleLayers  } from './js/mapEvents.js';
import { getVisibleVectorFeatures } from './js/mapEvents.js';
import { isTableActive } from './js/controls.js';

import { searchPlaceControlFunc } from './js/controls.js';
import { initSearchEvents } from './js/mapEvents.js'; // Import hinzufügen
import { initPtn } from './js/ptn.js'; // 👈 Sicherstellen, dass initPtn importiert ist!

import { initPrintControl } from './js/controls.js';
import { initializeWMS } from './js/controls.js'; // Pfad anpassen

import { isDgmActive, addDgmLayer, getLoadedDgmExtent,getOverallDgmMinMax } from './js/dgmdom.js';
import { isDomActive, addDomLayer, getLoadedDomExtent,getOverallDomMinMax } from './js/dgmdom.js';
import { getMinMaxFromMetadata , createGeoTiffStyle } from './js/dgmdom.js';

import { createDgmKachelLayer, createDomKachelLayer } from './js/layers.js';
import $ from 'jquery';
import Chart from 'chart.js/auto';

import { detachTableWindow, getTableChildWindow } from './js/table.js';

import { createProfilLayer } from './js/layers.js';
import { profileMode } from './js/chart.js';

import { fromArrayBuffer } from 'geotiff';
import { toLonLat } from 'ol/proj';
import Feature from 'ol/Feature';
import VectorSource from 'ol/source/Vector';
import VectorLayer from 'ol/layer/Vector';
import Point from 'ol/geom/Point';
import LineString from 'ol/geom/LineString';
import { Circle as CircleStyle, Fill, Stroke, Style } from 'ol/style';
import piexif from 'piexifjs';

import { loadedDgms, loadedDoms } from './js/dgmdom.js';  

import { initPermalinkButton  } from './js/controls.js';

import { initDrawing } from './js/myDraw.js'; // 💡 Hierher verschieben!



window.$ = window.jQuery = $;
window.Chart = Chart;


let activeTableInstance = null;

let activeDgmRasterData = [];  
let activeDomRasterData = [];  

function refreshTableFromSelector() {
  const clickResults = getClickResults();
  const vectorResults = getVisibleVectorFeatures(map);
  const combinedResults = { ...clickResults, ...vectorResults };
  switchLayerData(combinedResults);
}

window.refreshTableFromSelector = refreshTableFromSelector;


//Variable für die Split-Instanz, damit sie global zugänglich ist
let splitInstance = null;

// Projektionen registrieren (Projection.js)
registerProjections();


// Layer erstellen
const layers = createLayerStructure();

// Layer zur Map
export const map = createMap('map', layers);

// LayerSwitcher hinzufügen
const layerSwitcher = createLayerSwitcher(map);
map.addControl(layerSwitcher);
export { layerSwitcher };

// Toolbar erstellen und hinzufügen
const toolbar = createMainToolbar(map);
map.addControl(toolbar);

// ... Karte erstellen ...
const searchPlaceControl = searchPlaceControlFunc(); // Die Ortssuche und der zugehörige Button wird erstellt (control.js)
map.addControl(searchPlaceControl); // Ortssuche hinzugefügen
initSearchEvents(searchPlaceControl, map); // eventhandler Ortssuche erstellen
initMapClick(map); // eventhandler für Click auf die Karte (mapEvents.js)
initPopup(map); // Popup-Overlay erstellen (mapEvents.js)
initPrintControl(map);//Contols laden für den Print-Button (control.js)
switcherDrawList(layerSwitcher);
switcherToggle(layerSwitcher);

initializeWMS(map);

map.updateSize();


const menuBtn = document.getElementById('mobile-menu-btn');
const closeBtn = document.getElementById('close-sidebar-btn');
const sidebar = document.getElementById('mobile-sidebar');
const overlay = document.getElementById('sidebar-overlay');
const takePhotoBtn = document.getElementById('take-photo-btn');
const cameraInput = document.getElementById('camera-input');
const photoDescription = document.getElementById('photo-description');
const photoStorageStatus = document.getElementById('photo-storage-status');
const cancelPhotoLocationBtn = document.getElementById('cancel-photo-location-btn');
const photoLocationActions = document.getElementById('photo-location-actions');
const choosePhotoLocationBtn = document.getElementById('choose-photo-location-btn');
const choosePhotoDirectionBtn = document.getElementById('choose-photo-direction-btn');
const savePhotoBtn = document.getElementById('save-photo-btn');
let pendingPhoto = null;
let photoLocation = null;
let photoSelectionStage = 'location';

const photoSelectionSource = new VectorSource();
const photoSelectionLayer = new VectorLayer({
  source: photoSelectionSource,
  zIndex: 1001,
  style: (feature) => feature.get('selectionType') === 'direction'
    ? new Style({
      stroke: new Stroke({ color: '#d62f2f', width: 4 }),
      image: new CircleStyle({ radius: 7, fill: new Fill({ color: '#d62f2f' }), stroke: new Stroke({ color: '#fff', width: 2 }) })
    })
    : new Style({
      image: new CircleStyle({ radius: 9, fill: new Fill({ color: '#1976d2' }), stroke: new Stroke({ color: '#fff', width: 3 }) })
    })
});
map.addLayer(photoSelectionLayer);

function setPhotoLocationMode(active) {
  window.photoLocationSelectionActive = active;
  cancelPhotoLocationBtn.hidden = !active;
  photoLocationActions.hidden = !active;
  if (!active) photoSelectionSource.clear();
}

function updatePhotoSelectionDisplay() {
  photoSelectionSource.clear();
  if (!photoLocation) return;

  photoSelectionSource.addFeature(new Feature({
    geometry: new Point(photoLocation.mapCoordinate),
    selectionType: 'location'
  }));

  if (photoLocation.directionCoordinate) {
    photoSelectionSource.addFeature(new Feature({
      geometry: new LineString([photoLocation.mapCoordinate, photoLocation.directionCoordinate]),
      selectionType: 'direction'
    }));
  }
}

function updatePhotoSelectionControls() {
  savePhotoBtn.disabled = !photoLocation?.directionCoordinate;
  choosePhotoLocationBtn.classList.toggle('active', photoSelectionStage === 'location');
  choosePhotoDirectionBtn.classList.toggle('active', photoSelectionStage === 'direction');
}

function decimalToExifCoordinate(value) {
  const absoluteValue = Math.abs(value);
  const degrees = Math.floor(absoluteValue);
  const minutesValue = (absoluteValue - degrees) * 60;
  const minutes = Math.floor(minutesValue);
  const seconds = Math.round((minutesValue - minutes) * 60000);
  return [[degrees, 1], [minutes, 1], [seconds, 1000]];
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function addGpsExif(file, latitude, longitude, direction) {
  if (file.type !== 'image/jpeg' && file.type !== 'image/jpg') return file;

  const dataUrl = await fileToDataUrl(file);
  const exifData = {
    GPS: {
      [piexif.GPSIFD.GPSVersionID]: [2, 3, 0, 0],
      [piexif.GPSIFD.GPSLatitudeRef]: latitude >= 0 ? 'N' : 'S',
      [piexif.GPSIFD.GPSLatitude]: decimalToExifCoordinate(latitude),
      [piexif.GPSIFD.GPSLongitudeRef]: longitude >= 0 ? 'E' : 'W',
      [piexif.GPSIFD.GPSLongitude]: decimalToExifCoordinate(longitude),
      [piexif.GPSIFD.GPSImgDirectionRef]: 'T',
      [piexif.GPSIFD.GPSImgDirection]: [Math.round(direction * 100), 100]
    }
  };
  const exifBytes = piexif.dump(exifData);
  const imageWithExif = piexif.insert(exifBytes, dataUrl);
  const imageBlob = await fetch(imageWithExif).then((response) => response.blob());
  return new File([imageBlob], file.name, { type: 'image/jpeg', lastModified: file.lastModified });
}

async function finishPhotoLocationSelection() {
  const directionPoint = map.getCoordinateFromPixel(photoLocation.directionPixel);
  const dx = directionPoint[0] - photoLocation.mapCoordinate[0];
  const dy = directionPoint[1] - photoLocation.mapCoordinate[1];
  const direction = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;

  try {
    const photoWithExif = await addGpsExif(
      pendingPhoto.file,
      photoLocation.latitude,
      photoLocation.longitude,
      direction
    );
    downloadPhoto(photoWithExif);
    await savePhoto(photoWithExif, pendingPhoto.description, {
      latitude: photoLocation.latitude,
      longitude: photoLocation.longitude,
      direction
    });
    photoStorageStatus.textContent = photoWithExif.type === 'image/jpeg'
      ? 'Foto mit GPS-EXIF-Daten gespeichert.'
      : 'Foto gespeichert. GPS-Daten liegen separat vor; EXIF wird nur für JPEG geschrieben.';
    photoDescription.value = '';
  } catch (error) {
    console.error('Foto konnte nicht gespeichert werden:', error);
    photoStorageStatus.textContent = 'Foto konnte nicht gespeichert werden.';
  } finally {
    pendingPhoto = null;
    photoLocation = null;
    setPhotoLocationMode(false);
  }
}

map.on('singleclick', (event) => {
  if (!pendingPhoto) return;

  if (photoSelectionStage === 'location') {
    const [longitude, latitude] = toLonLat(event.coordinate);
    photoLocation = {
      mapCoordinate: event.coordinate,
      latitude,
      longitude,
      directionPixel: null,
      directionCoordinate: null
    };
    photoSelectionStage = 'direction';
    updatePhotoSelectionDisplay();
    updatePhotoSelectionControls();
    photoStorageStatus.textContent = 'Standort markiert. Klicke jetzt in die Blickrichtung.';
    return;
  }

  if (photoLocation) {
    photoLocation.directionPixel = event.pixel;
    photoLocation.directionCoordinate = event.coordinate;
    updatePhotoSelectionDisplay();
    updatePhotoSelectionControls();
    photoStorageStatus.textContent = 'Standort und Richtung markiert. Du kannst die Auswahl ändern oder das Foto speichern.';
  }
});

function openPhotoDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('gb1WebMap2', 1);

    request.onupgradeneeded = () => {
      request.result.createObjectStore('photos', { keyPath: 'id', autoIncrement: true });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function savePhoto(file, description, location = {}) {
  const database = await openPhotoDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction('photos', 'readwrite');
    transaction.objectStore('photos').add({
      photo: file,
      description,
      originalName: file.name,
      type: file.type,
      capturedAt: new Date().toISOString(),
      ...location
    });
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error);
    };
  });
}

function downloadPhoto(file) {
  const timestamp = new Date().toISOString().replace(/[.:]/g, '-');
  const extension = file.type.split('/')[1] || 'jpg';
  const downloadUrl = URL.createObjectURL(file);
  const downloadLink = document.createElement('a');

  downloadLink.href = downloadUrl;
  downloadLink.download = `foto-${timestamp}.${extension}`;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  downloadLink.remove();
  URL.revokeObjectURL(downloadUrl);
}

function openSidebar() {
  sidebar.classList.add('open');
  overlay.classList.add('active');
}

function closeSidebar() {
  sidebar.classList.remove('open');
  overlay.classList.remove('active');
  
  if (window.map) {
    setTimeout(() => map.updateSize(), 300);
  }
}

// Event-Listener fürs Öffnen & Schließen
menuBtn.addEventListener('click', (e) => {
  e.stopPropagation(); // Verhindert, dass die Karte im Hintergrund Klicks registriert
  openSidebar();
});

closeBtn.addEventListener('click', closeSidebar);
overlay.addEventListener('click', closeSidebar);
takePhotoBtn.addEventListener('click', () => cameraInput.click());
choosePhotoLocationBtn.addEventListener('click', () => {
  photoSelectionStage = 'location';
  photoStorageStatus.textContent = 'Klicke auf der Karte auf den Aufnahmestandort.';
  updatePhotoSelectionControls();
});
choosePhotoDirectionBtn.addEventListener('click', () => {
  if (!photoLocation) return;
  photoSelectionStage = 'direction';
  photoStorageStatus.textContent = 'Klicke auf der Karte in die Blickrichtung.';
  updatePhotoSelectionControls();
});
savePhotoBtn.addEventListener('click', finishPhotoLocationSelection);
cancelPhotoLocationBtn.addEventListener('click', () => {
  pendingPhoto = null;
  photoLocation = null;
  setPhotoLocationMode(false);
  updatePhotoSelectionControls();
  photoStorageStatus.textContent = 'Standortauswahl abgebrochen.';
});
cameraInput.addEventListener('change', async () => {
  const [file] = cameraInput.files;
  if (!file) return;

  pendingPhoto = { file, description: photoDescription.value.trim() };
  photoLocation = null;
  photoSelectionStage = 'location';
  setPhotoLocationMode(true);
  updatePhotoSelectionControls();
  photoStorageStatus.textContent = 'Klicke auf die Karte, um den Aufnahmestandort zu wählen.';
  cameraInput.value = '';
});

/**
 * Generiert das Accordion-Menü für die Legenden der Gruppe "Bauw.(P)"
 * @param {ol.Map} map - Deine OpenLayers-Karteninstanz
 */
export function initBauwerkeLegendAccordion(map) {
  const container = document.getElementById('bauwerke-accordion');
  if (!container) return;

  container.innerHTML = ''; // Vorher leeren

  // 1. Rekursive Suche nach der Gruppe "Bauw.(P)"
  function findGroup(layerGroup, title) {
    const layers = layerGroup.getLayers().getArray();
    for (let layer of layers) {
      if (layer.get('title') === title && typeof layer.getLayers === 'function') {
        return layer;
      }
      if (typeof layer.getLayers === 'function') {
        const found = findGroup(layer, title);
        if (found) return found;
      }
    }
    return null;
  }

  const bauwerkeGruppe = findGroup(map.getLayerGroup(), 'Bauw.(P)');

  if (!bauwerkeGruppe) {
    container.innerHTML = '<p style="font-size:12px; color:#888;">Gruppe "Bauw.(P)" nicht gefunden.</p>';
    return;
  }

  // 2. Alle Sub-Layer der Gruppe durchgehen
  const subLayers = bauwerkeGruppe.getLayers().getArray();

  subLayers.forEach((layer) => {
    const layerTitle = layer.get('title') || 'Unbenannter Layer';
    
    // WMS-Legenden-URL abfragen (nutzt deine bestehende Funktion)
    const source = typeof layer.getSource === 'function' ? layer.getSource() : null;
    const legendUrl = typeof getWmsLegendUrl === 'function' ? getWmsLegendUrl(source) : null;

    // Accordion-Item-DOM-Elemente bauen
    const itemEl = document.createElement('div');
    itemEl.className = 'accordion-item';

    const headerBtn = document.createElement('button');
    headerBtn.className = 'accordion-header';
    headerBtn.innerHTML = `
      <span>${layerTitle}</span>
      <span class="accordion-icon">▼</span>
    `;

    const contentEl = document.createElement('div');
    contentEl.className = 'accordion-content';

    // Inhalt befüllen: WMS-Bild oder Platzhalter für Vektordaten
    if (legendUrl) {
      contentEl.innerHTML = `<img src="${legendUrl}" alt="Legende ${layerTitle}" />`;
    } else {
      contentEl.innerHTML = `<span style="font-size:12px; color:#666;">Keine Bildlegende verfügbar.</span>`;
    }

    // Toggle-Event beim Klick auf den Header
    headerBtn.addEventListener('click', () => {
      const isActive = itemEl.classList.contains('active');
      
      // Optional: Alle anderen Items einklappen (Accordion-Effekt)
      container.querySelectorAll('.accordion-item').forEach(el => el.classList.remove('active'));

      if (!isActive) {
        itemEl.classList.add('active');
      }
    });

    itemEl.appendChild(headerBtn);
    itemEl.appendChild(contentEl);
    container.appendChild(itemEl);
  });
}
// permalinkButton aktivieren, 
initPermalinkButton(map);

initDrawing(map);

export const dgmKachelLayer = createDgmKachelLayer();
export const domKachelLayer = createDomKachelLayer();
const container = document.getElementById('popup-content');
//Hier vielleicht if für dgm oder dom
container.addEventListener('click', async function (event) {
  if (event.target.classList.contains('popup-link')) {
    const tifUrl = event.target.dataset.tif;
    const tileId = event.target.dataset.tile_id;
    const bbox = JSON.parse(event.target.dataset.bbox);
    enableDgmInteraction(map);
    const dgmData = await addDgmLayer(map, tifUrl, bbox, tileId);
    const totalBBox = getLoadedDgmExtent();
    if (totalBBox) {
      // map.getView().fit(totalBBox, { padding: [50,50,50,50], duration: 700 });
    }
    container.style.display = 'none';
  }
});
  
const mainSelector = document.getElementById('layer-selector');
if (mainSelector) {
  mainSelector.addEventListener('change', refreshTableFromSelector);
}

initTable(map);
initPtn(map); 
// Der Event-Listener für den Popout-Button in main.js
document.getElementById('popout-table-btn').addEventListener('click', () => {
    const childWin = getTableChildWindow();
    if (childWin && !childWin.closed) {
        childWin.focus();
    } else {
        // Einfach nur aufrufen – kein "table" mehr übergeben!
        detachTableWindow(); 
    }
});

// Der Event-Listener für den "Daten hinzufügen"-Button in main.js
document.getElementById('add-data-btn').addEventListener('click', () => {
 
});

// 2. Schließen-Button Event-Listener in main.js
document.getElementById('close-table-btn').addEventListener('click', function(e) {
    //e.stopPropagation(); 
    closeTable(); 
});

map.on('moveend', () => {
  // Nur wenn der User die Tabelle offen hat, führen wir das Update aus
  if (getTableActive()) {
    updateTableFromVisibleLayers(map);
  }
});


// 💡 Import erweitern!
import { loadWFSCapabilities, loadWFSLayer, loadArcGISCapabilities, loadArcGISLayer } from './js/loadWfs.js';

document.getElementById('load-wfs-btn').addEventListener('click', async function () {
  const baseUrl = document.getElementById('wfs-url').value.trim();
  console.log('Eingegebene URL:', baseUrl);
  if (!baseUrl) return;

  const container = document.getElementById('wfs-layer-list');
  container.innerHTML = '<div style="padding:8px;font-size:12px;color:#666;">Lade Layer...</div>';

  try {
    let layers = [];
    const isArcGIS = baseUrl.includes('/FeatureServer');

    // 1. Unterscheidung beim Abfragen der Capabilities
    if (isArcGIS) {
      layers = await loadArcGISCapabilities(baseUrl);
    } else {
      layers = await loadWFSCapabilities(baseUrl);
    }

    container.innerHTML = ''; // Lade-Text entfernen

    if (layers.length === 0) {
      container.innerHTML = '<div style="padding:8px;font-size:12px;color:red;">Keine Layer gefunden.</div>';
      return;
    }

    // 2. Einheitliche Auswahlliste mit Buttons füllen
    layers.forEach(layerInfo => {
      const btn = document.createElement('button');
      btn.className = 'wfs-list-btn'; // Nutzt dein bestehendes Styling!
      btn.textContent = layerInfo.title;
      btn.title = layerInfo.name;
      
      btn.onclick = () => {
        if (isArcGIS) {
          // 👉 Übergibt die ArcGIS Layer-ID (z.B. 0, 1)
          loadArcGISLayer(map, baseUrl, layerInfo.id, layerInfo.name);
        } else {
          // 👉 Übergibt den WFS Layer-Namen
          loadWFSLayer(map, baseUrl, layerInfo.name);
        }
        container.innerHTML = ''; // Schließt die Liste nach Auswahl
      };
      container.appendChild(btn);
    });
    
  } catch (err) {
    console.error(err);
    container.innerHTML = '';
    alert('Fehler beim Laden der Capabilities. Bitte Server-Adresse und CORS-Berechtigungen prüfen.');
  }
});