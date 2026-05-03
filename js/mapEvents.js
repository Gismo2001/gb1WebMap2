// js/mapEvents.js

import { updateSelector, showTableDebounced, closeTable } from './table.js';

import { isTableEnabled } from './controls.js';
import { table, highlightFeatureForRow } from './table.js';

import GeoTIFF from 'ol/source/GeoTIFF';
import GeoTIFFSource from 'ol/source/GeoTIFF';
import WebGLTileLayer from 'ol/layer/WebGLTile';
import { transformExtent } from 'ol/proj';

import { EXCLUDED_LAYERS } from './config.js';

import Overlay from 'ol/Overlay.js';
import { toStringHDMS } from 'ol/coordinate'; // z.B. für Koordinatenanzeige

import { isDgmActive, setDgmActive } from './dgmdom.js';

let currentClickResults = {};
let latestClickRequestId = 0;

let popupOverlay;
let popupContent;


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
// Funktion zum Initialisieren des Karten-Klick-Events

export function initMapClick(map) {
  map.on('singleclick', function (evt) {
    // 1. Sofortiges Feedback: Popup schließen, wenn Tabelle nicht aktiv ist
    if (!isTableEnabled()) {
      popupOverlay.setPosition(undefined);
    }
    const requestId = ++latestClickRequestId;
    const promises = [];
    const viewResolution = map.getView().getResolution();
    const coord = evt.coordinate;
    
    // Aktuelle Ergebnisse zurücksetzen
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
            coord,
            viewResolution,
            'EPSG:3857',
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
          .then((responseText) => {
            if (responseText) return responseText;
            return requestFeatureInfo('text/html');
          })
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
              // 👉 WMS-Daten mit Koordinaten und Layername "impfen"
              data.forEach(item => {
                item._clickCoord = coord;
                item.origin_layer = name;
              });

              currentClickResults[name] = {
                data: data,
                layer: layer
              };
            }
          })
          .catch((error) => {
            console.warn(`GetFeatureInfo Fehler bei '${name}':`, error);
          });

        promises.push(promise);
      }
    });

    // WMS-Anfragen
    Promise.all(promises).then(() => {
      if (requestId !== latestClickRequestId) return;

      // 2. Vektor-Features abrufen und ebenfalls impfen
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

      // 👉 FALL 1: Tabelle aktiv (Split-Screen)
      if (isTableEnabled()) {
        const clickedFeatureData = currentClickResults[layerNames[0]].data[0];
        const selector = document.getElementById('layer-selector');
        const currentSelectedLayer = selector ? selector.value : "unknown";
        
        // Prüfen, ob wir bereits im richtigen Layer sind -> dann nur Scrollen
        if (typeof table !== 'undefined' && table && currentSelectedLayer === layerNames[0]) {
          const idKey = (currentSelectedLayer === 'fsk') ? 'OBJECTID' : 'ID_con';
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

        // Andernfalls: Tabelle neu laden (Daten enthalten nun _clickCoord)
        updateSelector(layerNames);
        showTableDebounced(currentClickResults[layerNames[0]].data);
        return; 
      }

     // 👉 FALL 2: Tabelle NICHT aktiv → Popup anzeigen
    handleClickResult(currentClickResults, coord);

    });
  });
}

async function handleClickResult(currentClickResults, coord) {

  const layerNames = Object.keys(currentClickResults);

  let chosenLayer = layerNames[0];
  let chosenIndex = 0;

  const needsSelection =
  !isDgmActive && (
    layerNames.length > 1 ||
    currentClickResults[layerNames[0]].data.length > 1
  );


  if (needsSelection) {
    const choice = await askUserToChoose(currentClickResults);
    chosenLayer = choice.layer;
    chosenIndex = choice.index;
  }


  const entry = currentClickResults[chosenLayer];
  const featureData = entry.data[chosenIndex];

  if (!shouldShowPopup(entry.layer)) return;

  popupContent.innerHTML = buildPopupContent([featureData], chosenLayer);
  popupOverlay.setPosition(coord);

  setTimeout(() => {
    const btn = document.getElementById('open-table-btn');
    if (btn) {
      btn.onclick = () => {
        updateSelector([chosenLayer]);
        showTableDebounced([featureData]);
        popupOverlay.setPosition(undefined);
      };
    }
  }, 0);
}

