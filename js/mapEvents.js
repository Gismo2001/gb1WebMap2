import { table, highlightFeatureForRow, clearHighlightedFeature, updateSelector, showTableDebounced, closeTable, getTableDocument } from './table.js';
import { isTableEnabled, isTableActive } from './controls.js';


import GeoTIFF from 'ol/source/GeoTIFF';
import GeoTIFFSource from 'ol/source/GeoTIFF';
import WebGLTileLayer from 'ol/layer/WebGLTile';

import { toLonLat, transform, fromLonLat, transformExtent } from 'ol/proj';

import { EXCLUDED_LAYERS } from './config.js';

import Overlay from 'ol/Overlay.js';
import { toStringHDMS } from 'ol/coordinate'; // z.B. für Koordinatenanzeige

import { isDgmActive, setDgmActive, isDomActive, setDomActive } from './dgmdom.js';

import { loadedDgms, loadedDoms, addDgmLayer, addDomLayer } from './dgmdom.js';  
import { activeDgmRasterLayers, activeDgmRasterData, activeDomRasterLayers, activeDomRasterData } from './dgmdom.js'
import { handleDgmPointerMove, handleDomPointerMove } from './dgmdom.js'

import { profileMode } from './chart.js';

import { Style, Circle, Fill, Stroke } from 'ol/style';

import Layer from 'ol/layer/Layer.js';

import { getStyleForArtFSK } from './utils.js';

import {  createEmpty,  extend,  containsCoordinate} from 'ol/extent.js';
import { istZeichenleisteAktiv } from './myDraw.js';


import GeoJSON from 'ol/format/GeoJSON';
import KML from 'ol/format/KML';
import shp from 'shpjs';
import VectorSource from 'ol/source/Vector';
import VectorLayer from 'ol/layer/Vector';

import { drawSource, drawLayer, calculateMetrics } from './myDraw.js'; 


import {  getOverallDgmMinMax, createGeoTiffStyle } from './dgmdom.js';
import { dgmGroup } from './layers.js';

import { drawSearchPoint } from './ptn.js';

import { initDrawing, isDrawingActive } from './myDraw.js';

import { convertToDMS } from './utils.js';
import ContextMenu from 'ol-contextmenu';

import { createNewGroupFromLayers } from './layers.js';
import { layerSwitcher } from '../main.js';






let currentClickResults = {};
let latestClickRequestId = 0;

let popupOverlay, popupContent;

//für Handy
let lastTap = 0;

