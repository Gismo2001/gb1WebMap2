import Group from 'ol/layer/Group';
import ImageLayer from 'ol/layer/Image';
import TileLayer from 'ol/layer/Tile';
import ImageWMS from 'ol/source/ImageWMS';
import TileWMS from 'ol/source/TileWMS';
import { transform } from 'ol/proj';
import { createWFSLayer } from './loadWfs.js';

function getLayerSourceConfig(layer) {
  const serviceConfig = layer.get('serviceConfig');
  if (serviceConfig && serviceConfig.type === 'WFS') {
    return { ...serviceConfig };
  }

  const source = typeof layer.getSource === 'function' ? layer.getSource() : null;
  if (!source) return null;

  const hasWmsParams = typeof source.getParams === 'function';
  const hasWmsUrl = typeof source.getUrls === 'function' || typeof source.getUrl === 'function';

  if (hasWmsParams && hasWmsUrl) {
    const urls = typeof source.getUrls === 'function'
      ? source.getUrls()
      : [source.getUrl()];

    return {
      type: 'WMS',
      sourceClass: source.constructor && source.constructor.name,
      urls: (urls || []).filter(url => typeof url === 'string'),
      params: { ...source.getParams() }
    };
  }

  return {
    type: source.constructor && source.constructor.name
      ? source.constructor.name
      : 'unknown'
  };
}

function getLayerProperties(layer) {
  const properties = {};
  ['name', 'displayInLayerSwitcher'].forEach(propertyName => {
    const value = layer.get(propertyName);
    if (value !== undefined) properties[propertyName] = value;
  });
  return properties;
}

function serializeLayer(layer) {
  if (layer.get('displayInLayerSwitcher') === false) return null;

  const isGroup = typeof layer.getLayers === 'function';
  const serializedLayer = {
    type: isGroup ? 'group' : 'layer',
    title: layer.get('title') || layer.get('name') || 'Unbenannt',
    visible: layer.getVisible(),
    opacity: layer.getOpacity(),
    properties: getLayerProperties(layer)
  };

  const extent = layer.getExtent();
  if (extent) serializedLayer.extent = extent;

  if (isGroup) {
    serializedLayer.combine = layer.get('combine');
    serializedLayer.layers = layer.getLayers().getArray()
      .map(serializeLayer)
      .filter(Boolean);
  } else {
    serializedLayer.layerClass = layer.constructor && layer.constructor.name
      ? layer.constructor.name
      : 'unknown';
    serializedLayer.source = getLayerSourceConfig(layer);
  }

  return serializedLayer;
}

export function createLayerSwitcherConfig(map) {
  if (!map || typeof map.getLayerGroup !== 'function') {
    throw new TypeError('Zum Exportieren wird eine gültige OpenLayers-Karte benötigt.');
  }

  return {
    format: 'gb1-webmap-layer-switcher-config',
    version: 1,
    exportedAt: new Date().toISOString(),
    view: {
      projection: map.getView().getProjection().getCode(),
      center: map.getView().getCenter(),
      zoom: map.getView().getZoom()
    },
    layers: map.getLayerGroup().getLayers().getArray()
      .map(serializeLayer)
      .filter(Boolean)
  };
}

export function downloadLayerSwitcherConfig(map) {
  const config = createLayerSwitcherConfig(map);
  const json = JSON.stringify(config, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const objectUrl = URL.createObjectURL(blob);
  const downloadLink = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);

  downloadLink.href = objectUrl;
  downloadLink.download = `layer-switcher-config-${date}.json`;
  downloadLink.style.display = 'none';
  document.body.appendChild(downloadLink);

  try {
    downloadLink.click();
  } finally {
    downloadLink.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  }

  return config;
}

function isValidLayerConfig(config) {
  return config &&
    config.format === 'gb1-webmap-layer-switcher-config' &&
    config.version === 1 &&
    Array.isArray(config.layers);
}

function getLayerIdentity(layer) {
  const properties = layer.getProperties();
  return `${properties.title || ''}\u0000${properties.name || ''}`;
}

function getConfigIdentity(config) {
  const properties = config.properties || {};
  return `${config.title || ''}\u0000${properties.name || ''}`;
}

function collectExistingLayers(layerGroup, entries = []) {
  layerGroup.getLayers().forEach(layer => {
    entries.push(layer);
    if (typeof layer.getLayers === 'function') {
      collectExistingLayers(layer, entries);
    }
  });
  return entries;
}

function collectHiddenLayers(layerGroup, entries = []) {
  layerGroup.getLayers().forEach(layer => {
    if (layer.get('displayInLayerSwitcher') === false) {
      entries.push(layer);
    } else if (typeof layer.getLayers === 'function') {
      collectHiddenLayers(layer, entries);
    }
  });
  return entries;
}

