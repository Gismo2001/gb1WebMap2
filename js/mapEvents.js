// js/mapEvents.js

import { updateSelector, showTableDebounced, closeTable } from './table.js';
import { isTableEnabled } from './controls.js';




let currentClickResults = {};

export function getAllLayers(layerGroup, parentVisible = true, groupTitle = null) {
  let layers = [];
  
  // Falls die aktuelle layerGroup selbst ein Titel hat, merken wir uns den
  const currentTitle = layerGroup.get('title') || groupTitle;

  layerGroup.getLayers().forEach(layer => {
    const isVisible = parentVisible && layer.getVisible();
    
    if (layer.getLayers) {
      // 👉 Es ist eine Gruppe: Wir gehen tiefer und geben den Titel weiter
      layers = layers.concat(getAllLayers(layer, isVisible, currentTitle));
    } else {
      // 👉 Es ist ein echter Layer: Wir speichern den Titel seiner Gruppe mit ab
      layers.push({
        layer: layer,
        visible: isVisible,
        groupTitle: currentTitle // 👈 Hier speichern wir den Gruppennamen
      });
    }
  });

  return layers;
}
export function initMapClick(map) {

  map.on('singleclick', function (evt) {
    
    if (!isTableEnabled()) return;
    const promises = [];
    const viewResolution = map.getView().getResolution();
    currentClickResults = {};
    const allLayers = getAllLayers(map);
    allLayers.forEach(obj => {
      const layer = obj.layer;
      if (obj.visible && layer.getSource()?.getFeatureInfoUrl) {
        const name = layer.get('name');
        
        const url = layer.getSource().getFeatureInfoUrl(
          evt.coordinate,
          viewResolution,
          'EPSG:3857',
          {
            'INFO_FORMAT': 'text/xml',
            'QUERY_LAYERS': layer.getSource().getParams().LAYERS,
            'LAYERS': layer.getSource().getParams().LAYERS
          }
        );
        if (url) {
          promises.push(
            fetch(url)
              .then(res => res.text())
              .then(xml => {
                const data = parseArcGISXml(xml, name);
                if (data.length > 0) currentClickResults[name] = data;
              })
          );
        }
      }
    });

    Promise.all(promises).then(() => {
    // 👉 Vector-Daten hinzufügen
    const vectorResults = getVectorFeaturesAtClick(map, evt);
    // 👉 zusammenführen
    Object.keys(vectorResults).forEach(layerName => {
      currentClickResults[layerName] = vectorResults[layerName];
    });
    const layerNames = Object.keys(currentClickResults);
    if (layerNames.length > 0) {
      if (isTableEnabled()) {
        updateSelector(layerNames);
        showTableDebounced(currentClickResults[layerNames[0]]);  
      }
    } else {
      if (isTableEnabled()) {
        //closeTable();
      }
    }
  });
});
}

export function parseArcGISXml(xmlString, layerName) {

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, "text/xml");
  const featureNodes = xmlDoc.getElementsByTagName("FIELDS");

  const data = [];

  for (let i = 0; i < featureNodes.length; i++) {

    const attributes = featureNodes[i].attributes;

    let row = { "Ebene": layerName };

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

  map.forEachFeatureAtPixel(evt.pixel, function(feature, layer) {

    const layerName = layer?.get('name') || 'Vector';

    if (!results[layerName]) {
      results[layerName] = [];
    }

    const props = feature.getProperties();

    // Geometry entfernen (sonst Müll in Tabelle)
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
  
  const allowedGroups = ['Bauw.(L)', 'Bauw.(P)']; // 👈 Deine Zielgruppen

  allLayers.forEach(obj => {
    const { layer, visible, groupTitle } = obj;
    
    // 1. Sichtbarkeit prüfen
    if (!visible) return;
    
    // 2. Filter: Nur Layer aus den spezifischen Gruppen berücksichtigen
    if (!groupTitle || !allowedGroups.includes(groupTitle)) return;

    const name = layer.get('name');
    const source = typeof layer.getSource === 'function' ? layer.getSource() : null;
    
    if (!source || typeof source.getFeaturesInExtent !== 'function') return;

    const features = source.getFeaturesInExtent(extent);
    if (features.length === 0) return;

    results[name || 'Unbenannter Layer'] = features.map(f => {
      const props = { ...f.getProperties() };
      delete props.geometry; // 👈 Bereinigen
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
    // 1. Selector-Element holen
    const selector = document.getElementById('layer-selector');
    
    // 2. Den aktuell gewählten Layer VOR dem Update merken
    const currentSelection = selector ? selector.value : null;

    // 3. Die Liste im Dropdown aktualisieren (deine updateSelector Funktion)
    updateSelector(layerNames);

    // 4. Prüfen, welcher Layer jetzt angezeigt werden soll
    // Priorität: 
    // a) Die bisherige Auswahl (falls sie in den neuen Ergebnissen noch da ist)
    // b) Der erste Layer in der neuen Liste (als Fallback)
    let layerToShow = layerNames[0]; 
    
    if (currentSelection && results[currentSelection]) {
      layerToShow = currentSelection;
    }

    // 5. Tabelle mit dem richtigen Layer-Datensatz füttern
    showTableDebounced(results[layerToShow]);

  } else {
    closeTable();
  }
}