// Prüft, ob der DGM-Kachel-Layer im Layer-Switcher sichtbar ist
function isDgmKachelActive(map) {
  if (typeof getAllLayers !== 'function') return false;
  const allLayers = getAllLayers(map.getLayerGroup());
  const kachelLayerObj = allLayers.find(obj => 
    (obj.layer.get('name') || '').toLowerCase() === 'dgm-kacheln' || 
    (obj.layer.get('title') || '').toLowerCase() === 'dgm-kacheln'
  );
  return kachelLayerObj ? kachelLayerObj.visible : false;
}
// Prüft, ob der DGM-Kachel-Layer im Layer-Switcher sichtbar ist
function isDomKachelActive(map) {
  if (typeof getAllLayers !== 'function') return false;
  const allLayers = getAllLayers(map.getLayerGroup());
  const kachelLayerObj = allLayers.find(obj => 
    (obj.layer.get('name') || '').toLowerCase() === 'dom-kacheln' || 
    (obj.layer.get('title') || '').toLowerCase() === 'dom-kacheln'
  );
  return kachelLayerObj ? kachelLayerObj.visible : false;
}
// Erstellt das Popup, falls es noch nicht existiert
function getOrCreatePopupForDgmDom(map) {
  let popupForDgmDom = document.getElementById('popupForDgmDom');
  if (!popupForDgmDom) {
    popupForDgmDom = document.createElement('div');
    popupForDgmDom.id = 'popupForDgmDom';
    popupForDgmDom.style.cssText = `
      position: absolute; background: white; padding: 6px; 
      border-radius: 6px; border: 1px solid #ccc; font-size: 13px; 
      z-index: 10000; min-width: 120px; box-shadow: 0 2px 10px rgba(0,0,0,0.25);
    `;
    map.getTargetElement().appendChild(popupForDgmDom);
  }
  return popupForDgmDom;
}
// 🟢 SPEZIALISIERTER FALL 1a: Kachelauswahl dgm
export function handleDgmKachelSelection(map, evt) {
  const popupForDgmDom = getOrCreatePopupForDgmDom(map);
  let featureFound = false;
  map.forEachFeatureAtPixel(evt.pixel, (feature) => {
    featureFound = true;
    const props = feature.getProperties();
    const bbox = feature.getGeometry().getExtent();
    const tifUrl = props.dgm1.replace('https://dgm1.s3.eu-de.cloud-object-storage.appdomain.cloud', '/dgm');
    const alreadyLoaded = loadedDgms.some(d => d.tile_id === props.tile_id);
    popupForDgmDom.style.left = `${evt.pixel[0] + 10}px`;
    popupForDgmDom.style.top = `${evt.pixel[1] + 10}px`;
    popupForDgmDom.style.width = `30px`;
    popupForDgmDom.innerHTML = `
      <b>Kachel:</b> ${props.tile_id}<br>
      <b>Datum:</b> ${props.Aktualitaet}<br><br>
      ${alreadyLoaded ? '<i>Bereits geladen</i><br><br>' : ''}
      <button class="load-kachel-btn">DGM laden</button>
    `;
    popupForDgmDom.style.display = 'block';
    const loadBtn = popupForDgmDom.querySelector('.load-kachel-btn');
    if (loadBtn) {
      loadBtn.onclick = async () => {
        if (!alreadyLoaded) {
          await addDgmLayer(map, tifUrl, bbox, props.tile_id);
          loadedDgms.push({ tile_id: props.tile_id, bbox });
        }
        popupForDgmDom.style.display = 'none';
      };
    }
  });
  if (!featureFound) popupForDgmDom.style.display = 'none';
}
// 🟢 SPEZIALISIERTER FALL 1b: Kachelauswahl dom
export function handleDomKachelSelection(map, evt) {
  const popupForDgmDom = getOrCreatePopupForDgmDom(map);
  let featureFound = false;
  map.forEachFeatureAtPixel(evt.pixel, (feature) => {
    featureFound = true;
    const props = feature.getProperties();
    const bbox = feature.getGeometry().getExtent();
    const tifUrl = props.dom1.replace('https://dom1.s3.eu-de.cloud-object-storage.appdomain.cloud', '/dom');
    const alreadyLoaded = loadedDoms.some(d => d.tile_id === props.tile_id);
    popupForDgmDom.style.left = `${evt.pixel[0] + 10}px`;
    popupForDgmDom.style.top = `${evt.pixel[1] + 10}px`;
    popupForDgmDom.style.width = `30px`;
    popupForDgmDom.innerHTML = `
      <b>Kachel:</b> ${props.tile_id}<br>
      <b>Datum:</b> ${props.Aktualitaet}<br><br>
      ${alreadyLoaded ? '<i>Bereits geladen</i><br><br>' : ''}
      <button class="load-kachel-btn">DOM laden</button>
    `;
    popupForDgmDom.style.display = 'block';
    const loadBtn = popupForDgmDom.querySelector('.load-kachel-btn');
    if (loadBtn) {
      loadBtn.onclick = async () => {
        if (!alreadyLoaded) {
          await addDomLayer(map, tifUrl, bbox, props.tile_id);
          loadedDoms.push({ tile_id: props.tile_id, bbox });
        }
        popupForDgmDom.style.display = 'none';
      };
    }
  });
  if (!featureFound) popupForDgmDom.style.display = 'none';
}
// 🔵 SPEZIALISIERTER FALL 2a: Höhenabfrage DGM
export function handleDgmHeightQuery(map, evt, visibleDgmLayers) {
  // Wenn der Profilmodus aktiv ist, darf hier nichts passieren
  if (profileMode) {
    console.log("Klick-Interaktion ignoriert, da Profilmodus aktiv.");
    return; 
  }
  const popupForDgmDom = getOrCreatePopupForDgmDom(map);
  const coord = map.getCoordinateFromPixel(evt.pixel);
  let height = null;
  let foundLayer = null;

  for (const layer of visibleDgmLayers) {
    if (layer.bbox && containsCoordinate(layer.bbox, coord)) {
      const data = layer.getData(evt.pixel);
      if (data && data[0] !== -9999 && !Number.isNaN(data[0])) {
        height = data[0];
        foundLayer = layer;
        break;
      }
    }
  }

  if (height !== null) {
    popupForDgmDom.style.left = `${evt.pixel[0] + 10}px`;
    popupForDgmDom.style.top = `${evt.pixel[1] - 15}px`;
    popupForDgmDom.style.width = `30px`;
    const layerNr = foundLayer.get('name').split('_')[0];
    popupForDgmDom.innerHTML = `<b>DGM-H:${height.toFixed(2)} m</b>`;
    popupForDgmDom.style.display = 'block';
  } else {
    popupForDgmDom.style.display = 'none';
  }
}
// 🔵 SPEZIALISIERTER FALL 2b: Höhenabfrage DOM
export function handleDomHeightQuery(map, evt, visibleDomLayers) {
  // Wenn der Profilmodus aktiv ist, darf hier nichts passieren
  if (profileMode) {
    console.log("Klick-Interaktion ignoriert, da Profilmodus aktiv.");
    return; 
  }
  const popupForDgmDom = getOrCreatePopupForDgmDom(map);
  const coord = map.getCoordinateFromPixel(evt.pixel);
  let height = null;
  let foundLayer = null;

  for (const layer of visibleDomLayers) {
    if (layer.bbox && containsCoordinate(layer.bbox, coord)) {
      const data = layer.getData(evt.pixel);
      if (data && data[0] !== -9999 && !Number.isNaN(data[0])) {
        height = data[0];
        foundLayer = layer;
        break;
      }
    }
  }

  if (height !== null) {
    popupForDgmDom.style.left = `${evt.pixel[0] + 10}px`;
    popupForDgmDom.style.top = `${evt.pixel[1] - 15}px`;
    const layerNr = foundLayer.get('name').split('_')[0];
    popupForDgmDom.innerHTML = `<b>DOM-H:${height.toFixed(2)} m</b>`;
    popupForDgmDom.style.display = 'block';
  } else {
    popupForDgmDom.style.display = 'none';
  }
}
export function initMapClick(map) {
  map.on('singleclick', function (evt) {
    //var test = isDrawingActive();
    //console.log(test);
    // 1. Wenn im Zeichenmodus: abbrechen
    if (isDrawingActive()) {
        //console.log("Karten-Klick ignoriert, da Zeichenmodus aktiv ist.");
        return; 
    }

    // 💡 2. NEU: Wenn im Löschmodus (Mülleimer aktiv): ebenfalls abbrechen
    const deleteBtn = document.getElementById('draw-clear');
    if (deleteBtn && deleteBtn.classList.contains('active')) {
        //console.log("Karten-Klick ignoriert, da Löschmodus aktiv ist.");
        return; 
    }
    // --- 1. DGM- und DOM- LOGIK (PRIORISIERT) ---
    // Check: Ist der Kachel-Modus im Layer-Switcher aktiv?
    if (isDgmKachelActive(map)) {
      handleDgmKachelSelection(map, evt); // Deine neue spezialisierte Funktion
      return; 
    }
    // Check: Ist der Kachel-Modus im Layer-Switcher aktiv?
    if (isDomKachelActive(map)) {
      handleDomKachelSelection(map, evt); // Deine neue spezialisierte Funktion
      return; 
    }
    // Prüfen, ob Raster-DGM oder -DOM Layer da sind für Höhenabfrage
    const visibleDgmLayers = activeDgmRasterLayers.filter(l => l.getVisible());
    const visibleDomLayers = activeDomRasterLayers.filter(l => l.getVisible());
    if (visibleDgmLayers.length > 0) {
      handleDgmHeightQuery(map, evt, visibleDgmLayers); 
    } else if(visibleDomLayers.length > 0) {
      handleDomHeightQuery(map, evt, visibleDomLayers); 
    } else {
      //const p = document.getElementById('popup1');
      //if (p) p.style.display = 'none';
    }
    // --- 2. ALLGEMEINE KLICK-VORBEREITUNG ---
    clearHighlightedFeature();
    
    const now = Date.now();
    if (now - lastTap < 250) return; // Double-Tap Schutz
    lastTap = now;
    
    // Popup schließen, wenn Tabelle nicht aktiv ist
    if (!isTableEnabled()) {
      popupOverlay.setPosition(undefined);
    }
    // --- 3. WMS & VEKTOR ABFRAGEN (FÜR TABELLE / POPUP) ---
    const requestId = ++latestClickRequestId;
    const promises = [];
    const viewResolution = map.getView().getResolution();
    const coord = evt.coordinate;
    currentClickResults = {};
    const allLayers = getAllLayers(map);

    allLayers.forEach((obj) => {
      const layer = obj.layer;
      if (obj.visible && layer.getSource()?.getFeatureInfoUrl) {
        const name = layer.get('name');
        const baseParams = {
          QUERY_LAYERS: layer.getSource().getParams().LAYERS,
          LAYERS: layer.getSource().getParams().LAYERS,
          FEATURE_COUNT: 10 // 💡 NEU: Fordert bis zu 10 überlagernde Objekte vom WMS an!
        };
        function requestFeatureInfo(infoFormat) {
          const url = layer.getSource().getFeatureInfoUrl(
            coord, viewResolution, 'EPSG:3857',
            { ...baseParams, INFO_FORMAT: infoFormat }
          );

          if (!url) return Promise.resolve(null);
          return fetch(url)
            .then((res) => res.text())
            .then((text) => {
              if (requestId !== latestClickRequestId) return null;
              if (text.includes('ServiceException')) return null;
              return text;
            });
        }

        const promise = requestFeatureInfo('text/xml')
          .then((responseText) => responseText || requestFeatureInfo('text/html'))
          .then((responseText) => {
            if (!responseText) return;
            let data = [];
            
            if (responseText.includes('FeatureInfoResponse')) {
              data = parseArcGISXml(responseText, name);
            } else if (responseText.includes('gml:featureMember') || responseText.includes('FeatureCollection')) {
              data = parseDeegreeGml(responseText, name);
            } else if (responseText.includes('<body') || responseText.includes('<table')) {
              data = parseNibisHTML(responseText);
            }

            if (data.length > 0) {
              data.forEach(item => {
                item._clickCoord = coord;
                item.origin_layer = name;
              });
              currentClickResults[name] = { data: data, layer: layer };
            }
          })
          .catch((err) => console.warn(`Fehler bei '${name}':`, err));

        promises.push(promise);
      }
    });

    // --- 4. ERGEBNISSE VERARBEITEN ---
    Promise.all(promises).then(() => {
      if (requestId !== latestClickRequestId) return;
      const vectorResults = getVectorFeaturesAtClick(map, evt);
      Object.keys(vectorResults).forEach((layerName) => {
        const entry = vectorResults[layerName];
        entry.data.forEach(item => {
          item._clickCoord = coord;
          item.origin_layer = layerName;
        });
        currentClickResults[layerName] = entry;
      });

      const layerNames = Object.keys(currentClickResults);
      if (layerNames.length === 0) return;

      if (isTableEnabled()) {
        const firstLayerData = currentClickResults[layerNames[0]];
        // 💡 Alle gefundenen Features dieses Layers sauber mappen (nicht nur das nullte!)
        // 💡 KORREKTUR: Attribute sauber auslesen – egal ob GeoJSON oder Shapefile/Vektor
        const allFeaturesOfLayer = firstLayerData.data.map(item => {
          // 1. Fall: Es ist ein echtes OpenLayers-Feature-Objekt
          if (item && typeof item.getProperties === 'function') {
            return item.getProperties();
        }
        // 2. Fall: Es ist ein WMS- oder vorgeparstes Objekt mit .properties
        if (item && item.properties) {
          return item.properties;
        }
        // 3. Fall: Fallback auf das Objekt selbst
          return item;
        });
        const firstItem = firstLayerData.data[0];
        const clickedFeatureData = firstItem && typeof firstItem.getProperties === 'function' 
        ? firstItem.getProperties() 
        : (firstItem?.properties || firstItem); 
        
        const selector = getTableDocument().getElementById('layer-selector');
        const currentSelectedLayer = selector ? selector.value : "unknown";
        
        if (typeof table !== 'undefined' && table && currentSelectedLayer === layerNames[0]) {
          const idKey =
            clickedFeatureData.OBJECTID ? 'OBJECTID' :
            clickedFeatureData.objectid ? 'objectid' :
            clickedFeatureData.OBJID ? 'OBJID' :
            clickedFeatureData.objid ? 'objid' :
            clickedFeatureData.ID_con ? 'ID_con' :
            clickedFeatureData.ID ? 'ID' :
            clickedFeatureData.id ? 'id' : null;

          if (idKey) {
            const featureId = clickedFeatureData[idKey];
            const rows = table.searchRows(idKey, "=", featureId);
            if (rows.length > 0) {
              const targetRow = rows[0];  
              table.deselectRow();
              targetRow.select();
              table.scrollToRow(targetRow, "center", false);
              highlightFeatureForRow(clickedFeatureData);
              return; 
            } 
          }
        }
        
        updateSelector(layerNames);
        
        // 💡 JETZT ÜBERGEBEN WIR DIE KOMPLETTE LISTE AN DIE TABELLE:
        // Dadurch tauchen sowohl der Kanal als auch die Schleuse als Zeilen in deiner Tabelle auf!
        showTableDebounced(allFeaturesOfLayer);
        
      } else {
        handleClickResult(currentClickResults, coord, map);
      }
    });
  });
  map.on('pointermove', handleCombinedPointerMove);
 
// 💡 1. Overlay-Container einmalig für die Karte erstellen (falls noch nicht vorhanden)
let contextMenuOverlay = map.getOverlayById('context-menu-overlay');

if (!contextMenuOverlay) {
  // Das HTML-Element für das Overlay erzeugen
  const menuElement = document.createElement('div');
  menuElement.id = 'custom-context-menu';
  menuElement.style.position = 'absolute'; // Wichtig für Overlays!
  menuElement.style.zIndex = '10000';
  menuElement.style.overflow = 'visible';   // 💡 NEU: Erlaubt dem Untermenü, rechts herauszuragen!

  // Das OpenLayers Overlay-Objekt erstellen
  contextMenuOverlay = new Overlay({
    id: 'context-menu-overlay',
    element: menuElement,
    positioning: 'top-left', // Ecke, die an der Koordinate verankert wird
     width: 180,
    stopEvent: true          // Verhindert, dass Klicks im Menü auf die Karte durchgehen
  });

  map.addOverlay(contextMenuOverlay);
}

// 1. Instanz des Kontextmenüs erstellen
const contextMenu = new ContextMenu({
  width: 190,
  defaultItems: false // Wir wollen keine Standard-Einträge, nur unsere eigenen
});

map.addControl(contextMenu);


// 2. Event-Listener in deiner mapEvents.js (Wenn das Menü GEÖFFNET wird)
contextMenu.on('open', function (evt) {
  const koordinaten = evt.coordinate;
  
  // Menü leeren
  contextMenu.clear();

  // 1. Prüfen, ob der Klick aus dem Layer-Switcher kam
  const targetElement = evt.originalEvent.target;
  const isInsideSwitcher = targetElement.closest('.ol-layerswitcher');

  if (isInsideSwitcher) {
    const listItem = targetElement.closest('li');
    const clickedLayer = listItem ? listItem._olLayer : null;
    const labelText = listItem ? listItem.querySelector('label').innerText.trim() : 'Unbekannt';

    if (clickedLayer) {
      const isGroup = typeof clickedLayer.getLayers === 'function';

      // 💡 GEMEINSAME AKTION: Umbenennen für Gruppen und Einzellayer
      const renameAction = {
        text: 'Umbenennen...',
        icon: 'fa fa-pencil',
        callback: function () {
          const currentTitle = clickedLayer.get('title') || labelText;
          const newTitle = prompt(`Neuen Namen für "${currentTitle}" eingeben:`, currentTitle);
          
          if (newTitle && newTitle.trim() !== "") {
            clickedLayer.set('title', newTitle.trim());
            
            if (layerSwitcher && typeof layerSwitcher.render === 'function') {
              layerSwitcher.render();
            }
          }
        }
      };

      // Überprüfung auf Mehrfachauswahl (falls aktiv, lassen wir das Umbenennen weg)
      const switcherEl = targetElement.closest('.ol-layerswitcher');
      const selectedLabels = switcherEl ? switcherEl.querySelectorAll('label.is-selected') : [];
      const isMultiSelectActive = selectedLabels.length >= 2;

      // =========================================================================
      // 🗂️ SONDERFALL: MEHRFACHAUSWAHL AKTIV (Mindestens 2 Layer ausgewählt)
      // =========================================================================
      if (isMultiSelectActive) {
        contextMenu.extend([
          {
            text: `Aktion für ${selectedLabels.length} gewählte Layer:`,
            classname: 'menu-layer-header',
            disabled: true
          },
          '-',
          {
            text: 'In neuer Gruppe zusammenfassen...',
            icon: 'fa fa-folder-open',
            callback: function () {
              const layersToGroup = [];
              selectedLabels.forEach(lbl => {
                const li = lbl.closest('li');
                if (li && li._olLayer) layersToGroup.push(li._olLayer);
              });

              createNewGroupFromLayers(layersToGroup, map, layerSwitcher);
            }
          },
          {
            text: 'Auswahl komplett aufheben',
            icon: 'fa fa-times',
            callback: function () {
              selectedLabels.forEach(lbl => lbl.classList.remove('is-selected'));
            }
          }
        ]);

      // =========================================================================
      // 📂 STANDARD-FALL A: RECHTSKLICK AUF EINE LAYER-GRUPPE (Ordner)
      // =========================================================================
      } else if (isGroup) {
        contextMenu.extend([
          {
            text: `Gruppe: ${labelText}`,
            classname: 'menu-layer-header',
            disabled: true
          },
          '-',
          renameAction, // Umbenennen für Gruppen
          '-',
          {
            text: 'Alle Layer einschalten',
            icon: 'fa fa-check-square',
            callback: function () {
              clickedLayer.getLayers().forEach((subLayer) => {
                subLayer.setVisible(true);
                if (typeof subLayer.getLayers === 'function') {
                  subLayer.getLayers().forEach(sl => sl.setVisible(true));
                }
              });
              map.changed();
            }
          },
          {
            text: 'Alle Layer ausschalten',
            icon: 'fa fa-square-o',
            callback: function () {
              clickedLayer.getLayers().forEach((subLayer) => {
                subLayer.setVisible(false);
                if (typeof subLayer.getLayers === 'function') {
                  subLayer.getLayers().forEach(sl => sl.setVisible(false));
                }
              });
              map.changed();
            }
          }
        ]);

      // =========================================================================
      // 📄 STANDARD-FALL B: RECHTSKLICK AUF EINEN EINZELNEN LAYER
      // =========================================================================
      } else {
        contextMenu.extend([
          {
            text: `Layer: ${labelText}`,
            classname: 'menu-layer-header',
            disabled: true
          },
          '-',
          renameAction, // Umbenennen für Einzellayer
          '-',
          // 💡 REINTEGRIERT: Die Verschiebe-Funktion für den Einzellayer
          {
            text: 'Zu einer Gruppe hinzufügen...',
            icon: 'fa fa-folder-plus',
            callback: function () {
              window.layerToMove = clickedLayer;
              
              alert(`Bitte klicke jetzt im Layer-Switcher auf die Ziel-Gruppe, in die "${labelText}" verschoben werden soll.`);
              
              const switcherEl = targetElement.closest('.ol-layerswitcher');
              if (switcherEl) switcherEl.classList.add('targeting-group-mode');
            }
          },
          '-',
          {
            text: 'Auf Layergrenzen zoomen',
            icon: 'fa fa-search-plus',
            callback: function () {
              const source = clickedLayer.getSource();
              if (source && typeof source.getExtent === 'function') {
                const extent = source.getExtent();
                map.getView().fit(extent, { duration: 800, padding: [50, 50, 50, 50] });
              }
            }
          },
          {
            text: 'Transparenz: 50%',
            icon: 'fa fa-adjust',
            callback: function () {
              clickedLayer.setOpacity(0.5);
            }
          },
          {
            text: 'Voll sichtbar (100%)',
            icon: 'fa fa-eye',
            callback: function () {
              clickedLayer.setOpacity(1.0);
            }
          }
        ]);
      }
    }

    return; // WICHTIG: Abbrechen für Karten-Kontextmenü
  }

  // =========================================================================
  // 2. STANDARD-FALL (Klick auf die freie Karte): Koordinaten-Menü laden
  // =========================================================================
  const menuEl = document.getElementById('custom-context-menu');
  if (menuEl) menuEl.style.display = 'block';

  const epsgSysteme = [
    { code: 'EPSG:25832', label: 'ETRS89 / UTM 32N (25832)', digits: 2, type: 'standard' },
    { code: 'EPSG:32632', label: 'WGS84 / UTM 32N (32632)', digits: 2, type: 'standard' },
    { code: 'EPSG:4326',  label: 'WGS84 / Lat, Lon (Dezimal)', digits: 5, type: 'standard', order: 'YX' },
    { code: 'EPSG:4326',  label: 'WGS84 / Grad, Min, Sek (DMS)', type: 'DMS' },
    { code: 'EPSG:3857',  label: 'Web Mercator (3857)', digits: 2, type: 'standard' }
  ];

  const submenuItems = epsgSysteme.map(sys => {
    return {
      text: sys.label,
      classname: 'submenu-item-style',
      callback: function () {
        const transformierteKoordinaten = transform(koordinaten, 'EPSG:3857', sys.code);
        let textToCopy = "";

        if (sys.type === 'DMS') {
          const lon = transformierteKoordinaten[0];
          const lat = transformierteKoordinaten[1];
          textToCopy = `${convertToDMS(lat, 'LAT')}, ${convertToDMS(lon, 'LON')}`;
        } else {
          if (sys.order === 'YX') {
            textToCopy = `${transformierteKoordinaten[1].toFixed(sys.digits)}, ${transformierteKoordinaten[0].toFixed(sys.digits)}`;
          } else {
            textToCopy = `${transformierteKoordinaten[0].toFixed(sys.digits)}, ${transformierteKoordinaten[1].toFixed(sys.digits)}`;
          }
        }

        navigator.clipboard.writeText(textToCopy).then(() => {
          console.log("Kopiert:", textToCopy);
        }).catch(err => alert(`Koordinaten: ${textToCopy}`));
      }
    };
  });

  contextMenu.extend([
    {
      text: 'Koordinaten anzeigen',
      classname: 'main-menu-item-style',
      icon: 'fa fa-map-marker',
      items: submenuItems
    },
    '-',
    {
      text: 'Google Maps Navigation',
      icon: 'fa fa-location-arrow',
      callback: function () {
        const coord4326 = transform(koordinaten, 'EPSG:3857', 'EPSG:4326');
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${coord4326[1]},${coord4326[0]}`, '_blank');
      }
    },
    {
      text: 'Street View öffnen',
      icon: 'fa fa-street-view',
      callback: function () {
        const coord4326 = transform(koordinaten, 'EPSG:3857', 'EPSG:4326');
        window.open(`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${coord4326[1]},${coord4326[0]}`, '_blank');
      }
    }
  ]);
});
const mapViewport = map.getViewport();

  mapViewport.addEventListener('contextmenu', function (e) {
    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    // Prüfen, ob der Löschmodus-Button die Klasse 'active' hat (wie in deinem Klick-Block oben)
    const deleteBtn = document.getElementById('draw-clear');
    const isDeleteActive = deleteBtn && deleteBtn.classList.contains('active');
    
    // Wenn wir auf dem Handy sind UND entweder gezeichnet oder gelöscht wird:
    if (isMobile && (isDrawingActive() || isDeleteActive)) {
      // Verhindert, dass das ol-contextmenu aufpoppt!
      e.stopPropagation();
      e.preventDefault();
      // console.log("ol-contextmenu unterdrückt für Handy-Long-Press.");
    }
  }, true); // 'true' aktiviert die Capture-Phase, damit wir schneller als das Plugin sind!
} // Ende von initMapCli


function handleCombinedPointerMove(evt) {
  if (evt.dragging) return;
  // 1. Prüfen, ob DGM-Raster aktiv sind
  const visibleDgmLayers = activeDgmRasterLayers.filter(l => l.getVisible());
  if (visibleDgmLayers.length > 0) {
    handleDgmPointerMove(evt); 
    return; // DGM hat Vorrang
  }
  // 2. Wenn kein DGM, prüfe DOM-Raster
  const visibleDomLayers = activeDomRasterLayers.filter(l => l.getVisible());
  if (visibleDomLayers.length > 0) {
    handleDomPointerMove(evt);
    return;
  }
  // 3. Wenn nichts davon aktiv ist, Status ausblenden
  const heightStatus = document.getElementById('height-status-container');
  if (heightStatus) heightStatus.style.display = 'none';
}
async function handleClickResult(currentClickResults, coord, map) {
  // Wenn der Profilmodus aktiv ist, darf hier nichts passieren
  if (profileMode) { console.log("Klick-Interaktion ignoriert, da Profilmodus aktiv.");
    return; 
  }
// =====================================================
// Duplikate entfernen
// =====================================================
for (const layerName of Object.keys(currentClickResults)) {
  const entry = currentClickResults[layerName];
  const seen = new Set();
  entry.data = entry.data.filter((item) => {
    // VectorFeature ODER WMS
    const props = item.properties || item;
    const id =
      props.OBJECTID ||
      props.ID_con ||
      props.ID ||
      props.objectid ||
      props.tile_id ||
      props.id ||
      JSON.stringify(props);
      if (seen.has(id)) {
        return false;
      }
      seen.add(id);
      return true;
    });
  }
  // =====================================================
  // Layer / Feature Auswahl
  // =====================================================
  const layerNames = Object.keys(currentClickResults);
  let chosenLayer = layerNames[0];
  let chosenIndex = 0;
  const needsSelection = !isDgmActive && !isDomActive && (layerNames.length > 1 || currentClickResults[layerNames[0]].data.length > 1 );
  if (needsSelection) {
    const choice = await askUserToChoose(currentClickResults, coord, map);
    if (!choice) return;
    chosenLayer = choice.layer;
    chosenIndex = choice.index;
  }
  const entry = currentClickResults[chosenLayer];
  const selected = entry.data[chosenIndex];
  // =====================================================
  // VectorFeature ODER WMS-Objekt
  // =====================================================
  const isWrappedFeature =  selected && selected.properties &&  selected.feature;
  const featureData = isWrappedFeature ? selected.properties : selected;
  const feature = isWrappedFeature ? selected.feature : null;
  // =====================================================
  // Popup anzeigen
  // =====================================================
  if (!shouldShowPopup(entry.layer)) return;
  popupContent.innerHTML =
    buildPopupContent(
      feature || featureData,
      chosenLayer
    );
  popupOverlay.setPosition(coord);
  featureData.origin_layer = chosenLayer;
  // =====================================================
  // Highlight
  // =====================================================
  if (typeof highlightFeatureForRow === 'function') {
    highlightFeatureForRow(featureData);
  }
  // =====================================================
  // Tabellenbutton
  // =====================================================
 setTimeout(() => {
    // 1. Bereits existierender Tabellen-Button
    const btnTable = document.getElementById('open-table-btn');
    if (btnTable) {
      btnTable.onclick = () => {
        updateSelector([chosenLayer]);
        showTableDebounced(currentClickResults[chosenLayer].data.map(item => item.properties || item));
        popupOverlay.setPosition(undefined);
      };
    }

    // 2. NEUER DATEN-BUTTON (Für das Modal-Popup)
    const btnDaten = document.getElementById('open-daten-btn');
    if (btnDaten) {
      btnDaten.onclick = () => {
        // Schließe das OpenLayers Karten-Popup
        //popupOverlay.setPosition(undefined);
        
        // Öffne das Modal-Popup mit den Feature-Daten
        showDataInModal(featureData, chosenLayer);
      };
    }
  }, 0);
}
export function getAllLayers(layerGroup, parentVisible = true, groupTitle = null) {
  let layers = [];
  const currentTitle = layerGroup.get('title') || groupTitle;

  layerGroup.getLayers().forEach((layer) => {
    const isVisible = parentVisible && layer.getVisible();
    const name = (layer.get('name') || '').toLowerCase();
    const title = (layer.get('title') || '').toLowerCase();

    // 💡 Beide Prüfungen in einem einzigen if vereint:
    if (!isVisible || EXCLUDED_LAYERS.includes(name) || EXCLUDED_LAYERS.includes(title)) {
      return; // Überspringen
    }

    if (layer.getLayers) {
      layers = layers.concat(getAllLayers(layer, isVisible, currentTitle));
    } else {
      layers.push({
        layer,
        visible: isVisible,
        groupTitle: currentTitle,
      });
    }
  });

  return layers;
}

function showFeatureFromSelection(selected, layerName, coord) {
    const isWrappedFeature = selected && selected.properties && selected.feature;
    const featureData = isWrappedFeature ? selected.properties : selected;
    const feature = isWrappedFeature ? selected.feature : null;

    // 1. Popup anzeigen
    popupContent.innerHTML = buildPopupContent(feature || featureData, layerName);
    popupOverlay.setPosition(coord);

    // 2. Highlight auf der Karte
    if (typeof highlightFeatureForRow === 'function') {
        featureData.origin_layer = layerName;
        highlightFeatureForRow(featureData);
    }

    // 3. Tabellen-Button & Daten-Button Logik
    setTimeout(() => {
        // Tabellen-Button
       /*  const btn = document.getElementById('open-table-btn');
        if (btn) {
            btn.onclick = () => {
                updateSelector([layerName]);
                showTableDebounced([featureData]);
                popupOverlay.setPosition(undefined);
            };
            console.log("tabelle angezeigt durch opentabelbutton");
        }
 */
        // 👉 DATEN-BUTTON (Erweiterung für die Auswahlliste)
        const datenBtn = document.getElementById('open-daten-btn');
        if (datenBtn) {
            datenBtn.onclick = () => {
                console.log("Datenansicht geöffnet für:", featureData);
                
                // 1. Karten-Popup schließen, um Platz zu machen
                //popupOverlay.setPosition(undefined);
                
                // 2. Das Daten-Modal mit den Attributen des ausgewählten Objekts öffnen
                if (typeof showDataInModal === 'function') {
                    showDataInModal(featureData, layerName);
                } else {
                    console.error("Die Funktion showDataInModal wurde nicht gefunden!");
                }
            };
        }
    }, 0);
}

// Diese Funktion zeigt die Auswahlmöglichkeit, wenn mehrere Features gefunden wurden
async function askUserToChoose(currentClickResults, coord, map) {
    const container = document.getElementById('feature-select');
    const list = document.getElementById('feature-select-li');
    list.innerHTML = '';
    container.classList.remove('hidden');

    Object.keys(currentClickResults).forEach((layerName) => {
      const entry = currentClickResults[layerName];
      
      // =====================================================
      // SONDERFALL: Layer ist "Nibis Bohrdaten"
      // =====================================================
      if (layerName.toLowerCase().includes('nibis bohrdaten')) {
        
        // Da entry.data nun ein Array von Bohrungs-Objekten ist (dank des neuen Parsers):
        entry.data.forEach((bohrung, index) => {
          
          // Namen aus den Attributen dieser spezifischen Bohrung fischen
          let name = bohrung.LONGNAME || bohrung.ANAME || bohrung.PROJEKT;
          // 2. Fallback: Wenn oben nichts gefunden wurde (oder '{null}' war), suchen wir dynamisch nach "*name*"
          if (!name || name === '{null}') {
            const allKeys = Object.keys(bohrung);
            
            // Finde den ersten Schlüssel, der das Wort "name" beinhaltet
            const dynamicNameKey = allKeys.find(key => key.toLowerCase().includes('name'));
            
            // Wenn so ein Schlüssel existiert und einen gültigen Wert hat, nutzen wir ihn
            if (dynamicNameKey && bohrung[dynamicNameKey] && bohrung[dynamicNameKey] !== '{null}') {
              name = bohrung[dynamicNameKey];
            }
          }

          // 3. Letzter Notnagel: Wenn absolut kein Name auftreibbar ist
          if (!name || name === '{null}') {
            name = `Bohrung ${index + 1}`;
          }
          const li = document.createElement('li');
          li.innerHTML = `<strong>${layerName}</strong>: ${name}`;

          // KLICK: Übergibt jetzt das exakte, saubere Objekt der Bohrung mit ALLEN Attributen
          li.onclick = () => {
            showFeatureFromSelection(bohrung, layerName, coord);
            Array.from(list.children).forEach(el => el.classList.remove('selected'));
            li.classList.add('selected');
          };

          li.ondblclick = () => {
            if (coord) {
              map.getView().animate({ center: coord, zoom: 18, duration: 800 });
            }
          };

          list.appendChild(li);
        });
      }
      // =====================================================
      // FÜR ALLE ANDEREN LAYER (Standard-Vorgehen)
      // =====================================================
      else {
        entry.data.forEach((item, index) => {
          const li = document.createElement('li');
          const props = item.properties || item;
          let name = `Objekt ${index + 1}`;
        
          // SONDERFALL: Layer ist "fsk"
          if (layerName.toLowerCase() === 'fsk') {
            const propKeys = Object.keys(props);
            const gemarkKey  = propKeys.find(key => key.toLowerCase() === 'gemark');
            const flurKey    = propKeys.find(key => key.toLowerCase() === 'flur');
            const zaehlerKey = propKeys.find(key => key.toLowerCase() === 'zaehler');
            const nennerKey  = propKeys.find(key => key.toLowerCase() === 'nenner');
    
            const gemark  = gemarkKey  ? props[gemarkKey]  : '';
            const flur    = flurKey    ? props[flurKey]    : '-';
            const zaehler = zaehlerKey ? props[zaehlerKey] : '-';
            const nenner  = nennerKey  ? props[nennerKey]  : '';
            const nennerAnzeige = nenner ? `/${nenner}` : '';
    
            name = `${gemark}, Flur ${flur}, ${zaehler}${nennerAnzeige}`;
          }
          // STANDARD-FALLBACK (andere Vektor- oder WMS-Layer)
          else {
            const propKeys = Object.keys(props);
            const foundKey = propKeys.find(key => {
              const lowerKey = key.toLowerCase();
              return lowerKey.includes('name') || lowerKey.includes('bezeichnung');
            });
            
            if (foundKey && props[foundKey]) {
              name = props[foundKey];
            }
          }
  
          li.innerHTML = `<strong>${layerName}</strong>: ${name}`;
  
          // Klick-Events
          li.onclick = () => {
            showFeatureFromSelection(item, layerName, coord);
            Array.from(list.children).forEach(el => el.classList.remove('selected'));
            li.classList.add('selected');
          };
  
          li.ondblclick = () => {
            let extent = null;
            if (item.feature && typeof item.feature.getGeometry === 'function') {
                extent = item.feature.getGeometry().getExtent();
            } else if (item.geometry) {
              const format = new GeoJSON(); 
              const tempFeature = format.readFeature(item);
              if (tempFeature) extent = tempFeature.getGeometry().getExtent();
            }
            if (extent) {
              map.getView().fit(extent, { duration: 800, padding: [50, 50, 50, 50], maxZoom: 18 });
            } else if (coord) {
              map.getView().animate({ center: coord, zoom: 18, duration: 800 });
            }
          };
          
          list.appendChild(li);
        });
      }
    });
}
function parseDeegreeGml(xmlString, layerName) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");
    const results = [];

    // Wir suchen alle featureMember
    const features = xmlDoc.getElementsByTagNameNS("*", "featureMember");
    
    for (let i = 0; i < features.length; i++) {
        const featureNode = features[i].firstElementChild; // Das app:lkel... Element
        if (!featureNode) continue;

        const entry = { 
            Layer: layerName,
            // Wir versuchen die fid (ID) zu extrahieren
            id: featureNode.getAttribute("fid") || featureNode.getAttribute("gml:id")
        };

        // Alle Kindknoten (Attribute) durchlaufen
        const children = featureNode.children;
        for (let j = 0; j < children.length; j++) {
            const child = children[j];
            // Wir nehmen den lokalen Namen (ohne "app:") für die Tabelle
            const key = child.localName; 
            const value = child.textContent.trim();
            //console.log(`Attribut gefunden - Key: ${key}, Value: ${value}`);
            // Koordinaten-Tags überspringen wir für die Tabelle
            if (key !== "boundedBy" && key !== "geometry") {
                entry[key] = value;
            }
        }
        results.push(entry);
    }
    return results;
}
function parseNibisHTML(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const result = []; // Hier landen nachher die einzelnen Bohrungs-Objekte
  
  const tables = doc.querySelectorAll('table');
  tables.forEach((table, tableIndex) => {
    const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim());
    const rows = table.querySelectorAll('tr');
    
    // Ein eigenes Objekt für diese spezifische Bohrung anlegen
    const bohrungAttributes = {};

    rows.forEach((row, rowIndex) => {
      if (rowIndex === 0) return; // Header überspringen
      const cells = row.querySelectorAll('td');

      if (cells.length === headers.length && cells.length > 0) {
        headers.forEach((header, i) => {
          const text = cells[i].textContent.trim();
          // Wir speichern das Attribut direkt als Key-Value-Paar im Bohrungs-Objekt
          bohrungAttributes[header] = text;
        });
      }
    });

    // Nur hinzufügen, wenn die Tabelle auch echte Daten enthielt
    if (Object.keys(bohrungAttributes).length > 0) {
      // Metadaten für dein restliches System anhängen
      bohrungAttributes.origin_layer = 'Nibis Bohrdaten';
      result.push(bohrungAttributes);
    }
  });

  return result; // Gibt jetzt ein Array von Objekten zurück: [ {LONGNAME: 'Haren 1', ...}, {LONGNAME: 'Haren 2', ...} ]
}
export function parseArcGISXml(xmlString, layerName) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
  const featureNodes = xmlDoc.getElementsByTagName('FIELDS');

  const data = [];

  for (let i = 0; i < featureNodes.length; i++) {
    const attributes = featureNodes[i].attributes;
    const row = { Ebene: layerName };

    for (let j = 0; j < attributes.length; j++) {
      row[attributes[j].nodeName] = attributes[j].nodeValue;
    }

    data.push(row);
  }

  return data;
}
export function getClickResults() {
  return currentClickResults;
}
// Funktion definieren
export function closeSearchResults() {
  const box = document.getElementById('feature-select');
  if (box) {
    box.classList.add('hidden');
  }
}
// Den Listener an den Button binden
const closeBtn = document.getElementById('close-select-btn');
if (closeBtn) {
  closeBtn.addEventListener('click', closeSearchResults);
}
export function getVectorFeaturesAtClick(map, evt) {

  const results = {};

  map.forEachFeatureAtPixel(
    evt.pixel,
    function (feature, layer) {

      const name =
        (layer?.get('name') || '').toLowerCase();

      const title =
        (layer?.get('title') || '').toLowerCase();

      if (
        EXCLUDED_LAYERS.includes(name) ||
        EXCLUDED_LAYERS.includes(title)
      ) {
        return;
      }

      const key = name || title || 'vector';

      if (!results[key]) {
        results[key] = {
          data: [],
          layer: layer
        };
      }

      // 👉 Properties holen
      const props = feature.getProperties();

      // 👉 geometry NICHT mitkopieren
      const cleanProps = { ...props };

      delete cleanProps.geometry;

      // 👉 echtes Feature zusätzlich speichern
      results[key].data.push({

        properties: cleanProps,

        feature: feature

      });

    },
    {
      //hitTolerance: 10
    }
  );

  return results;
}

export function getVisibleVectorFeatures(map) {
  const extent = map.getView().calculateExtent(map.getSize());
  const results = {};
  const allLayers = getAllLayers(map);
  const allowedGroups = ['Bauw.(L)', 'Bauw.(P)'];
  allLayers.forEach((obj) => {
    const { layer, visible, groupTitle } = obj;
    const name = layer.get('name');
    
    // 1. Grundvoraussetzung: Layer muss sichtbar sein
    if (!visible) return;

    // 2. Bedingungs-Logik:
    // Wir lassen den Layer zu, WENN er in einer erlaubten Gruppe ist
    const isInAllowedGroup = groupTitle && allowedGroups.includes(groupTitle);
    // ODER wenn sein Name "fsk" ist
    const isFSKLayer = (name === 'fsk');

    // 💡 NEU: Prüfen, ob es ein vom Nutzer hochgeladener GeoJSON-Layer ist
    const isUploadedGeoJSON = layer.get('isUserGeoJSON') === true;

    // Wenn beides NICHT zutrifft, wird der Layer übersprungen
    if (!isInAllowedGroup && !isFSKLayer && !isUploadedGeoJSON) return;

    // Ab hier läuft die gewohnte Logik für die gültigen Layer
    const source = typeof layer.getSource === 'function' ? layer.getSource() : null;
    if (!source || typeof source.getFeaturesInExtent !== 'function') return;

    const features = source.getFeaturesInExtent(extent);
    if (features.length === 0) return;

    results[name || 'Unbekannter Layer'] = features.map((f) => {
      const props = { ...f.getProperties() };
      delete props.geometry;
      return props;
    });
  });
  return results;
}

export function updateTableFromVisibleLayers(map) {
  
  if (!isTableEnabled()) return;
  const results = getVisibleVectorFeatures(map);
  const layerNames = Object.keys(results);

  if (layerNames.length > 0) {
    const tableDoc = getTableDocument();
    const selector = tableDoc.getElementById('layer-selector');
    
    const currentSelection = selector ? selector.value : null;
    updateSelector(layerNames);

    let layerToShow = layerNames[0];
    if ( currentSelection &&  results[currentSelection]) {
      layerToShow = currentSelection;
    }

    const entry = results[layerToShow];
    const data =
      Array.isArray(entry)
        ? entry
        : entry?.data || [];

    const normalizedData =  data.map(item => item.properties || item );
    console.log(isTableEnabled & "::" & isTableActive)
    showTableDebounced(normalizedData);
    console.log("tabelle angezeigt durch updatetabel")
  } else {
    showTableDebounced([]);
    console.log("tabelle angezeigt durch tabellenbutton")
    updateSelector([]);
  }
}
//Eventhandler für Layerswitcher Click 
export function switcherDrawList(layerSwitcher) {
  layerSwitcher.on('drawlist', (evt) => {
  var layer = evt.layer;
  evt.li.querySelector('label').addEventListener('click', () => {
    console.log('Layerswitcher Click')
  });
});
}

export function switcherToggle(layerSwitcher) {
  layerSwitcher.on('drawlist', (evt) => {
    var clickedLayer = evt.layer;
    const labelElement = evt.li.querySelector('label');
    const listItem = evt.li;

    listItem._olLayer = clickedLayer;

    // Timer für das Gedrückthalten auf dem Handy
    let touchTimer;
    let isLongPress = false;

    // =========================================================================
    // 📱 HANDY-STEUERUNG: Long-Press aktiviert den Gruppen-Verschiebemodus
    // =========================================================================
    labelElement.addEventListener('touchstart', (e) => {
      isLongPress = false;
      const isGroup = typeof clickedLayer.getLayers === 'function';

      // Wenn der Nutzer den Finger 600ms hält...
      touchTimer = setTimeout(() => {
        isLongPress = true;

        // Gruppen müssen nicht verschoben werden, das betrifft nur Einzellayer
        if (!isGroup) {
          // 💡 SCHALTE DEN MODUS SCHARF (Ersetzt den Rechtsklick auf dem Handy!)
          window.layerToMove = clickedLayer;
          
          alert(`Verschiebemodus aktiv: Bitte tippe jetzt auf die Ziel-Gruppe für "${clickedLayer.get('title') || 'Layer'}".`);
          
          const switcherEl = layerSwitcher.element;
          if (switcherEl) switcherEl.classList.add('targeting-group-mode');
        }
      }, 600); 
    }, { passive: true });

    labelElement.addEventListener('touchend', () => {
      // Finger rechtzeitig angehoben -> Kein Long-Press
      clearTimeout(touchTimer);
    });

    labelElement.addEventListener('touchmove', () => {
      // Wenn der Nutzer scrollt, Aktion abbrechen
      clearTimeout(touchTimer);
    });

    // =========================================================================
    // 💻 CLICK-STEUERUNG: Normales Auswählen ODER Ziel-Gruppe einrasten lassen
    // =========================================================================
    labelElement.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Wenn das Event gerade eben schon als Long-Press gefeuert hat, hier stoppen
      if (isLongPress) return;

      // -----------------------------------------------------------------------
      // AKTIV: Wenn wir uns im Verschiebemodus befinden (Handy & Desktop)
      // -----------------------------------------------------------------------
      if (window.layerToMove) {
        const isTargetGroup = typeof clickedLayer.getLayers === 'function';

        if (!isTargetGroup) {
          alert("Fehler: Bitte wähle eine LAYER-GRUPPE (Ordner) als Ziel aus!");
          return;
        }

        if (window.layerToMove === clickedLayer) {
          alert("Ein Layer kann nicht in sich selbst verschoben werden.");
          return;
        }

        const map = layerSwitcher.getMap();
        
        // Hilfsfunktion zum Entfernen aus dem alten Verzeichnis
        function removeLayerFromTree(layerToRemove, currentGroup) {
          const layersInGroup = currentGroup.getLayers();
          if (layersInGroup.getArray().includes(layerToRemove)) {
            layersInGroup.remove(layerToRemove);
            return true;
          }
          for (let i = 0; i < layersInGroup.getLength(); i++) {
            const subLayer = layersInGroup.item(i);
            if (typeof subLayer.getLayers === 'function') {
              if (removeLayerFromTree(layerToRemove, subLayer)) return true;
            }
          }
          return false;
        }

        // Verschieben durchführen
        removeLayerFromTree(window.layerToMove, map.getLayerGroup());
        clickedLayer.getLayers().push(window.layerToMove);

        console.log(`Layer erfolgreich in Gruppe "${clickedLayer.get('title')}" verschoben!`);

        // Modus beenden & aufräumen
        window.layerToMove = null;
        const switcherEl = layerSwitcher.element;
        if (switcherEl) switcherEl.classList.remove('targeting-group-mode');

        layerSwitcher.render();
        map.changed();
        return; 
      }

      // -----------------------------------------------------------------------
      // STANDARD: Normales Auswählen (Einzelauswahl / Desktop-Mehrfachauswahl)
      // -----------------------------------------------------------------------
      const isMultiSelectKey = e.shiftKey; // Shift für PC-Mehrfachauswahl

      if (isMultiSelectKey) {
        labelElement.classList.toggle('is-selected');
      } else {
        const allLabels = layerSwitcher.element.querySelectorAll('label');
        allLabels.forEach(lbl => {
          if (lbl !== labelElement) lbl.classList.remove('is-selected');
        });
        labelElement.classList.toggle('is-selected');
      }
    });

    labelElement.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
  });
}
// --------------------Funktion für GPS-Suche--------------------
export function initSearchEvents(searchPlaceControl, map) { //Zustand searchPlaceControl und die Karte werden übergeben
  if (!searchPlaceControl) return; // Wenn searchPlaceControl nicht aktiv ist wieder verlassen

searchPlaceControl.on('select', (e) => { //Eventhandler für searchPlaceControl, das Click-Event wird übergeben
    const coord = e.coordinate; // Koordinate des Click-Eventes
    if (!coord) return; // Wenn keine Koordinate dann Funktion verlassen

    // Daten aus properties extrahieren
    const props = e.search.properties || {};
    const type = props.type || props.osm_value;

    // Dynamischen Zoom festlegen
    let customZoom = 18; // Standard für Adressen/Straßen
    if (type === 'city' || type === 'town') {
        customZoom = 13;
    } else if (type === 'district' || type === 'suburb') {
        customZoom = 14;
    }
    
    // Animation ausführen
    map.getView().animate({
        center: coord,
        zoom: customZoom,
        duration: 1000
    });

    // Punkt in ptn.js zeichnen
    drawSearchPoint(coord);
});
}



let zaehlerGeojson = 1;
let zaehlerKML = 1;
let zaehlerGML = 1;
let fileInput;

import GML from 'ol/format/GML';

export function fileToggleInput(map) {
  if (!fileInput) {
    fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.multiple = true;
    fileInput.accept = '.geojson,.json,.kml,.gml,.zip,.tif,.tiff';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);
  }

  fileInput.onchange = (event) => {
    const files = event.target.files;
    console.log(files)
    if (!files.length) return;

    Array.from(files).forEach(file => {
      const fileName = file.name.replace(/\.[^/.]+$/, "");
      const fileEnd = file.name.split('.').pop().toLowerCase();

      // 1. RASTER-DATEN (GeoTIFF) -> Optimiert für lokales Blob-Laden
      if (fileEnd === 'tif' || fileEnd === 'tiff') {
        const sourceName = `Lokal_DGM_${fileName}`;
        const tiffSource = new GeoTIFFSource({
            sources: [{ 
              blob: file,      // Direkt das File/Blob-Objekt übergeben
              nodata: -9999 
            }],
            projection: 'EPSG:25832',
            normalize: false, 
            convertToRGB: false, 
            sourceOptions: { 
            // HIER DIE ZWEITE ÄNDERUNG:
            allowFullFile: false, // COG-Vorteil auch lokal nutzen
            cache: true
          }
        });

        tiffSource.getView().then((viewConfig) => {
      const extent3857 = transformExtent(viewConfig.extent, 'EPSG:25832', 'EPSG:3857');
      const tiffLayer = new WebGLTileLayer({
          source: tiffSource,
          title: sourceName,
          name: sourceName, 
          style: createGeoTiffStyle(5, 50), // Hinweis unten beachten
          opacity: 1
      });
      
      

            tiffLayer.bbox = extent3857;
            const localDgmData = { 
              bbox: extent3857, 
              min: 5,   
              max: 50, 
              layer: tiffLayer 
            };
            
            if (dgmGroup) dgmGroup.getLayers().push(tiffLayer);
            activeDgmRasterData.push(localDgmData);
            activeDgmRasterLayers.push(tiffLayer);
            const overall = getOverallDgmMinMax();
            activeDgmRasterData.forEach(d => {
              d.layer.setStyle(createGeoTiffStyle(overall.min, overall.max));
            });

            map.getView().fit(extent3857, { duration: 1000 });
            tiffLayer.getSource().refresh();
            
            if (typeof layerSwitcher !== 'undefined') layerSwitcher.render();
        });
      }  
      
      // 2. SHAPEFILE-LOGIK (ZIP) -> Unverändert (lädt immer rot/schreibgeschützt)
      else if (fileEnd === 'zip') {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const buffer = e.target.result;
            const geojson = await shp(buffer);
            const sourceName = `shapefile:${zaehlerGeojson}_${fileName}`;
            zaehlerGeojson++;

            const features = new GeoJSON().readFeatures(geojson, {
              featureProjection: 'EPSG:3857'
            });

            addVectorLayerToMap(map, features, sourceName);
          } catch (err) {
            console.error("Fehler beim Shapefile-Parsing:", err);
            alert(`Fehler beim Laden des Shapefiles: ${file.name}`);
          }
        };
        reader.readAsArrayBuffer(file); 
      } 
   
      // 3. TEXT-LOGIK (KML, GeoJSON) -> MIT NEUER WEICHE
      else {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target.result;
          let format;
          let sourceName;
          
          if (fileEnd === 'kml') {
            format = new KML({ extractStyles: true });
            sourceName = `KML:${zaehlerKML}_${fileName}`;
            zaehlerKML++;
           } else if (fileEnd === 'gml') {
            format = new GML3();
            sourceName = `GML:${zaehlerGML}_${fileName}`;
            zaehlerGML++;
            
          } else {
            if (fileName === 'exp_allgm_fsk') {
              format = new GeoJSON();
              sourceName = `fsk`;
            } else  {
              format = new GeoJSON();
              sourceName = `GeoJson:${zaehlerGeojson}_${fileName}`;
              zaehlerGeojson++;
            }
          }

          try {
            const features = format.readFeatures(content, {
              featureProjection: 'EPSG:3857'
            });

            // 💡 DIE NEUE WEICHE: Nur GeoJSON/JSON bei aktiver Zeichenleiste abfangen
            const istGeoJson = (fileEnd === 'geojson' || fileEnd === 'json');
            const istGml = (fileEnd === 'gml');

            if (istGeoJson && istZeichenleisteAktiv()) {
              // Pfad 1: Bearbeitungsmodus aktivieren (Gelb & Editierbar)
              features.forEach((feature, index) => {
                if (!feature.get('id')) {
                  feature.set('id', `imported_${Date.now()}_${index}`);
                }
                calculateMetrics(feature); // Berechnet direkt alle Geometrie-Attribute
              });

              drawSource.addFeatures(features);
              map.getView().fit(drawSource.getExtent(), { duration: 1000, padding: [50, 50, 50, 50] });
              console.log(`"${file.name}" direkt in den Bearbeitungsmodus (drawSource) geladen.`);
            } else if (istGml) {
              // Pfad 3: GML-Datei (immer als normaler Layer, da Editierbarkeit hier komplex ist)
              addVectorLayerToMap(map, features, sourceName);
              console.log(`"${file.name}" als GML-Vektor-Layer hinzugefügt.`);
            } 
            else {
              // Pfad 2: Normalzustand (Rot & Schreibgeschützt als separater Layer)
              addVectorLayerToMap(map, features, sourceName);
              console.log(`"${file.name}" als normalen Vektor-Layer hinzugefügt.`);
            }

          } catch (err) {
            console.error("Fehler beim Parsen:", err);
            alert(`Fehler beim Laden von ${file.name}`);
          }
        };
        reader.readAsText(file);
      }
    });
    fileInput.value = '';
  };
  fileInput.click();
}

function addVectorLayerToMap(map, features, sourceName) {
  const vectorSource = new VectorSource({
    features: features
  });

  // 👉 Style abhängig vom sourceName auswählen
  const style = sourceName === 'fsk'
    ? getStyleForArtFSK
    : uploadStyle;

  const vectorLayer = new VectorLayer({
    source: vectorSource,
    title: sourceName,
    name: sourceName,
    isUserGeoJSON: true, // 💡 DAS FLAG: Hieran erkennen wir den Layer gleich!
    style: style
  });

  map.addLayer(vectorLayer);

  if (features.length > 0) {
    map.getView().fit(vectorSource.getExtent(), {
      padding: [50, 50, 50, 50],
      duration: 1000,
      maxZoom: 18
    });
  }
}

// Wir definieren den Style einmal außerhalb, damit er nicht bei jedem 
// Feature-Upload neu erstellt werden muss (besser für die Performance).
const uploadStyle = new Style({
  // Style für Polygone und die Füllung von Kreisen
  fill: new Fill({
    color: 'rgba(46, 32, 243, 0.2)', // Rot mit 20% Deckkraft
  }),
  // Style für Linien und die Umrandung von Kreisen/Polygonen
  stroke: new Stroke({
    color: '#ff0000', // Kräftiges Rot
    width: 2,
  }),
  // Spezieller Style für Punkt-Geometrien
  image: new Circle({
    radius: 6,
    fill: new Fill({
      color: 'rgba(255, 0, 0, 0.5)', // Punkt-Füllung etwas kräftiger (50%)
    }),
    stroke: new Stroke({
      color: '#ff0000',
      width: 2,
    }),
  }),
});

function shouldShowPopup(layer) {

  if (isTableEnabled()) return false;

  return true;
}

function createDatenLink(url, label) {
  if (url && url.trim() !== '') {
    return `<a href="${url}" style="color: #0078d4; text-decoration: underline;" onclick="window.open('${url}', '_blank'); return false;">${label}</a>`;
  }
  return label;
}

export function initPopup(map) {
  const container = document.getElementById('popup');
  const content = document.getElementById('popup-content');
  const closer = document.getElementById('popup-closer');
  popupOverlay = new Overlay({
    element: container,
    autoPan: true,
    autoPanAnimation: { duration: 250 }
  });

  // ✅ WICHTIG – wieder aktivieren!
  map.addOverlay(popupOverlay);
  popupContent = content; // 👉 speichern!

  closer.onclick = function () {
    popupOverlay.setPosition(undefined);
    return false;
  };
}
function buildPopupContent(featureOrProps, layerName) {
  if (!featureOrProps) {
    return "<p>Keine Daten</p>";
  }
  
  // OL-Feature ODER normales Objekt
  const isOlFeature = typeof featureOrProps.getProperties === 'function';
  const daten = isOlFeature ? featureOrProps.getProperties(): featureOrProps;
  let html = "";

  
  // Überschrift
  const normalizedLayerName = layerName.toLowerCase();
  if (normalizedLayerName === 'fsk') {
    const ueberschrift = daten.Eig1 ? `Eigentümer: ${daten.Eig1}` : 'Keine Bezeichnung';
    const info =
      `Gemark: ${daten.Gemark}<br>` +
      `ID: ${daten.fsk}<br>` +
      `Flur: ${daten.Flur}<br>` +
      `Flurstk.: ${daten.Zaehler}/${daten.Flur}`;
    html += `<strong>${ueberschrift}</strong><br>`;
    html += `<span>${info}</span><br>`;

  } else if (normalizedLayerName === 'dgmkacheln' || normalizedLayerName === 'domkacheln') 
   
  {
    if (daten.tile_id) {
      html += `<strong>Kachel: ${daten.tile_id}</strong><br>`;
    }
  } else {
    // 1. Priorisierte Suchbegriffe (Wortbestandteile) definieren
    const preferredKeys = [
      'name',
      'bezeich', // deckt bezeich, bezeichnung, bezeichnung_neu etc. ab
      'titel',
      'label',
      'id',
      'objectid',
      'nummer',
      'typ',
      'ebene'
    ];

    // 2. Alle Schlüssel des Daten-Objekts holen
    const datenKeys = Object.keys(daten);
    // 3. Den ersten Schlüssel finden, der einen unserer Wunschbegriffe enthält
    let dynamicKey = null;
    // Wir gehen die preferredKeys der Reihe nach durch (Priorität von oben nach unten)
    for (const word of preferredKeys) {
      dynamicKey = datenKeys.find(key => key.toLowerCase().includes(word));
      // Wenn wir einen Schlüssel gefunden haben und dieser im Objekt auch einen Wert hat, brechen wir ab
      if (dynamicKey && daten[dynamicKey]) {
        break;
      }
    }
    // 4. Titel auslesen oder Fallback nutzen
    const title = dynamicKey ? daten[dynamicKey] : 'Keine Bezeichnung';
    html += `<strong>${dynamicKey ? dynamicKey + ': ' : ''}${title}</strong><br>`;
  }
  // DGM / DOM Link
  const kachelUrl = daten.dgm1 || daten.dom1;
  if (kachelUrl) {
    let bbox = null;
    // Nur OL-Feature besitzt Geometry
    if (isOlFeature) {
      bbox =
        featureOrProps
          .getGeometry()
          ?.getExtent() || null;
    }
    html += `
      <div style="margin-top:5px;">
        <a href="#"
           class="popup-link"
           data-tif="${kachelUrl}"
           data-tile_id="${daten.tile_id}"
           data-bbox='${JSON.stringify(bbox)}'>
           Kachel laden
        </a>
      </div>
    `;
  }

  // Fotos
  const fotoLinks = [];
  if (daten.foto1) fotoLinks.push(`<a href="${daten.foto1}" target="_blank" class="popup-link">Foto 1</a>` );
  if (daten.foto2) fotoLinks.push(`<a href="${daten.foto2}" target="_blank" class="popup-link">Foto 2</a>` );
  if (daten.foto3) fotoLinks.push(`<a href="${daten.foto3}" target="_blank" class="popup-link">Foto 3</a>` );
  if (daten.foto4) fotoLinks.push(`<a href="${daten.foto4}" target="_blank" class="popup-link">Foto 4</a>` );
  if (fotoLinks.length > 0) {
    html += `
      <div style="margin-top:8px;">
        ${fotoLinks.join(", ")}
      </div>
    `;
  }
 
  // 👉 AKTION-BUTTONS NEBENEINANDER (MITHILFE VON FLEXBOX)
  /* 
  html += `
    <div style="display: flex; gap: 2px; margin-top: 10px;">
      <button id="open-table-btn" style="font-size: 10px; padding: 1px 2px; cursor: pointer; flex: 1;">Tabelle</button>
      <button id="open-daten-btn" style="font-size: 10px; padding: 1px 2px; cursor: pointer; flex: 1;">Daten</button>
    </div>
  `;
 */
  
  // 👉 AKTION-BUTTONS NEBENEINANDER (MITHILFE VON FLEXBOX)
  html += `
    <div style="display: flex; gap: 2px; margin-top: 10px;">
      <button id="open-daten-btn" style="font-size: 10px; padding: 1px 2px; cursor: pointer; flex: 1;">Daten</button>
    </div>
  `;


  return html;
}
document.addEventListener('click', (e) => {
  const box = document.getElementById('feature-select');
  // Ausnahme: Wenn der Klick auf den Tabellen-Schließen-Button ging, tu nichts!
  if (e.target.id === 'close-table-btn' || e.target.closest('#close-table-btn')) {
    return;
  }
  // Prüfen, ob der Klick auf die Karte ging, um die Box zu öffnen, falls ID vorhanden ist
  const isMapClick = e.target.closest('#map'); 
  // Wenn der Klick außerhalb der Box war UND nicht der Klick war, der die Box öffnet
  if (!box.contains(e.target)) {
    // Falls du sicherstellen willst, dass ein neuer Klick auf ein Feature die Box nicht schließt, bevor die neuen Daten geladen sind:
    if (isMapClick) return; 
    box.classList.add('hidden');
  }
});
function showDataInModal(daten, layerName) {
  const modal = document.getElementById("daten-modal");
  const content = document.getElementById("daten-modal-content");
  const closeBtn = document.getElementById("close-daten-modal");

  if (!modal || !content) return;

  closeBtn.onclick = (e) => { 
    e.stopPropagation(); 
    modal.style.display = "none"; 
  
    // 👉 Holt den Fokus zurück zur Auswahlliste, damit sie offen und aktiv bleibt
    const selectContainer = document.getElementById('feature-select');
    if (selectContainer) {
      selectContainer.focus();
    }
  };

  modal.onclick = (e) => { 
  if (e.target === modal) {
    e.stopPropagation(); 
    modal.style.display = "none"; 
    
    // 👉 Auch hier beim Klick auf den Hintergrund den Fokus zurückgeben
    const selectContainer = document.getElementById('feature-select');
    if (selectContainer) {
      selectContainer.focus();
      }
    }
  };

  let tableHtml = `<table style="width: 100%; border-collapse: collapse; text-align: left;">`;
  
  tableHtml += `<thead><tr><th style="width: 30%;">Attribut</th> <th style="width: 70%;">Wert</th></tr></thead><tbody>`;
  
  Object.entries(daten).forEach(([key, value]) => {
    const lowerKey = key.toLowerCase();

    // =================================================================
    // 🚫 BLACKLIST: DIESE ATTRIBUTE WERDEN RADIKAL AUSGEBLENDET
    // =================================================================
    const geometryKeywords = [
      'geom', 
      'shape', 
      'geometry', 
      'the_geom', 
      'spatial',
      'boundingbox',
      'bbox',
      'koordinat', 
      'origin_layer',
      'georeference',
      'position',
      'gml',
      'wkt',
      'wkb',      
    ];

    const isGeometry = geometryKeywords.some(keyword => lowerKey.includes(keyword));
    const isComplexObject = typeof value === 'object' && value !== null;

    if (isGeometry || isComplexObject) {
      return; 
    }

   // =================================================================
    // AB HIER FOLGT DEINE NORMALE LISTEN-GENERIERUNG
    // =================================================================
    let displayValue;
    if (value === undefined || value === null || String(value).trim() === "") {
      displayValue = "<em>keine Angabe</em>";
    } else {
      const stringValue = String(value).trim();
      const isUrl = stringValue.match(/^https?:\/\//i) || stringValue.toLowerCase().startsWith('www.');
      
      if (isUrl) {
        const formalUrl = stringValue.toLowerCase().startsWith('www.') ? `https://${stringValue}` : stringValue;
        displayValue = createDatenLink(formalUrl, "Link öffnen 🌐");
      } 
      // 💡 NEU: Bedingung für Zahlen (prüft Nummern und Zahlen-Strings)
      else if (!isNaN(stringValue) && !isNaN(parseFloat(stringValue))) {
        const num = parseFloat(stringValue);
        // Prüfen, ob die Zahl Nachkommastellen besitzt
        if (num % 1 !== 0) {
          displayValue = num.toFixed(2); // Auf 2 Nachkommastellen runden
        } else {
          displayValue = num; // Ganze Zahl so belassen
        }
      } 
      else {
        displayValue = value;
      }
    }

    // Optimiertes CSS für lange Texte & Silbentrennung
    tableHtml += `<tr> <td class="attr-key">${key}</td> <td class="attr-val">${displayValue}</td> </tr>`; });
    tableHtml += `</tbody></table>`;
    content.innerHTML = tableHtml;
    modal.style.display = "flex";
}

