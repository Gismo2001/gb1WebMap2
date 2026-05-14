import { updateSelector, showTableDebounced, closeTable } from './table.js';

import { isTableEnabled } from './controls.js';
import { table, highlightFeatureForRow, clearHighlightedFeature } from './table.js';

import GeoTIFF from 'ol/source/GeoTIFF';
import GeoTIFFSource from 'ol/source/GeoTIFF';
import WebGLTileLayer from 'ol/layer/WebGLTile';
import { transformExtent } from 'ol/proj';

import { EXCLUDED_LAYERS } from './config.js';

import Overlay from 'ol/Overlay.js';
import { toStringHDMS } from 'ol/coordinate'; // z.B. für Koordinatenanzeige

import { isDgmActive, setDgmActive } from './dgmdom.js';
import { isDomActive, setDomActive } from './dgmdom.js';
import { profileMode } from './chart.js';

let currentClickResults = {};
let latestClickRequestId = 0;

let popupOverlay;
let popupContent;

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
// Prüft, ob der DOM-Kachel-Layer im Layer-Switcher sichtbar ist
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
function getOrCreatePopup1(map) {
  let popup1 = document.getElementById('popup1');
  if (!popup1) {
    popup1 = document.createElement('div');
    popup1.id = 'popup1';
    popup1.style.cssText = `
      position: absolute; background: white; padding: 6px; 
      border-radius: 6px; border: 1px solid #ccc; font-size: 13px; 
      z-index: 10000; min-width: 120px; box-shadow: 0 2px 10px rgba(0,0,0,0.25);
    `;
    map.getTargetElement().appendChild(popup1);
  }
  return popup1;
}

// 🟢 SPEZIALISIERTER FALL 1a: Kachelauswahl dgm
export function handleDgmKachelSelection(map, evt) {
  const popup1 = getOrCreatePopup1(map);
  let featureFound = false;
  map.forEachFeatureAtPixel(evt.pixel, (feature) => {
    featureFound = true;
    const props = feature.getProperties();
    const bbox = feature.getGeometry().getExtent();
    const tifUrl = props.dgm1.replace('https://dgm1.s3.eu-de.cloud-object-storage.appdomain.cloud', '/dgm');
    const alreadyLoaded = loadedDgms.some(d => d.tile_id === props.tile_id);
    popup1.style.left = `${evt.pixel[0] + 10}px`;
    popup1.style.top = `${evt.pixel[1] + 10}px`;
    popup1.style.width = `30px`;
    popup1.innerHTML = `
      <b>Kachel:</b> ${props.tile_id}<br>
      <b>Datum:</b> ${props.Aktualitaet}<br><br>
      ${alreadyLoaded ? '<i>Bereits geladen</i><br><br>' : ''}
      <button class="load-kachel-btn">DGM laden</button>
    `;
    popup1.style.display = 'block';
    const loadBtn = popup1.querySelector('.load-kachel-btn');
    if (loadBtn) {
      loadBtn.onclick = async () => {
        if (!alreadyLoaded) {
          await addDgmLayer(map, tifUrl, bbox, props.tile_id);
          loadedDgms.push({ tile_id: props.tile_id, bbox });
        }
        popup1.style.display = 'none';
      };
    }
  });
  if (!featureFound) popup1.style.display = 'none';
}
// 🟢 SPEZIALISIERTER FALL 1b: Kachelauswahl dom
export function handleDomKachelSelection(map, evt) {
  const popup1 = getOrCreatePopup1(map);
  let featureFound = false;
  map.forEachFeatureAtPixel(evt.pixel, (feature) => {
    featureFound = true;
    const props = feature.getProperties();
    const bbox = feature.getGeometry().getExtent();
    const tifUrl = props.dom1.replace('https://dom1.s3.eu-de.cloud-object-storage.appdomain.cloud', '/dom');
    const alreadyLoaded = loadedDoms.some(d => d.tile_id === props.tile_id);
    popup1.style.left = `${evt.pixel[0] + 10}px`;
    popup1.style.top = `${evt.pixel[1] + 10}px`;
    popup1.innerHTML = `
      <b>Kachel:</b> ${props.tile_id}<br>
      <b>Datum:</b> ${props.Aktualitaet}<br><br>
      ${alreadyLoaded ? '<i>Bereits geladen</i><br><br>' : ''}
      <button class="load-kachel-btn">DOM laden</button>
    `;
    popup1.style.display = 'block';
    const loadBtn = popup1.querySelector('.load-kachel-btn');
    if (loadBtn) {
      loadBtn.onclick = async () => {
        if (!alreadyLoaded) {
          await addDomLayer(map, tifUrl, bbox, props.tile_id);
          loadedDoms.push({ tile_id: props.tile_id, bbox });
        }
        popup1.style.display = 'none';
      };
    }
  });
  if (!featureFound) popup1.style.display = 'none';
}


