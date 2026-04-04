import Map from 'ol/Map';
import View from 'ol/View';
import { FullScreen, Attribution, defaults as defaultControls, ZoomToExtent } from 'ol/control';
import { DragRotateAndZoom, defaults as defaultInteractions } from 'ol/interaction';




export function createMap(target = 'map', layers = []) {
  return new Map({
    target,
    view: new View({
      center: [792754.5, 6915114],
      zoom: 11
    }),
    layers,
    controls: defaultControls().extend([
      new FullScreen(),
      new ZoomToExtent({
        extent: [727361, 6839277, 858148, 6990951]
      }),
      new Attribution({
        collapsible: false,
        html: '<a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>'
      })
    ]),
    interactions: defaultInteractions().extend([new DragRotateAndZoom()])
  });
}