function createWmsLayer(config) {
  const sourceConfig = config.source;
  const urls = Array.isArray(sourceConfig.urls) ? sourceConfig.urls : [];
  if (!urls.length || !sourceConfig.params || typeof sourceConfig.params !== 'object') {
    throw new Error(`Die WMS-Konfiguration für "${config.title}" ist unvollständig.`);
  }

  const sourceOptions = { params: sourceConfig.params };
  if (sourceConfig.sourceClass === 'TileWMS' || config.layerClass === 'TileLayer') {
    sourceOptions.urls = urls;
    return new TileLayer({ source: new TileWMS(sourceOptions) });
  }

  if (urls.length > 1) {
    throw new Error(`Der WMS-Layer "${config.title}" verwendet mehrere URLs, die nicht als ImageWMS wiederhergestellt werden können.`);
  }
  sourceOptions.url = urls[0];
  return new ImageLayer({ source: new ImageWMS(sourceOptions) });
}

function createServiceLayer(config) {
  if (config.source && config.source.type === 'WMS') {
    return createWmsLayer(config);
  }

  if (config.source && config.source.type === 'WFS') {
    const service = config.source;
    if (!service.url || !service.typeName) {
      throw new Error(`Die WFS-Konfiguration für "${config.title}" ist unvollständig.`);
    }
    return createWFSLayer(service.url, service.typeName, service);
  }

  return null;
}

function applyLayerConfig(layer, config) {
  if (config.title) layer.set('title', config.title);
  Object.entries(config.properties || {}).forEach(([key, value]) => layer.set(key, value));
  if (typeof config.visible === 'boolean') layer.setVisible(config.visible);
  if (typeof config.opacity === 'number') layer.setOpacity(config.opacity);
  if (Array.isArray(config.extent) && typeof layer.setExtent === 'function') {
    layer.setExtent(config.extent);
  }
}

function restoreLayer(config, existingLayers, usedLayers) {
  if (!config || (config.type !== 'group' && config.type !== 'layer')) {
    throw new Error('Die JSON-Datei enthält einen ungültigen Layer-Eintrag.');
  }

  let layer;
  if (config.type === 'group') {
    layer = new Group();
    applyLayerConfig(layer, config);
    if (config.combine !== undefined) layer.set('combine', config.combine);

    if (!Array.isArray(config.layers)) {
      throw new Error(`Die Gruppe "${config.title}" enthält keine gültige Layerliste.`);
    }
    const restoredChildren = config.layers
      .map(child => restoreLayer(child, existingLayers, usedLayers))
      .filter(layer => layer !== null);
    layer.getLayers().clear();
    layer.getLayers().extend(restoredChildren);
    return layer;
  }

  layer = createServiceLayer(config);
  if (!layer) {
    const identity = getConfigIdentity(config);
    layer = existingLayers.find(candidate =>
      !usedLayers.has(candidate) &&
      typeof candidate.getLayers !== 'function' &&
      getLayerIdentity(candidate) === identity
    );
    if (!layer) {
      return null;
    }
  }

  usedLayers.add(layer);
  applyLayerConfig(layer, config);
  return layer;
}

export function restoreLayerSwitcherConfig(map, config) {
  if (!map || typeof map.getLayerGroup !== 'function') {
    throw new TypeError('Zum Wiederherstellen wird eine gültige OpenLayers-Karte benötigt.');
  }
  if (!isValidLayerConfig(config)) {
    throw new Error('Die ausgewählte Datei ist keine gültige Layerswitcher-Konfiguration (Version 1).');
  }

  const root = map.getLayerGroup();
  const existingLayers = collectExistingLayers(root);
  const hiddenLayers = collectHiddenLayers(root);
  const usedLayers = new Set([root]);
  const restoredLayers = config.layers
    .map(layer => restoreLayer(layer, existingLayers, usedLayers))
    .filter(layer => layer !== null);

  root.getLayers().clear();
  root.getLayers().extend([
    ...restoredLayers,
    ...hiddenLayers.filter(layer => !usedLayers.has(layer))
  ]);

  if (config.view && Array.isArray(config.view.center) &&
      config.view.center.length >= 2 &&
      config.view.center.slice(0, 2).every(Number.isFinite) &&
      Number.isFinite(config.view.zoom)) {
    const view = map.getView();
    const center = config.view.projection &&
      config.view.projection !== view.getProjection().getCode()
      ? transform(config.view.center, config.view.projection, view.getProjection())
      : config.view.center;

    view.setCenter(center);
    view.setZoom(config.view.zoom);
  }

  map.changed();

  const layerSwitcher = map.getControls().getArray()
    .find(control =>
      typeof control.render === 'function' &&
      control.element &&
      control.element.classList.contains('ol-layerswitcher')
    );
  if (layerSwitcher) layerSwitcher.render();

  return restoredLayers.length;
}

export function selectLayerSwitcherConfigFile(map) {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';
    document.body.appendChild(input);

    const cleanup = () => input.remove();
    input.addEventListener('change', async () => {
      const [file] = input.files || [];
      cleanup();
      if (!file) {
        resolve(false);
        return;
      }

      try {
        const config = JSON.parse(await file.text());
        const restoredCount = restoreLayerSwitcherConfig(map, config);
        resolve(restoredCount);
      } catch (error) {
        reject(error);
      }
    }, { once: true });

    input.addEventListener('cancel', () => {
      cleanup();
      resolve(false);
    }, { once: true });

    input.click();
  });
}
