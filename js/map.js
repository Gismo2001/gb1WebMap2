import Map from 'ol/Map';
import View from 'ol/View';

export function createMap(target, layers) {
  return new Map({
    target: target,
    layers: layers,
    view: new View({
      center: [0, 0],
      zoom: 2,
    }),
  });
}