// js/mapEvents.js

import { updateSelector, showTableDebounced, closeTable } from './table.js';
import { isTableEnabled } from './controls.js';


import GeoTIFF from 'ol/source/GeoTIFF';
import GeoTIFFSource from 'ol/source/GeoTIFF';
import WebGLTileLayer from 'ol/layer/WebGLTile';
import { transformExtent } from 'ol/proj';



let currentClickResults = {};
let latestClickRequestId = 0;

export function getAllLayers(layerGroup, parentVisible = true, groupTitle = null) { //Funktion wurd aus Event SingleClick in initMapClick aufgerufen
  let layers = [];
  const currentTitle = layerGroup.get('title') || groupTitle; // aktuelle Namen und Gruppen ermitteln
  
  layerGroup.getLayers().forEach((layer) => { // Für jeden Layer in einer Gruppe
    const isVisible = parentVisible && layer.getVisible(); // Ist die Gruppe und ein Layer sichtbar dann isVisible = true
    
    if (layer.getLayers) {  //Wenn was gefunden wurde
      //Rekursiver Aufruf, Die Funktion ruft sich selbst auf allerdings jetzt mit:
      // layer → ist hier eine LayerGroup 
      // isVisible → bisher berechnete Sichtbarkeit wird weitergegeben 
      // currentTitle → Gruppentitel wird „vererbt“

      layers = layers.concat(getAllLayers(layer, isVisible, currentTitle)); 
    } else {
      layers.push({
        layer,
        visible: isVisible,
        groupTitle: currentTitle,
      });
    }
  });
  
  return layers; // Gibt das Ergebnis zurück
}

export function initMapClick(map) { // Funktion wird nur aufgerufen, wenn Tabelle im Split aktiv ist
  map.on('singleclick', function (evt) {
    const requestId = ++latestClickRequestId;
    if (!isTableEnabled()) return; // Wenn Tabelle im Splitscreen sichtbar
    const promises = []; // Leeres Array ??
    const viewResolution = map.getView().getResolution(); 
    currentClickResults = {}; // Leeres Feld für Aufnahme des Klickergebnisses ??
    const allLayers = getAllLayers(map); // Alle Layer ermitteln, ruft die Funktion weiter oben auf 
    
    allLayers.forEach((obj) => { //Für jeden Layer, bzw. alle Objekte von allLayers
      const layer = obj.layer; // Das Objekt layer zuweisen
      if (obj.visible && layer.getSource()?.getFeatureInfoUrl) { //Wen  Layer sichtbar und unterstützt GetFeatureInfo
        const name = layer.get('name');

        const url = layer.getSource().getFeatureInfoUrl( // url auslesen
          evt.coordinate,
          viewResolution,
          'EPSG:3857',
          {
            INFO_FORMAT: 'text/xml',
            QUERY_LAYERS: layer.getSource().getParams().LAYERS,
            LAYERS: layer.getSource().getParams().LAYERS,
          }
        );
        console.log (url)
        if (url) {
          promises.push(
            fetch(url)
              .then((res) => res.text())
              .then((xml) => {
                if (requestId !== latestClickRequestId) return;

                const data = parseArcGISXml(xml, name);
                if (data.length > 0) {
                  currentClickResults[name] = data;
                }
              })
              .catch((error) => {
                console.warn(`GetFeatureInfo fehlgeschlagen für Layer '${name}':`, error);
              })
          );
        }
      }
    });

    Promise.all(promises).then(() => {
      if (requestId !== latestClickRequestId) return;

      const vectorResults = getVectorFeaturesAtClick(map, evt);
      Object.keys(vectorResults).forEach((layerName) => {
        currentClickResults[layerName] = vectorResults[layerName];
      });

      const layerNames = Object.keys(currentClickResults);
      if (layerNames.length > 0) {
        if (isTableEnabled()) {
          updateSelector(layerNames);
          showTableDebounced(currentClickResults[layerNames[0]]);
        }
      } else if (isTableEnabled()) {
        // closeTable();
      }
    });
  });
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
    const layerName = layer?.get('name') || 'Vector';

    if (!results[layerName]) {
      results[layerName] = [];
    }

    const props = feature.getProperties();
    const cleanProps = { ...props };
    delete cleanProps.geometry;

    results[layerName].push(cleanProps);
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
    closeTable();
  }
}

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

// js/mapEvents.js
import { drawSearchPoint } from './ptn.js';
export function initSearchEvents(searchControl, map) {
  if (!searchControl) return;

searchControl.on('select', (e) => {
    const coord = e.coordinate;
    if (!coord) return;

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
    fileInput.accept = '.geojson,.json,.kml,.tif,.tiff';
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
        console.log('tiff-Datei');
      } else {
         const reader = new FileReader();
         reader.onload = (e) => {
            const content = e.target.result;
            let format;
            let sourceName;
              if (fileEnd === 'kml') {
                format = new KML({ extractStyles: true });
                sourceName = `KML: ${zaehlerKML} ${fileName}`;
                zaehlerKML++;
              } else {
                format = new GeoJSON();
                sourceName = `GeoJson: ${zaehlerGeojson} ${fileName}`;
                zaehlerGeojson++;
              }
              try {
                const features = format.readFeatures(content, {
                  featureProjection: 'EPSG:3857'
                  });
                const vectorSource = new VectorSource({
                  features: features
                });
                const vectorLayer = new VectorLayer({
                  source: vectorSource,
                  title: sourceName,
                  name: sourceName
                });
                map.addLayer(vectorLayer); 
                if (features.length > 0) {
                  map.getView().fit(vectorSource.getExtent(), {
                  padding: [50, 50, 50, 50],
                  duration: 1000,
                  maxZoom: 18
                  });
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

