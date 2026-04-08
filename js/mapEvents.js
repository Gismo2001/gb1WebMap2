// js/mapEvents.js

import { updateSelector, showTable, closeTable } from './table.js';

let currentClickResults = {};

function getAllLayers(layerGroup) {
  let layers = [];

  layerGroup.getLayers().forEach(layer => {
    if (layer.getLayers) {
      // 👉 LayerGroup
      layers = layers.concat(getAllLayers(layer));
    } else {
      layers.push(layer);
    }
  });

  return layers;
}


export function initMapClick(map) {

  map.on('singleclick', function (evt) {
    const promises = [];
    const viewResolution = map.getView().getResolution();
    currentClickResults = {};
    const allLayers = getAllLayers(map);
    
    allLayers.forEach(layer => {
      if (layer.getVisible() && layer.getSource()?.getFeatureInfoUrl) {
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
                console.log(data)
                if (data.length > 0) currentClickResults[name] = data;
              })
          );
        }
      }
    });

    Promise.all(promises).then(() => {

      const layerNames = Object.keys(currentClickResults);

      if (layerNames.length > 0) {
        
        updateSelector(layerNames);
        showTable(currentClickResults[layerNames[0]]);
      } else {
        closeTable();
      }
    });

  });
}


// 👇 bleibt hier (gehört zur Datenlogik)
function parseArcGISXml(xmlString, layerName) {

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