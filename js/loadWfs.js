
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import { bbox as bboxStrategy } from 'ol/loadingstrategy';
import Style from 'ol/style/Style';
import Fill from 'ol/style/Fill';
import Stroke from 'ol/style/Stroke';
import Circle from 'ol/style/Circle'; // 💡 NEU: Für die Punktdarstellung importieren
import WFS from 'ol/format/WFS'; // 💡 WICHTIG: Oben aus OpenLayers importieren!
import GML32 from 'ol/format/GML32';
import { transformExtent } from 'ol/proj';

const wfsMetadata = new Map();


export async function loadWFSCapabilities(baseUrl) {
  const cleanUrl = baseUrl.split('?')[0];
  const parsedUrl = new URL(cleanUrl);
  
  // Prüfe, ob die URL von inspire.niedersachsen.de kommt → verwende Vite Proxy
  let wfsUrl = cleanUrl + '?service=WFS&request=GetCapabilities';
  if (parsedUrl.hostname.endsWith('inspire.niedersachsen.de')) {
    wfsUrl = `/wfs-proxy${parsedUrl.pathname}?service=WFS&request=GetCapabilities`;
  }

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
    const getFeatureOperation = [...xml.getElementsByTagNameNS("*", "Operation")]
      .find(operation => operation.getAttribute('name') === 'GetFeature');
    const outputFormats = getFeatureOperation
      ? [...getFeatureOperation.getElementsByTagNameNS("*", "Value")]
        .map(node => node.textContent.trim())
      : [];
    const wfsLayers = [];
    
    for (let i = 0; i < featureTypes.length; i++) {
      const nameNode = featureTypes[i].getElementsByTagNameNS("*", "Name")[0];
      const titleNode = featureTypes[i].getElementsByTagNameNS("*", "Title")[0];
      
      const name = nameNode?.textContent?.trim();
      const title = titleNode?.textContent?.trim();
      const crsNodes = [
        ...featureTypes[i].getElementsByTagNameNS("*", "DefaultCRS"),
        ...featureTypes[i].getElementsByTagNameNS("*", "DefaultSRS"),
        ...featureTypes[i].getElementsByTagNameNS("*", "OtherCRS"),
        ...featureTypes[i].getElementsByTagNameNS("*", "OtherSRS")
      ];
      const crs = crsNodes.map(node => node.textContent.trim());
      
      if (name) {
        wfsLayers.push({ name, title: title || name, crs, outputFormats });
      }
    }

    wfsMetadata.set(cleanUrl, {
      outputFormats,
      layers: Object.fromEntries(wfsLayers.map(layer => [layer.name, layer]))
    });
    
    console.log(`✅ ${wfsLayers.length} WFS-Layer geladen`);
    return wfsLayers;

  } catch (error) {
    console.error("❌ Fehler beim Laden der WFS Capabilities:", error.message);
    throw error;
  }
}
export function loadWFSLayer(map, baseUrl, typeName) {
  const layer = createWFSLayer(baseUrl, typeName);
  map.addLayer(layer);
  const vectorSource = layer.getSource();

  // Fehlerüberwachung
  vectorSource.on('featuresloadend', function(evt) {
    console.log(`✅ ${evt.features.length} Features für ${typeName} geladen`);
  });

  vectorSource.on('featuresloaderror', function() {
    console.error(`❌ Fehler beim Laden der WFS-Features für ${typeName}`);
  });

  return layer;
}

export function createWFSLayer(baseUrl, typeName, serviceConfig = {}) {
  const cleanUrl = baseUrl.split('?')[0];
  const parsedUrl = new URL(cleanUrl);
  const layerInfo = wfsMetadata.get(cleanUrl)?.layers?.[typeName];
  const supportedCrs = layerInfo?.crs || [];
  const srsCode = serviceConfig.srsName
    ? serviceConfig.srsName.match(/(\d+)$/)?.[1]
    : null;
  const selectedSrsCode = srsCode || ['25832', '3857', '4326'].find(code =>
    supportedCrs.some(crs => crs.endsWith(`:${code}`))
  ) || '4326';
  const srsUrn = serviceConfig.srsName || `urn:ogc:def:crs:EPSG::${selectedSrsCode}`;
  const outputFormat = serviceConfig.outputFormat || wfsMetadata.get(cleanUrl)?.outputFormats
    .find(format => format === 'application/gml+xml; version=3.2')
    || wfsMetadata.get(cleanUrl)?.outputFormats
      .find(format => format.includes('gml/3.2.1'))
    || 'application/gml+xml; version=3.2';
  const format = new WFS({
    version: '2.0.0',
    gmlFormat: new GML32()
  });
  const readFeatures = format.readFeatures.bind(format);
  format.readFeatures = (source, options = {}) => readFeatures(source, {
    ...options,
    dataProjection: `EPSG:${selectedSrsCode}`
  });

  const vectorSource = new VectorSource({
    format,
    url: function (extent, resolution, projection) {
      const requestExtent = selectedSrsCode === '3857'
        ? extent
        : transformExtent(extent, projection, `EPSG:${selectedSrsCode}`);
      const bboxValues = selectedSrsCode === '4326'
        ? [requestExtent[1], requestExtent[0], requestExtent[3], requestExtent[2]]
        : requestExtent;
      // Prüfe, ob die URL von inspire.niedersachsen.de kommt → verwende Vite Proxy
      let baseUrlForRequest = cleanUrl;
      if (parsedUrl.hostname.endsWith('inspire.niedersachsen.de')) {
        baseUrlForRequest = `/wfs-proxy${parsedUrl.pathname}`;
      }

      // Direkter Zugriff - BfN-Server unterstützt CORS
      return (
        `${baseUrlForRequest}?service=WFS` +
        `&version=2.0.0` +
        `&request=GetFeature` +
        `&typeNames=${encodeURIComponent(typeName)}` +
        `&outputFormat=${encodeURIComponent(outputFormat)}` +
        `&count=100` +
        `&srsName=${encodeURIComponent(srsUrn)}` +
        `&bbox=${encodeURIComponent(`${bboxValues.join(',')},${srsUrn}`)}`
      );
    },
    strategy: bboxStrategy
  });

  const layer = new VectorLayer({
    source: vectorSource,
    properties: {
      title: serviceConfig.title || typeName,
      serviceConfig: {
        type: 'WFS',
        url: cleanUrl,
        typeName,
        version: serviceConfig.version || '2.0.0',
        outputFormat,
        srsName: srsUrn
      }
    },
    style: (feature) => {
      const geometryType = feature.getGeometry()?.getType();
      const isPoint = geometryType === 'Point' || geometryType === 'MultiPoint';

      return new Style({
        image: isPoint
          ? new Circle({
              radius: 6,
              fill: new Fill({ color: '#0078d4' }),
              stroke: new Stroke({ color: '#ffffff', width: 1.5 })
            })
          : undefined,
        stroke: new Stroke({ color: '#0078d4', width: 2 }),
        fill: new Fill({ color: 'rgba(0, 120, 212, 0.15)' })
      });
    }
  });

  return layer;
}