// 🔵 SPEZIALISIERTER FALL 2a: Höhenabfrage DGM
export function handleDgmHeightQuery(map, evt, visibleDgmLayers) {
  // Wenn der Profilmodus aktiv ist, darf hier nichts passieren
  if (profileMode) {
    console.log("Klick-Interaktion ignoriert, da Profilmodus aktiv.");
    return; 
  }
  const popup1 = getOrCreatePopup1(map);
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
    popup1.style.left = `${evt.pixel[0] + 10}px`;
    popup1.style.top = `${evt.pixel[1] - 15}px`;
    popup1.style.width = `30px`;
    const layerNr = foundLayer.get('name').split('_')[0];
    popup1.innerHTML = `<b>DGM-H:${height.toFixed(2)} m</b>`;
    popup1.style.display = 'block';
  } else {
    popup1.style.display = 'none';
  }
}

// 🔵 SPEZIALISIERTER FALL 2b: Höhenabfrage DOM
export function handleDomHeightQuery(map, evt, visibleDomLayers) {
  // Wenn der Profilmodus aktiv ist, darf hier nichts passieren
  if (profileMode) {
    console.log("Klick-Interaktion ignoriert, da Profilmodus aktiv.");
    return; 
  }
  const popup1 = getOrCreatePopup1(map);
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
    popup1.style.left = `${evt.pixel[0] + 10}px`;
    popup1.style.top = `${evt.pixel[1] - 15}px`;
    const layerNr = foundLayer.get('name').split('_')[0];
    popup1.innerHTML = `<b>DOM-H:${height.toFixed(2)} m</b>`;
    popup1.style.display = 'block';
  } else {
    popup1.style.display = 'none';
  }
}


import { loadedDgms, loadedDoms } from './dgmdom.js';  
import { activeDgmRasterLayers, activeDgmRasterData } from './dgmdom.js'
import { activeDomRasterLayers, activeDomRasterData } from './dgmdom.js'
import { addDgmLayer, addDomLayer } from './dgmdom.js';
import  {handleDgmPointerMove, handleDomPointerMove } from './dgmdom.js'
import {  createEmpty,  extend,  containsCoordinate} from 'ol/extent.js';
export function initMapClick(map) {
  map.on('singleclick', function (evt) {
    // --- 1. DGM- und DOM- LOGIK (PRIORISIERT) ---
    
    // Check: Ist der Kachel-Modus im Layer-Switcher aktiv?
    if (isDgmKachelActive(map)) {
      handleDgmKachelSelection(map, evt); // Deine neue spezialisierte Funktion
      return; // Hier abbrechen: Keine Tabellen-Updates oder WMS-Abfragen!
    }
    // Check: Ist der Kachel-Modus im Layer-Switcher aktiv?
    if (isDomKachelActive(map)) {
      handleDomKachelSelection(map, evt); // Deine neue spezialisierte Funktion
      return; // Hier abbrechen: Keine Tabellen-Updates oder WMS-Abfragen!
    }

    // Prüfen, ob Raster-DGM oder -DOM Layer da sind für Höhenabfrage
    const visibleDgmLayers = activeDgmRasterLayers.filter(l => l.getVisible());
    const visibleDomLayers = activeDomRasterLayers.filter(l => l.getVisible());
    if (visibleDgmLayers.length > 0) {
      handleDgmHeightQuery(map, evt, visibleDgmLayers); // Deine neue spezialisierte Funktion
      // Kein return, damit parallel auch die Tabelle/WMS laden kann
    } else if(visibleDomLayers.length > 0) {
      handleDomHeightQuery(map, evt, visibleDomLayers); // Deine neue spezialisierte Funktion
      // Kein return, damit parallel auch die Tabelle/WMS laden kann
    } else {
      const p = document.getElementById('popup1');
      if (p) p.style.display = 'none';
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
        const firstItem =  firstLayerData.data[0];
        const clickedFeatureData =  firstItem.properties || firstItem;
        const selector = document.getElementById('layer-selector');
        const currentSelectedLayer = selector ? selector.value : "unknown";
        
        if (typeof table !== 'undefined' && table && currentSelectedLayer === layerNames[0]) {
          
          const idKey =
  clickedFeatureData.OBJECTID
    ? 'OBJECTID'
    : clickedFeatureData.ID_con
    ? 'ID_con'
    : clickedFeatureData.ID
    ? 'ID'
    : clickedFeatureData.objectid
    ? 'objectid'
    : clickedFeatureData.id
    ? 'id'
    : null;

    if (!idKey) {
  console.warn('Kein ID-Key gefunden');
  return;
}

const featureId =
clickedFeatureData[idKey];
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

        updateSelector(layerNames);
       
        showTableDebounced(  firstLayerData.data.map(    item => item.properties || item  )
);
      
      } else {
        handleClickResult(currentClickResults, coord);
      }
    });
  });
  map.on('pointermove', handleCombinedPointerMove);
  
}

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


