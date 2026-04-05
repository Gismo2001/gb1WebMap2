import {Circle as CircleStyle, Fill, RegularShape, Icon, Stroke, Style, Text} from 'ol/style';
//import MultiPoint from 'ol/geom/MultiPoint';
//import { Point} from 'ol/geom';


const BruAndereStyle = new Style({
    image: new Icon({
        src: '/data/bru_andere.svg',
        scale: 0.9,
    }),
});

const BruNlwknStyle = new Style({
    image: new Icon({
        src: '/data/bru_nlwkn.svg',
        scale: 0.9,
    }),
});

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

const DueStyle = new Style({
    image: new Icon({
        src: '/data/due.svg',
        scale: .9
    })
});;

function getStyleForArtEin(feature) {   
    const artValue = feature.get('Ein_ord');
    let iconSrc;
    switch (artValue) {
        case '1. Ordnung':
            iconSrc = './data/einErsterOrdnung.svg';
            break;
        case '2. Ordnung':
            iconSrc = './data/einZweiterOrdnung.svg';
            break;
        case '3. Ordnung':
            iconSrc = './data/einDritterOrdnung.svg';
            break;
        case 'Einleitung':
            iconSrc = './data/einEinleitung.svg';
            break;
        case 'Sonstige':
            iconSrc = './data/einSonstige.svg';
            break;
        default:
            iconSrc = './data/einSonstige.svg';
    }

    return new Style({
        image: new Icon({
            src: iconSrc,
            scale: .9 
        })
    });
};


const QueStyle = new Style({
    image: new Icon({
    src: '/data/que.svg',
    scale: .9
    })
});


export {
    SleStyle,
    WehStyle,
    BruAndereStyle,
    BruNlwknStyle,
    DueStyle,
    getStyleForArtEin,
    QueStyle    
};