function getArcGISServiceUrl(serviceUrl) {
  const cleanUrl = serviceUrl.split('?')[0].replace(/\/+$/, '');
  const match = cleanUrl.match(/^(.*\/(?:FeatureServer|MapServer))(?:\/\d+)?$/i);

  if (!match) {
    throw new Error('Bitte eine ArcGIS FeatureServer- oder MapServer-URL eingeben.');
  }

  return match[1];
}

export function isArcGISRestUrl(serviceUrl) {
  return /\/(?:FeatureServer|MapServer)(?:\/\d+)?\/?$/i.test(serviceUrl.split('?')[0]);
}

// Lädt Layer-Metadaten von ArcGIS FeatureServern und MapServern.
export async function loadArcGISCapabilities(serviceUrl) {
  const cleanUrl = serviceUrl.split('?')[0].replace(/\/+$/, '');
  const requestedLayerId = cleanUrl.match(/\/(?:FeatureServer|MapServer)\/(\d+)$/i)?.[1];
  const serviceRoot = getArcGISServiceUrl(serviceUrl);
  const metadataUrl = requestedLayerId
    ? `${cleanUrl}?f=json`
    : `${serviceRoot}?f=json`;
  const response = await fetch(metadataUrl);
  if (!response.ok) throw new Error('ArcGIS Server antwortet nicht');
  
  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message || 'ArcGIS Server hat einen Fehler zurückgegeben.');
  }

  const layers = requestedLayerId
    ? [data]
    : data.layers || [];

  return layers
    .filter(layer => layer.geometryType)
    .map(layer => ({
      id: layer.id,
      name: layer.name,
      title: layer.name
    }));
}

export function loadArcGISLayer(map, serviceUrl, layerId, layerName) {
  const baseUrl = `${getArcGISServiceUrl(serviceUrl)}/${layerId}/query`;

  const source = new VectorSource({
    format: new GeoJSON({ dataProjection: 'EPSG:3857' }),
    // 💡 OpenLayers baut die URL bei jedem Verschieben/Zoomen dynamisch zusammen:
    url: function (extent, resolution, projection) {
      // ArcGIS erwartet das Extent im Format: xmin,ymin,xmax,ymax
      const bbox = extent.join(',');
      
      return `${baseUrl}?where=1%3D1` +
             `&outFields=*` +
             `&returnGeometry=true` +
             `&geometry=${bbox}` +           // Nur Objekte in diesem Ausschnitt
             `&geometryType=esriGeometryEnvelope` +
             `&inSR=3857` +                  // Projektion des Ausschnitts (Web Mercator)
             `&outSR=3857` +
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
    title: layerName || technischerName,
    name: technischerName, // 💡 Technischer Name für die spätere Identifikation
    serviceConfig: {
      type: 'ArcGIS REST',
      url: getArcGISServiceUrl(serviceUrl),
      layerId
    },
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
    console.log(`Es befinden sich aktuell ${source.getFeatures().length} Datensätze im Speicher.`);
  });

  return layer;
}

export function exportServiceLayerAsGeoJSON(map, layer) {
  const source = layer.getSource();
  const features = source?.getFeatures();

  if (!features?.length) {
    throw new Error('Für diesen Layer sind noch keine Features geladen.');
  }

  const geoJson = new GeoJSON().writeFeatures(features, {
    featureProjection: map.getView().getProjection(),
    dataProjection: 'EPSG:4326'
  });
  const blob = new Blob([geoJson], { type: 'application/geo+json' });
  const url = URL.createObjectURL(blob);
  const fileName = (layer.get('title') || layer.get('name') || 'dienst-layer')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'dienst-layer';
  const link = document.createElement('a');

  link.href = url;
  link.download = `${fileName}.geojson`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);

  return features.length;
}