function askUserToChoose(currentClickResults) {
  return new Promise(resolve => {
    const box = document.getElementById('feature-select-dropdown');
    const select = document.getElementById('feature-select');
    const closeBtn = document.getElementById('close-select-btn');


    select.innerHTML = ''; // alte Optionen löschen

    // Optionen aufbauen
    for (const layerName in currentClickResults) {
      const entry = currentClickResults[layerName];

      // Eindeutige Features pro Layer erzeugen
const uniqueData = [];
const seen = new Set();

entry.data.forEach((feat, idx) => {
  const key = JSON.stringify(feat); // oder feat.id, falls vorhanden
  if (!seen.has(key)) {
    seen.add(key);
    uniqueData.push({ feat, idx });
  }
});

// Dropdown-Optionen erzeugen
uniqueData.forEach(({ feat, idx }) => {
  const opt = document.createElement('option');
  opt.value = `${layerName}::${idx}`;
  opt.textContent = `${layerName}: ${feat.name || 'Feature ' + (idx + 1)}`;
  select.appendChild(opt);
});

    }

    // Dropdown anzeigen
    box.classList.remove('hidden');

    // Auswahl-Event
    select.onchange = () => {
      const [layer, index] = select.value.split('::');
      box.classList.add('hidden');
      resolve({ layer, index: Number(index) });
    };

    // Close-Button
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

  map.forEachFeatureAtPixel(evt.pixel, function (feature, layer) {

    const name = (layer?.get('name') || '').toLowerCase();
    const title = (layer?.get('title') || '').toLowerCase();

    if (EXCLUDED_LAYERS.includes(name) || EXCLUDED_LAYERS.includes(title)) {
      return;
    }

    const key = name || title || 'vector';

    if (!results[key]) {
      results[key] = {
        data: [],
        layer: layer
      };
    }

    const props = feature.getProperties();
    const cleanProps = { ...props };
    delete cleanProps.geometry;

    results[key].data.push(cleanProps);
  });

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

  const results = getVisibleVectorFeatures(map);
  const layerNames = Object.keys(results);

  if (layerNames.length > 0) {
    const selector = document.getElementById('layer-selector');
    const currentSelection = selector ? selector.value : null;

    updateSelector(layerNames);

    let layerToShow = layerNames[0];
    if (currentSelection && results[currentSelection]) {
      layerToShow = currentSelection;
    }

    showTableDebounced(results[layerToShow]);
  } else {
    showTableDebounced([]);
    // Optional: Den Selector leeren oder auf einen Standardwert setzen
    updateSelector([]);
  }
}

//Eventhandler für Layerswitcher Click (nur bestimmte Element, z.B. Gruppe öffnen)
export function switcherDrawList(layerSwitcher) {
  layerSwitcher.on('drawlist', (evt) => {
  
  var layer = evt.layer;
  // Klick-Listener auf den Label-Text hinzufügen
  evt.li.querySelector('label').addEventListener('click', () => {
    //console.log(layer.get('title') +' Sichtbarkeit: '+ layer.getVisible());
  });
});
}

export function switcherToggle(layerSwitcher) {
layerSwitcher.on('drawlist', (evt) => {
  var layer = evt.layer;
  // Klick-Listener auf den Label-Text hinzufügen
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
        const reader = new FileReader();
        reader.onload = (e) => {
          const arrayBuffer = e.target.result;
          // Hier müsste die GeoTIFF-Logik hin, z.B. mit ol/source/GeoTIFF 
          console.log('tiff-Datei - Hier müsste GeoTIFF-Logik hin');
          console.log(arrayBuffer);
        };
        reader.readAsArrayBuffer(file);
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
  const name = (layer?.get('name') || '').toLowerCase();
  
  const allowedWmsLayers = ['uesg', 'fließgew', 'ALKIS', 'LSG', 'NSG', 'gewaesser', 'nibis bohrdaten'];
  const isVector = !layer?.getSource()?.getFeatureInfoUrl;
  return isVector || allowedWmsLayers.includes(name);
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
function buildPopupContent(data, layerName) {
  if (!data || data.length === 0) return "<p>Keine Daten</p>";
  
  const daten = data[0];
  let html = "";
  
  // 1. Überschrift & Inhalt bestimmen 🏷️
  const normalizedLayerName = layerName.toLowerCase();
  if (normalizedLayerName === 'fsk') {
    // Spezialfall für FSK: Eig1 als Überschrift, Suche als Zusatzinhalt
    const ueberschrift = "Eigentümer: " + daten.Eig1 || "Keine Bezeichnung";
    const info = (
      `Gemark: ${daten.Gemark}<br>` +
      `ID: ${daten.fsk}<br>` +
      `Flur: ${daten.Flur}<br>` +
      `Flurstk.: ${daten.Zaehler}/${daten.Flur}`
    ) || "";
    
    html += `<strong>${ueberschrift}</strong><br>`;
    if (info) {
      html += `<span>${info}</span><br>`;
    }
    
  } else if (normalizedLayerName === 'dgmkacheln' || normalizedLayerName === 'domkacheln') {
    if (daten.tile_id) {
      html += `<strong>Kachel: ${daten.tile_id}</strong><br>`;
    }
  } else {
    // Standard für alle anderen Layer
    const topValues = Object.values(daten).slice(2, 3).join(" ");
    html += `<strong>${topValues}</strong><br>`;
  }

 // 2. Kachel-Links (DGM oder DOM) hinzufügen 🔗
const kachelUrl = daten.dgm1 || daten.dom1;

if (kachelUrl) {

  // BBOX aus Feature-Geometrie berechnen
  let bbox = null;
  if (daten.geometry && typeof daten.geometry.getExtent === "function") {
    bbox = daten.geometry.getExtent();
  }

  html += `<div style="margin-top: 5px;">`;
  html += `
    <a href="#"
       class="popup-link"
       data-tif="${daten.dgm1 || daten.dom1}"
       data-tile_id="${daten.tile_id}"
       data-bbox='${JSON.stringify(bbox)}'>
       Kachel laden
    </a>
  `;
  html += `</div>`;
}

  
  // 3. Fotolinks sammeln 📸
  const fotoLinks = [];
  if (daten.foto1) fotoLinks.push(`<a href="${daten.foto1}" target="_blank" class="popup-link">Foto 1</a>`);
  if (daten.foto2) fotoLinks.push(`<a href="${daten.foto2}" target="_blank" class="popup-link">Foto 2</a>`);
  if (daten.foto3) fotoLinks.push(`<a href="${daten.foto3}" target="_blank" class="popup-link">Foto 3</a>`);
  if (daten.foto4) fotoLinks.push(`<a href="${daten.foto4}" target="_blank" class="popup-link">Foto 4</a>`);

  if (fotoLinks.length > 0) {
    html += `<div style="margin-top: 8px;">`;
    html += fotoLinks.join(", ");
    html += `</div>`;
  }

  // 4. Link zur Tabelle 📊
  html += `<br><button id="open-table-btn" style="font-size:12px;">Details anzeigen</button>`;
  
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
