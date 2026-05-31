
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

// 💡 NEU: Holt die Liste aller Layer des ArcGIS FeatureServers
export async function loadArcGISCapabilities(serviceUrl) {
  // f=json an die Basis-URL anhängen
  const response = await fetch(`${serviceUrl.replace(/\/$/, '')}?f=json`);
  if (!response.ok) throw new Error('ArcGIS Server antwortet nicht');
  
  const data = await response.json();
  
  // Falls der Server Fehler liefert oder keine Layer hat
  if (!data.layers) return [];

  // Wir mappen die ArcGIS-Struktur auf das gleiche Format wie beim WFS
  return data.layers.map(l => ({
    id: l.id,       // z.B. 0, 1, 2
    name: l.name,   // Technischer Name / Anzeige-Name
    title: l.name   // Für die Button-Beschriftung
  }));
}



export async function loadArcGISLayer(map, serviceUrl, layerId, layerName) {
  const baseUrl = `${serviceUrl.replace(/\/$/, '')}/${layerId}/query`;

  const source = new VectorSource({
    format: new GeoJSON(),
    // 💡 OpenLayers baut die URL bei jedem Verschieben/Zoomen dynamisch zusammen:
    url: function (extent, resolution, projection) {
      // ArcGIS erwartet das Extent im Format: xmin,ymin,xmax,ymax
      const bbox = extent.join(',');
      
      return `${baseUrl}?where=1%3D1` +
             `&outFields=*` +
             `&geometry=${bbox}` +           // Nur Objekte in diesem Ausschnitt
             `&geometryType=esriGeometryEnvelope` +
             `&inSR=3857` +                  // Projektion des Ausschnitts (Web Mercator)
             `&spatialRel=esriSpatialRelIntersects` +
             `&f=geojson`;
    },
    strategy: bboxStrategy // 💡 Lädt Daten nur für den sichtbaren Bereich!
  });
  // Saniting für den technischen Namen (Kleinschreibung, keine Leerzeichen)
  const technischerName = `arcgis_${(layerName || 'layer').toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  
  console.log(technischerName);
  const layer = new VectorLayer({ 
    source, 
    title: technischerName, // Für die Anzeige in der Layerliste
    name: technischerName, // 💡 Technischer Name für die spätere Identifikation
    style: new Style({
      stroke: new Stroke({ color: '#ff6600', width: 2 }),
      fill: new Fill({ color: 'rgba(255,102,0,0.1)' }) // Etwas transparenter, da Flurstücke groß sind
    })
  });

  map.addLayer(layer);

  // 💡 HINWEIS ZUM FIT / ZOOMEN:
  // Da wir jetzt mit BBOX arbeiten, hat die Source beim Start 0 Features, 
  // weil sie erst lädt, wenn sie auf der Karte aktiv ist. 
  // Ein map.getView().fit(extent) auf die gesamte Source funktioniert bei RIESIGEN Datensätzen 
  // ohnehin nicht flüssig. Wir loggen stattdessen die Ladevorgänge:
  
  source.on('featuresloadend', () => {
    console.log(`Es befinden sich aktuell ${source.getFeatures().length} Flurstücke im Speicher.`);
  });
}