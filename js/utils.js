import {Circle as CircleStyle, Fill, RegularShape, Icon, Stroke, Style, Text} from 'ol/style';
import MultiPoint from 'ol/geom/MultiPoint';
import { Point} from 'ol/geom';



const SleStyle = new Style({
    image: new Icon({
        src: '/data/sle.svg',
        scale: 0.9,
    }),
});

const WehStyle = new Style({
    image: new Icon({
        src: '/data/weh.svg',
        scale: 0.9,
    }),
});

export function logMessage(msg) {
  console.log("INFO:", msg);
}

export {
  SleStyle,
  WehStyle
};