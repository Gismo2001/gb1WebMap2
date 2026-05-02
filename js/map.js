import Map from 'ol/Map';
import View from 'ol/View';
import { fromLonLat } from 'ol/proj';
import { FullScreen, Attribution, defaults as defaultControls, ZoomToExtent } from 'ol/control';
import { DragRotateAndZoom, defaults as defaultInteractions } from 'ol/interaction';

export function createMap(target = 'map', layers = []) {

  // 👉 EIN eigenes Attribution-Control
  const attribution = new Attribution({
    collapsible: false, // wird später dynamisch gesetzt
  });

  const map = new Map({
    target,
    view: new View({
      center: fromLonLat([7.35, 52.7]),
      zoom: 9
    }),
    theme: null,
    layers,

    // 👉 WICHTIG: Default-Attribution deaktivieren!
    controls: defaultControls({ attribution: false }).extend([
      attribution,
      new FullScreen(),
      new ZoomToExtent({
        extent: [727361, 6839277, 858148, 6990951]
      })
    ]),

    interactions: defaultInteractions().extend([
      new DragRotateAndZoom()
    ])
  });

  // 👉 RESPONSIVE Verhalten wie im OpenLayers-Beispiel
  function checkSize() {
    const size = map.getSize();
    if (!size) return;

    const small = size[0] < 600;

    attribution.setCollapsible(small);
    attribution.setCollapsed(small);
  }

  map.on('change:size', checkSize);
  checkSize();

  return map;
}
