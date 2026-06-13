
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import { bbox as bboxStrategy } from 'ol/loadingstrategy';
import { transformExtent } from 'ol/proj';
import Style from 'ol/style/Style';
import Fill from 'ol/style/Fill';
import Stroke from 'ol/style/Stroke';
import Circle from 'ol/style/Circle'; // 💡 NEU: Für die Punktdarstellung importieren
import WFS from 'ol/format/WFS'; // 💡 WICHTIG: Oben aus OpenLayers importieren!
import GML3 from 'ol/format/GML3';

const DEFAULT_WFS_OUTPUT_FORMAT = 'text/xml; subtype=gml/3.1.1';

function proxyWfsUrl(baseUrl) {
  if (import.meta.env.DEV && typeof baseUrl === 'string') {
    return baseUrl.replace(
      /^https?:\/\/opendata\.lgln\.niedersachsen\.de\/doorman\/noauth\/verwaltungsgrenzen_wfs/,
      '/lgln-wfs'
    );
  }
  return baseUrl;
}

function normalizeWfsVersion(version) {
  if (!version) return '1.1.0';
  if (version.startsWith('2')) return '2.0.0';
  if (version.startsWith('1.1')) return '1.1.0';
  return version;
}

function getPreferredOutputFormat(layerInfo) {
  const preferredFormats = [
    'text/xml; subtype=gml/3.1.1',
    'text/xml; subtype=gml/3.2.1',
    'application/gml+xml; version=3.2',
    'text/xml; subtype=gml/2.1.2'
  ];

  if (!layerInfo?.outputFormats?.length) {
    return DEFAULT_WFS_OUTPUT_FORMAT;
  }

  for (const format of preferredFormats) {
    if (layerInfo.outputFormats.includes(format)) {
      return format;
    }
  }

  return layerInfo.outputFormats[0] || DEFAULT_WFS_OUTPUT_FORMAT;
}

function getSrsName(projection) {
  const code = typeof projection === 'string' ? projection : projection?.getCode?.();
  if (!code) return 'urn:ogc:def:crs:EPSG::3857';
  const match = code.match(/^EPSG:(\d+)$/i);
  if (match) {
    return `urn:ogc:def:crs:EPSG::${match[1]}`;
  }
  return code;
}

function buildWFSGetFeatureUrl(cleanUrl, version, typeName, extent, projection, outputFormat) {
  const normalizedVersion = normalizeWfsVersion(version);
  const typeParamName = normalizedVersion === '2.0.0' ? 'typeNames' : 'typeName';
  const srsName = getSrsName(projection);
  const bboxString = normalizedVersion === '2.0.0'
    ? extent.join(',')
    : `${extent.join(',')},${srsName}`;

  const params = {
    service: 'WFS',
    version: normalizedVersion,
    request: 'GetFeature',
    [typeParamName]: typeName,
    outputFormat,
    srsName,
    bbox: bboxString
  };

  if (normalizedVersion === '2.0.0') {
    params.count = '1000';
  } else {
    params.maxFeatures = '1000';
  }

  return `${cleanUrl}?${Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')}`;
}

