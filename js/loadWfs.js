
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import { bbox as bboxStrategy } from 'ol/loadingstrategy';
import Style from 'ol/style/Style';
import Fill from 'ol/style/Fill';
import Stroke from 'ol/style/Stroke';
import Circle from 'ol/style/Circle'; // 💡 NEU: Für die Punktdarstellung importieren

/**
 * Holt die Layer-Liste vom WFS-Server
 */
export async function loadWFSCapabilities(baseUrl) {
  // Sicherstellen, dass keine alten Parameter stören
  const cleanUrl = baseUrl.split('?')[0]; 
  const url = `${cleanUrl}?service=WFS&request=GetCapabilities`;
  
  const response = await fetch(url);
  if (!response.ok) throw new Error("Server antwortet nicht");
  
  const text = await response.text();
  const parser = new DOMParser();
  const xml = parser.parseFromString(text, "text/xml");
  const featureTypes = xml.getElementsByTagName("FeatureType");
  const wfsLayers = [];
  
  for (let i = 0; i < featureTypes.length; i++) {
    const name = featureTypes[i].getElementsByTagName("Name")[0]?.textContent;
    const title = featureTypes[i].getElementsByTagName("Title")[0]?.textContent;
    if (name) {
      wfsLayers.push({ name, title: title || name });
    }
  }
  return wfsLayers;
}

/**
 * Lädt den ausgewählten Layer und fügt ihn der Karte hinzu
 */
export function loadWFSLayer(map, baseUrl, typeName) {
  const cleanUrl = baseUrl.split('?')[0];

  const vectorSource = new VectorSource({
    format: new GeoJSON(),
    url: function (extent, resolution, projection) {
      // 💡 ArcGIS Server verlangen bei WFS 1.1.0 oft den vollen URN-Pfad,
      // sonst schlägt die Transformation serverseitig fehl!
      const srsUrn = 'urn:ogc:def:crs:EPSG::3857';

      return (
        `${cleanUrl}?service=WFS` +
        `&version=1.1.0` +
        `&request=GetFeature` +
        `&typeName=${typeName}` +
        `&outputFormat=application/json` +
        `&srsname=${srsUrn}` +
        `&bbox=${extent.join(',')},${srsUrn}` // BBox muss denselben URN nutzen!
      );
    },
    strategy: bboxStrategy
  });

  const layer = new VectorLayer({
    source: vectorSource,
    properties: { title: typeName },
    style: new Style({
      stroke: new Stroke({
        color: '#0078d4',
        width: 2
      }),
      fill: new Fill({
        color: 'rgba(0, 120, 212, 0.15)'
      }),
      image: new Circle({
        radius: 8,
        fill: new Fill({
          color: '#005697'
        }),
        stroke: new Stroke({
          color: '#ffffff',
          width: 2
        })
      })
    })
  });

  map.addLayer(layer);

  // Sobald Features geladen sind, zoomen
 
 /*  const key = vectorSource.on('change', function () {
    if (vectorSource.getState() === 'ready') {
      const extent = vectorSource.getExtent();
      if (extent && extent[0] !== Infinity && extent[0] !== -Infinity) {
        map.getView().fit(extent, {
          duration: 1000,
          padding: [50, 50, 50, 50]
        });
        vectorSource.un('change', key); // Nur einmalig zoomen
      }
    }
  });
 */
  console.log("WFS geladen mit URN-Fix:", typeName);
}