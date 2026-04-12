// js/mapEvents.js

import { updateSelector, showTableDebounced, closeTable } from './table.js';
import { isTableEnabled } from './controls.js';


let currentClickResults = {};
let latestClickRequestId = 0;

export function getAllLayers(layerGroup, parentVisible = true, groupTitle = null) {
  let layers = [];

  const currentTitle = layerGroup.get('title') || groupTitle;

  layerGroup.getLayers().forEach((layer) => {
    const isVisible = parentVisible && layer.getVisible();

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

export function initMapClick(map) {
  map.on('singleclick', function (evt) {
    const requestId = ++latestClickRequestId;

    if (!isTableEnabled()) return;

    const promises = [];
    const viewResolution = map.getView().getResolution();
    currentClickResults = {};
    const allLayers = getAllLayers(map);

    allLayers.forEach((obj) => {
      const layer = obj.layer;
      if (obj.visible && layer.getSource()?.getFeatureInfoUrl) {
        const name = layer.get('name');

        const url = layer.getSource().getFeatureInfoUrl(
          evt.coordinate,
          viewResolution,
          'EPSG:3857',
          {
            INFO_FORMAT: 'text/xml',
            QUERY_LAYERS: layer.getSource().getParams().LAYERS,
            LAYERS: layer.getSource().getParams().LAYERS,
          }
        );

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

    if (!visible) return;
    if (!groupTitle || !allowedGroups.includes(groupTitle)) return;

    const name = layer.get('name');
    //console.log ('name');
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