export async function loadWFSCapabilities(baseUrl) {
  const cleanUrl = proxyWfsUrl(baseUrl).split('?')[0]; 
  const wfsUrl = cleanUrl + '?service=WFS&request=GetCapabilities';

  try {
    const response = await fetch(wfsUrl);
    
    if (!response.ok) {
      throw new Error(`Server antwortet mit Status ${response.status}`);
    }
    
    const text = await response.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, "text/xml");
    
    // Parse-Fehler prüfen
    if (xml.getElementsByTagName("parsererror").length > 0) {
      throw new Error("XML Parse-Fehler: Server hat keine gültigen WFS-Daten gesendet");
    }
    
    // FeatureType-Elemente auslesen
    const featureTypes = xml.getElementsByTagNameNS("*", "FeatureType");
    const wfsLayers = [];
    
    for (let i = 0; i < featureTypes.length; i++) {
      const nameNode = featureTypes[i].getElementsByTagNameNS("*", "Name")[0];
      const titleNode = featureTypes[i].getElementsByTagNameNS("*", "Title")[0];
      
      const name = nameNode?.textContent?.trim();
      const title = titleNode?.textContent?.trim();

      let bboxWgs84;
      const bboxNode = featureTypes[i].getElementsByTagNameNS("*", "WGS84BoundingBox")[0];
      if (bboxNode) {
        const lowerCorner = bboxNode.getElementsByTagNameNS("*", "LowerCorner")[0]?.textContent?.trim();
        const upperCorner = bboxNode.getElementsByTagNameNS("*", "UpperCorner")[0]?.textContent?.trim();
        if (lowerCorner && upperCorner) {
          const lower = lowerCorner.split(/\s+/).map(Number);
          const upper = upperCorner.split(/\s+/).map(Number);
          if (lower.length === 2 && upper.length === 2 && lower.every(n => !Number.isNaN(n)) && upper.every(n => !Number.isNaN(n))) {
            bboxWgs84 = [lower[0], lower[1], upper[0], upper[1]];
          }
        }
      }

      const defaultCrs = featureTypes[i].getElementsByTagNameNS("*", "DefaultCRS")[0]?.textContent?.trim();
      const otherCrs = Array.from(featureTypes[i].getElementsByTagNameNS("*", "OtherCRS")).map(node => node.textContent?.trim()).filter(Boolean);
      const outputFormats = Array.from(featureTypes[i].getElementsByTagNameNS("*", "OutputFormats")[0]?.getElementsByTagNameNS("*", "Format") ?? []).map(node => node.textContent?.trim()).filter(Boolean);
      
      if (name) {
        wfsLayers.push({
          name,
          title: title || name,
          bboxWgs84,
          defaultCrs,
          otherCrs,
          outputFormats,
          wfsVersion: normalizeWfsVersion(xml.documentElement?.getAttribute('version'))
        });
      }
    }
    
    console.log(`✅ ${wfsLayers.length} WFS-Layer geladen`);
    return wfsLayers;

  } catch (error) {
    console.error("❌ Fehler beim Laden der WFS Capabilities:", error.message);
    throw error;
  }
}
export function loadWFSLayer(map, baseUrl, layerInfo) {
  const cleanUrl = proxyWfsUrl(baseUrl).split('?')[0];
  const typeName = typeof layerInfo === 'object' && layerInfo !== null ? layerInfo.name : layerInfo;
  const bboxWgs84 = typeof layerInfo === 'object' && layerInfo !== null ? layerInfo.bboxWgs84 : undefined;
  const wfsVersion = normalizeWfsVersion(typeof layerInfo === 'object' && layerInfo !== null ? layerInfo.wfsVersion : undefined);
  const outputFormat = getPreferredOutputFormat(layerInfo);

  const vectorSource = new VectorSource({
    format: new WFS({
      gmlFormat: new GML3()
    }),
    url: function (extent, resolution, projection) {
      const url = buildWFSGetFeatureUrl(cleanUrl, wfsVersion, typeName, extent, projection, outputFormat);
      console.debug('WFS GetFeature URL:', url);
      return url;
    },
    strategy: bboxStrategy
  });

  const layer = new VectorLayer({
    source: vectorSource,
    properties: { title: typeName },
    style: new Style({
      stroke: new Stroke({ color: '#0078d4', width: 2 }),
      fill: new Fill({ color: 'rgba(0, 120, 212, 0.15)' })
    })
  });

  map.addLayer(layer);

  if (bboxWgs84 && Array.isArray(bboxWgs84) && bboxWgs84.length === 4) {
    try {
      const fitExtent = transformExtent(bboxWgs84, 'EPSG:4326', map.getView().getProjection());
      map.getView().fit(fitExtent, { padding: [50, 50, 50, 50], duration: 700 });
    } catch (err) {
      console.warn('WFS-Layer-BoundingBox konnte nicht transformiert werden:', err);
    }
  }

  // Fehlerüberwachung
  vectorSource.on('featuresloadend', function(evt) {
    console.log(`✅ ${evt.features.length} Features für ${typeName} geladen`);
    if (evt.features.length > 0) {
      const extent = vectorSource.getExtent();
      if (extent && extent.some(v => !Number.isNaN(v))) {
        map.getView().fit(extent, { padding: [50, 50, 50, 50], duration: 700 });
      }
    }
  });
  
  vectorSource.on('featuresloaderror', function(evt) {
    console.error(`❌ Fehler beim Laden der WFS-Features für ${typeName}`, evt);
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