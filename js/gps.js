import { circular } from 'ol/geom/Polygon';
import { Vector as VectorSource } from 'ol/source.js';
import { Vector as VectorLayer } from 'ol/layer.js';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { Fill, Stroke, Style, Circle as CircleStyle } from 'ol/style.js';
import * as proj from 'ol/proj';

const gpsSource = new VectorSource();

const gpsPointStyle = new Style({
  image: new CircleStyle({
    radius: 8,
    fill: new Fill({
      color: 'red',
    }),
    stroke: new Stroke({
      color: 'black',
      width: 2,
    }),
  }),
});

const gpsAccuracyStyle = new Style({
  fill: new Fill({
    color: 'rgba(255, 0, 0, 0.12)',
  }),
  stroke: new Stroke({
    color: 'rgba(255, 0, 0, 0.35)',
    width: 1,
  }),
});

let gpsLayer = null;
let watchId = null;
let isFirstZoom = true;
let activeMap = null;

function getGpsLayer() {
  if (!gpsLayer) {
    gpsLayer = new VectorLayer({
      displayInLayerSwitcher: true,
      source: gpsSource,
      title: 'gps_Layer',
      name: 'gps_Layer',
      zIndex: 9999,
      style: (feature) => {
        return feature.get('kind') === 'position' ? gpsPointStyle : gpsAccuracyStyle;
      },
    });
  }

  return gpsLayer;
}

export function isGpsTrackingActive() {
  return watchId !== null;
}

export function startGpsTracking(map, handlers = {}) {
  const { onUnavailable, onError } = handlers;

  if (watchId !== null) return true;

  if (!navigator.geolocation) {
    if (onUnavailable) onUnavailable();
    return false;
  }

  activeMap = map;
  const layer = getGpsLayer();
  if (!map.getLayers().getArray().includes(layer)) {
    map.addLayer(layer);
  }

  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const coords = [pos.coords.longitude, pos.coords.latitude];
      const accuracyGeometry = circular(coords, pos.coords.accuracy)
        .transform('EPSG:4326', map.getView().getProjection());

      const accuracyFeature = new Feature(accuracyGeometry);
      accuracyFeature.set('kind', 'accuracy');

      const pointFeature = new Feature(new Point(proj.fromLonLat(coords)));
      pointFeature.set('kind', 'position');

      gpsSource.clear(true);
      gpsSource.addFeatures([accuracyFeature, pointFeature]);

      if (isFirstZoom) {
        map.getView().fit(gpsSource.getExtent(), {
          maxZoom: 13,
          duration: 500,
        });
        isFirstZoom = false;
      }
    },
    (error) => {
      if (onError) onError(error);
    },
    {
      enableHighAccuracy: true,
    }
  );

  return true;
}

export function stopGpsTracking() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }

  isFirstZoom = true;
  gpsSource.clear(true);

  if (gpsLayer && activeMap) {
    activeMap.removeLayer(gpsLayer);
  }

  activeMap = null;
}
