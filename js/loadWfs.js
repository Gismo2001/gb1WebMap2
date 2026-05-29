
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import { bbox as bboxStrategy } from 'ol/loadingstrategy';
import Style from 'ol/style/Style';
import Fill from 'ol/style/Fill';
import Stroke from 'ol/style/Stroke';
import Circle from 'ol/style/Circle'; // 💡 NEU: Für die Punktdarstellung importieren
import WFS from 'ol/format/WFS'; // 💡 WICHTIG: Oben aus OpenLayers importieren!
import GML3 from 'ol/format/GML3';
/**
 * Holt die Layer-Liste vom WFS-Server
 */
/**
 * Holt die Layer-Liste vom WFS-Server (inkl. CORS-Proxy & Namespace-Sicherung)
 */
export async function loadWFSCapabilities(baseUrl) {
  const cleanUrl = baseUrl.split('?')[0]; 
  
  // 💡 Alternative zu cors-anywhere, die die Antwort in ein JSON-Objekt verpackt
  const url = `https://api.allorigins.win/get?url=${encodeURIComponent(cleanUrl + '?service=WFS&request=GetCapabilities')}`;
  
  console.log("Rufe Capabilities auf über AllOrigins Proxy...");

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Server antwortet mit Status ${response.status}`);
    
    const wrapper = await response.json(); // AllOrigins liefert ein JSON-Wrapper zurück
    const text = wrapper.contents;         // Hier drin steckt das echte XML vom LGLN-Server
    
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, "text/xml");
    
    // Ab hier bleibt deine Namespace-sichere Schleife exakt identisch:
    const featureTypes = xml.getElementsByTagNameNS("*", "FeatureType");
    const wfsLayers = [];
    
    for (let i = 0; i < featureTypes.length; i++) {
      const nameNode = featureTypes[i].getElementsByTagNameNS("*", "Name")[0];
      const titleNode = featureTypes[i].getElementsByTagNameNS("*", "Title")[0];
      
      const name = nameNode?.textContent?.trim();
      const title = titleNode?.textContent?.trim();
      
      if (name) {
        wfsLayers.push({ name, title: title || name });
      }
    }
    
    console.log(`${wfsLayers.length} Layer erfolgreich eingelesen!`);
    return wfsLayers;

  } catch (error) {
    console.error("Fehler beim Laden der WFS Capabilities:", error);
    throw error;
  }
}
export function loadWFSLayer(map, baseUrl, typeName) {
  const cleanUrl = baseUrl.split('?')[0];

  const vectorSource = new VectorSource({
    // 💡 1. ÄNDERUNG: Wir nutzen den WFS/GML-Parser statt GeoJSON
    format: new WFS({
      gmlFormat: new GML3() // ALKIS nutzt meist GML3
    }),
    url: function (extent, resolution, projection) {
      const srsUrn = 'urn:ogc:def:crs:EPSG::3857';

      // Wenn du einen CORS-Proxy brauchst (siehe vorherige Nachricht), hier davorhängen:
      const proxyUrl = ''; // z.B. 'https://cors-anywhere.herokuapp.com/'

      return (
        proxyUrl +
        `${cleanUrl}?service=WFS` +
        `&version=1.1.0` +
        `&request=GetFeature` +
        `&typeName=${typeName}` +
        // 💡 2. ÄNDERUNG: Offizielles LGLN-Format anfordern
        `&outputFormat=text/xml; subtype=gml/3.1.1` + 
        `&srsname=${srsUrn}` +
        `&bbox=${extent.join(',')},${srsUrn}`
      );
    },
    strategy: bboxStrategy
  });

  const layer = new VectorLayer({
    source: vectorSource,
    properties: { title: typeName },
    // Dein Style bleibt absolut identisch...
    style: new Style({
      stroke: new Stroke({ color: '#0078d4', width: 2 }),
      fill: new Fill({ color: 'rgba(0, 120, 212, 0.15)' })
    })
  });

  map.addLayer(layer);

  // 💡 TIPP ZUR FEHLERSUCHE: Überwache, ob Features geladen werden
  vectorSource.on('featuresloadend', function(evt) {
    console.log(`Erfolgreich ${evt.features.length} Features für ${typeName} geladen!`);
  });
  
  vectorSource.on('featuresloaderror', function(evt) {
    console.error(`Fehler beim Laden der WFS-Features für ${typeName}`);
  });
}