async function handleClickResult(currentClickResults, coord) {
  // Wenn der Profilmodus aktiv ist, darf hier nichts passieren
  if (profileMode) {
    console.log("Klick-Interaktion ignoriert, da Profilmodus aktiv.");
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
  const choice =
      await askUserToChoose(currentClickResults);

    if (!choice) return;

    chosenLayer = choice.layer;
    chosenIndex = choice.index;
  }

  const entry =
    currentClickResults[chosenLayer];

  const selected =
    entry.data[chosenIndex];

  // =====================================================
  // VectorFeature ODER WMS-Objekt
  // =====================================================

  const isWrappedFeature =
    selected &&
    selected.properties &&
    selected.feature;

  const featureData =
    isWrappedFeature
      ? selected.properties
      : selected;

  const feature =
    isWrappedFeature
      ? selected.feature
      : null;

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

    const btn =
      document.getElementById('open-table-btn');

    if (btn) {

      btn.onclick = () => {

        updateSelector([chosenLayer]);

        showTableDebounced(

          currentClickResults[chosenLayer].data.map(
            item => item.properties || item
          )
        );

        popupOverlay.setPosition(undefined);
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

    // 👉 Ausschluss prüfen
    if (EXCLUDED_LAYERS.includes(name) || EXCLUDED_LAYERS.includes(title)) {
      return;
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

function askUserToChoose(currentClickResults) {

  return new Promise(resolve => {

    const box =
      document.getElementById('feature-select-dropdown');

    const select =
      document.getElementById('feature-select');

    const closeBtn =
      document.getElementById('close-select-btn');

    select.innerHTML = '';

    // =====================================================
    // Optionen erzeugen
    // =====================================================

    for (const layerName in currentClickResults) {

      const entry = currentClickResults[layerName];

      const uniqueData = [];
      const seen = new Set();

      entry.data.forEach((item, idx) => {

        const props = item.properties || item;

        // stabile ID bestimmen
        const key =
          props.OBJECTID ||
          props.ID_con ||
          props.ID ||
          props.objectid ||
          props.tile_id ||
          idx;

        if (!seen.has(key)) {

          seen.add(key);

          uniqueData.push({
            item,
            idx
          });
        }
      });

      // =================================================
      // Dropdown-Einträge
      // =================================================

      uniqueData.forEach(({ item, idx }) => {

        const props = item.properties || item;

        const label =
          props.name ||
          props.title ||
          props.Title ||
          props.Titel ||
          props.titel ||
          props.Name ||
          props.bezeich ||
          props.Bezeichnung ||
          props.Eig1 ||
          props.tile_id ||
          props.ID_con ||
          props.OBJECTID ||
          `Feature ${idx + 1}`;

        const opt = document.createElement('option');

        opt.value = `${layerName}::${idx}`;

        opt.textContent =
          `${layerName}: ${label}`;

        select.appendChild(opt);
      });
    }

    // =====================================================
    // Anzeigen
    // =====================================================

    box.classList.remove('hidden');

    // Auswahl
    select.onchange = () => {

      const [layer, index] =
        select.value.split('::');

      box.classList.add('hidden');

      resolve({
        layer,
        index: Number(index)
      });
    };

    // Abbrechen
    closeBtn.onclick = () => {

      box.classList.add('hidden');

      resolve(null);
    };
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

  const result = [];

  // 👉 alle Tabellen durchgehen
  const tables = doc.querySelectorAll('table');

tables.forEach((table) => {
  const headers = Array.from(table.querySelectorAll('th')).map(th =>
    th.textContent.trim()
  );

  const rows = table.querySelectorAll('tr');

  rows.forEach((row, rowIndex) => {
    if (rowIndex === 0) return; // Header überspringen

    const cells = row.querySelectorAll('td');

    if (cells.length === headers.length && cells.length > 0) {
      headers.forEach((header, i) => {

        const text = cells[i].textContent.trim();

        result.push({
  attribute: header,
  value: text
});

      });
    }
  });
});

  return result;
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

    // Wenn beides NICHT zutrifft, wird der Layer übersprungen
    if (!isInAllowedGroup && !isFSKLayer) return;

    // Ab hier läuft die gewohnte Logik für die gültigen Layer
    //console.log("Verarbeite Layer:", name);
    
    const source = typeof layer.getSource === 'function' ? layer.getSource() : null;
    if (!source || typeof source.getFeaturesInExtent !== 'function') return;

    const features = source.getFeaturesInExtent(extent);
    if (features.length === 0) return;

    results[name || 'Unbenannter Layer'] = features.map((f) => {
      const props = { ...f.getProperties() };
      delete props.geometry;
      return props;
    });
  });
  return results;
}
export function updateTableFromVisibleLayers(map) {

  if (!isTableEnabled()) return;

  const results =
    getVisibleVectorFeatures(map);

  const layerNames =
    Object.keys(results);

  if (layerNames.length > 0) {

    const selector =
      document.getElementById('layer-selector');

    const currentSelection =
      selector ? selector.value : null;

    updateSelector(layerNames);

    let layerToShow =
      layerNames[0];

    if (
      currentSelection &&
      results[currentSelection]
    ) {
      layerToShow =
        currentSelection;
    }

    const entry =
      results[layerToShow];

    const data =
      Array.isArray(entry)
        ? entry
        : entry?.data || [];

    const normalizedData =
      data.map(item =>
        item.properties || item
      );

    showTableDebounced(normalizedData);

  } else {

    showTableDebounced([]);

    updateSelector([]);
  }
}
//Eventhandler für Layerswitcher Click (nur bestimmte Element, z.B. Gruppe öffnen)
export function switcherDrawList(layerSwitcher) {
  layerSwitcher.on('drawlist', (evt) => {
  var layer = evt.layer;
  evt.li.querySelector('label').addEventListener('click', () => {
    //console.log(layer.get('title') +' Sichtbarkeit: '+ layer.getVisible());
  });
});
}

export function switcherToggle(layerSwitcher) {
layerSwitcher.on('drawlist', (evt) => {
  var layer = evt.layer;
  evt.li.querySelector('label').addEventListener('click', () => {
    //console.log(layer.get('title') +' Toggle: '+ layer.getVisible());
  });
});
}

import { drawSearchPoint } from './ptn.js';

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

// mapEvents.js
import GeoJSON from 'ol/format/GeoJSON';
import KML from 'ol/format/KML';
import shp from 'shpjs';
import VectorSource from 'ol/source/Vector';
import VectorLayer from 'ol/layer/Vector';

import {  getOverallDgmMinMax, createGeoTiffStyle } from './dgmdom.js';
import { dgmGroup } from './layers.js';

let zaehlerGeojson = 1;
let zaehlerKML = 1;
let fileInput;
export function fileToggleInput(map) {
  if (!fileInput) {
    fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.multiple = true;
    fileInput.accept = '.geojson,.json,.kml,.zip,.tif,.tiff';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);
  }

  fileInput.onchange = (event) => {
    const files = event.target.files;
    if (!files.length) return;

    Array.from(files).forEach(file => {
      const fileName = file.name.replace(/\.[^/.]+$/, "");
      const fileEnd = file.name.split('.').pop().toLowerCase();

if (fileEnd === 'tif' || fileEnd === 'tiff') {
    const blobUrl = URL.createObjectURL(file);
    const sourceName = `Lokal_DGM_${fileName}`;

    const tiffSource = new GeoTIFFSource({
    sources: [{ 
        url: blobUrl,
        nodata: -9999 
    }],
    projection: 'EPSG:25832',
    // Zwingt OL, die Rohwerte als Float32 zu behalten:
    normalize: false, 
    // Verhindert, dass OL die Daten für die Anzeige in RGBA umwandelt:
    convertToRGB: false, 
    sourceOptions: { 
        allowFullFile: true 
    }
});

    tiffSource.getView().then((viewConfig) => {
        const extent3857 = transformExtent(viewConfig.extent, 'EPSG:25832', 'EPSG:3857');
        
        const tiffLayer = new WebGLTileLayer({
            source: tiffSource,
            title: sourceName,
            name: sourceName, // Damit layer.get('name') für dgmdom.js existiert!
            style: createGeoTiffStyle(0, 255), // Nutze die Werte aus deinem QGIS-Check
            opacity: 1
        });

        tiffLayer.bbox = extent3857;

        // In die Gruppen/Arrays (wie bisher)
        if (dgmGroup) dgmGroup.getLayers().push(tiffLayer);
        activeDgmRasterLayers.push(tiffLayer);

        // Zoom
        map.getView().fit(extent3857, { duration: 1000 });

        // Force Refresh: Manchmal braucht WebGL nach dem Laden einen Trigger
        tiffLayer.getSource().refresh();
        
        if (typeof layerSwitcher !== 'undefined') layerSwitcher.render();
    });
}  
//Shapefile-Logik (ZIP)
      else if (fileEnd === 'zip') {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const buffer = e.target.result;
            // shpjs macht aus dem Buffer ein GeoJSON-Objekt
            const geojson = await shp(buffer);
            const sourceName = `shapefile:${zaehlerGeojson}_${fileName}`;
            zaehlerGeojson++;

            // Da shp() ein GeoJSON liefert, nutzen wir den GeoJSON-Format-Reader
            const features = new GeoJSON().readFeatures(geojson, {
              featureProjection: 'EPSG:3857'
            });

            addVectorLayerToMap(map, features, sourceName);
          } catch (err) {
            console.error("Fehler beim Shapefile-Parsing:", err);
            alert(`Fehler beim Laden des Shapefiles: ${file.name}`);
          }
        };
        reader.readAsArrayBuffer(file); // ZIP muss binär gelesen werden!
      } 
      // 👉 Bestehende Text-Logik (KML, GeoJSON)
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
            addVectorLayerToMap(map, features, sourceName);
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

import { Style, Circle, Fill, Stroke } from 'ol/style';
import Layer from 'ol/layer/Layer.js';


import { getStyleForArtFSK } from './utils.js';

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


function createFotoLink(url, label) {
  if (url && url.trim() !== '') {
    
    return `<a href="${url}" onclick="window.open('${url}', '_blank'); return false;">${label}</a>`;
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
  console.log("aufgerufen Build")
  if (!featureOrProps) {
    return "<p>Keine Daten</p>";
  }

  // =====================================================
  // OL-Feature ODER normales Objekt
  // =====================================================

  const isOlFeature =
    typeof featureOrProps.getProperties === 'function';
  console.log("aufgerufen Build is ol: ", isOlFeature)
  const daten = isOlFeature
    ? featureOrProps.getProperties()
    : featureOrProps;

  let html = "";

  // =====================================================
  // Überschrift
  // =====================================================
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
  const preferredKeys = [
  'name',
  'bezeich',
  'titel',
  'label',
  'objectid'
];

// passendes Feld dynamisch suchen
const dynamicKey = Object.keys(daten).find(key => {
const lower = key.toLowerCase();

  return preferredKeys.some(word =>
    lower.includes(word)
  );
});

const title =
  daten[dynamicKey] ||
  daten.name ||
  daten.Name ||
  daten.bezeich ||
  daten.bezeichnung ||
  daten.Bezeichnung ||
  daten.titel ||
  daten.Titel ||
  daten.label ||
  daten.Label ||
  daten.typ ||
  daten.nummer ||
  daten.id ||
  'Keine Bezeichnung';

    html += `<strong>${title}</strong><br>`;
  }

  // =====================================================
  // DGM / DOM Link
  // =====================================================

  const kachelUrl =
    daten.dgm1 || daten.dom1;

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

  // =====================================================
  // Fotos
  // =====================================================

  const fotoLinks = [];

  if (daten.foto1)
    fotoLinks.push(
      `<a href="${daten.foto1}" target="_blank" class="popup-link">Foto 1</a>`
    );

  if (daten.foto2)
    fotoLinks.push(
      `<a href="${daten.foto2}" target="_blank" class="popup-link">Foto 2</a>`
    );

  if (daten.foto3)
    fotoLinks.push(
      `<a href="${daten.foto3}" target="_blank" class="popup-link">Foto 3</a>`
    );

  if (daten.foto4)
    fotoLinks.push(
      `<a href="${daten.foto4}" target="_blank" class="popup-link">Foto 4</a>`
    );

  if (fotoLinks.length > 0) {

    html += `
      <div style="margin-top:8px;">
        ${fotoLinks.join(", ")}
      </div>
    `;
  }

  // =====================================================
  // Tabelle
  // =====================================================

  html += `
    <br>
    <button id="open-table-btn" style="font-size:12px;">
      Details anzeigen
    </button>
  `;

  return html;
}
document.addEventListener('click', (e) => {
  const box = document.getElementById('feature-select-dropdown');

  // Wenn Dropdown unsichtbar → nichts tun
  if (box.classList.contains('hidden')) return;

  // Wenn Klick IN der Box → nichts tun
  if (box.contains(e.target)) return;

  // Sonst → schließen
  box.classList.add('hidden');
});
