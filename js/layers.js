import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';

export function createBaseLayer() {
  return new TileLayer({
    source: new OSM(),
  });
}