
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import { bbox as bboxStrategy } from 'ol/loadingstrategy';
import Style from 'ol/style/Style';
import Fill from 'ol/style/Fill';
import Stroke from 'ol/style/Stroke';

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
      // OpenLayers generiert hier automatisch die BoundingBox für den aktuellen Ausschnitt
      return (
        `${cleanUrl}?service=WFS` +
        `&version=1.1.0` +
        `&request=GetFeature` +
        `&typeName=${typeName}` +
        `&outputFormat=application/json` +
        `&srsname=EPSG:3857` +
        `&bbox=${extent.join(',')},EPSG:3857` // 💡 Wichtig für die BBox-Strategie!
      );
    },
    strategy: bboxStrategy
  });

  const layer = new VectorLayer({
    source: vectorSource,
    properties: { title: typeName }, // Nutzen wir für spätere Identifikationen
    style: new Style({
      stroke: new Stroke({
        color: '#0078d4',
        width: 2
      }),
      fill: new Fill({
        color: 'rgba(0, 120, 212, 0.15)'
      })
    })
  });

  map.addLayer(layer);

  // Sobald die ersten Features geladen sind, zoomen wir darauf
  const key = vectorSource.on('change', function () {
    if (vectorSource.getState() === 'ready') {
      const extent = vectorSource.getExtent();
      // Verhindern, dass bei leerem Extent gecrasht wird
      if (extent && extent[0] !== Infinity) {
        map.getView().fit(extent, {
          duration: 1000,
          padding: [50, 50, 50, 50]
        });
        // Event-Listener direkt wieder entfernen, damit es nicht bei jedem Verschieben zoomt!
        vectorSource.un('change', key); 
      }
    }
  });

  console.log("WFS geladen:", typeName);
}