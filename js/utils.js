import {Circle as CircleStyle, Fill, RegularShape, Icon, Stroke, Style, Text} from 'ol/style';
import MultiPoint from 'ol/geom/MultiPoint';


// BW-Style Punkte
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
            iconSrc = '/data/einErsterOrdnung.svg';
            break;
        case '2. Ordnung':
            iconSrc = '/data/einZweiterOrdnung.svg';
            break;
        case '3. Ordnung':
            iconSrc = '/data/einDritterOrdnung.svg';
            break;
        case 'Einleitung':
            iconSrc = '/data/einEinleitung.svg';
            break;
        case 'Sonstige':
            iconSrc = '/data/einSonstige.svg';
            break;
        default:
            iconSrc = '/data/einSonstige.svg';
    }

    return new Style({
        image: new Icon({
            src: iconSrc,
            scale: .9 
        })
    });
};


function getStyleForArtSonPun(feature) {
    const artValue = feature.get('bauart');
    let iconSrc;

    if (/boots/i.test(artValue)) {
        iconSrc = '/data/bwSonPun_Anleger.svg';
    
    }else if (/betriebs/i.test(artValue)) {
        iconSrc = '/data/sonPunBetrieb.svg';
    
    }else if (/steg/i.test(artValue)) {
        iconSrc = '/data/bwSonPun_Anleger.svg';   
        
    } else if (artValue === 'Infotafel') {
        iconSrc = '/data/sonPunInfo.svg';
    } else if (artValue === 'Auskolkung') {
        iconSrc = '/data/sonPunKolk.svg';
    } else if (artValue === 'Furt') {
        iconSrc = '/data/bwSonPun_Furt.svg';
    } else if (artValue === 'Tor') {
        iconSrc = '/data/bwSonPun_Tor.svg';
    } else if (artValue === 'Überfahrt') {
        iconSrc = '/data/bwSonPun_Ueberfahrt.svg';
    } else if (artValue === 'Betriebspegel') {
        iconSrc = '/data/bwSonPun_Betriebspegel.svg';
    } else {
        iconSrc = '/data/sonPunSonstige.svg';
    }

    return new Style({
        image: new Icon({
            src: iconSrc,
            scale: 0.9
        })
    });
}


// BW-Style Linien
function getStyleForArtSonLin(feature) {   
    const artValue = feature.get('bauart');
    let strokeColor;
    let strokeWidth;
    let lineDash;

    if (artValue === 'Anlegehilfe') {
        strokeColor = 'blue';
        strokeWidth = 5;
    } else if (/sohlgl|umgehungs|fisch/i.test(artValue)) {
        strokeColor = 'red';
        strokeWidth = 5;
        lineDash = [10, 15];
    } else if (/fuß|rad/i.test(artValue)) {
        strokeColor = 'olive';
        strokeWidth = 5;
        lineDash = [20, 10];
    } else if (/bio/i.test(artValue)) {
        strokeColor = 'green';
        strokeWidth = 5;
        lineDash = [17.5, 10];

    } else if (/strasse|Straße/i.test(artValue)) {
        strokeColor = 'Black';
        strokeWidth = 5;
        lineDash = [12.5, 10];

    } else {
        strokeColor = 'blue';
        strokeWidth = 5;
        lineDash = undefined;
    }
    
    return new Style({
        fill: new Fill({
            color: strokeColor
        }),
        stroke: new Stroke({
            color: strokeColor,
            width: strokeWidth,
            lineDash: lineDash 
        })
    });
};



const QueStyle = new Style({
    image: new Icon({
    src: '/data/que.svg',
    scale: .9
    })
});



function getStyleForArtGewInfo(feature) {
    const uArt = feature.get('Kat');
    const txtIdUabschn = String(feature.get('IDUabschn') || ''); // Sicherstellen, dass es ein String ist
    
    let strokeColor = (uArt === 'E') ? 'green' : 'red';
    let lineDash = [10, 15];

    const styles = [
        // 1. Die Hauptlinie
        new Style({
            stroke: new Stroke({
                color: strokeColor,
                width: 5,
                lineDash: lineDash
            })
        }),
        // 2. Start- und Endpunkte
        new Style({
            geometry: function(feature) {
                const geom = feature.getGeometry();
                if (geom.getType() === 'LineString') {
                    const coords = geom.getCoordinates();
                    return new MultiPoint([coords[0], coords[coords.length - 1]]);
                }
                return null;
            },
            image: new CircleStyle({
                radius: 5,
                fill: new Fill({ color: 'black' })
            })
        })
    ];

    // 3. Text-Label (nur hinzufügen, wenn Text vorhanden ist)
    if (txtIdUabschn) {
        styles.push(new Style({
            text: new Text({
                text: txtIdUabschn,
                font: 'bold 14px Arial',
                fill: new Fill({ color: '#000' }),
                stroke: new Stroke({ color: '#fff', width: 3 }),
                overflow: true,
                placement: 'point'
            })
        }));
    }

    return styles;
}
function getStyleForArtUmn(feature) {
    const mnIdValue = feature.get('Massn_ID');
    let strokeColor;
  
    switch (mnIdValue) {
        // keine Mahd
        case 3:
        case 4:
        case 5:
            strokeColor = 'blue';
            break;
        // zweimalige Mahd
        case 6:
        case 7:
        case 8:
        case 9:
        case 10:
            strokeColor = 'black';
            break;
        // einmalige Mahd
        case 11:
        case 12:
        case 13:
        case 14:
        case 15:
        case 16:
        case 17:
        case 18:
        case 26:
        case 27:
            strokeColor = 'green';
            break;
        // Schilfsaum belassen
        case 22:
        case 23:
            strokeColor = 'rgba(255, 190, 190, 0.5)';
            break;
        // keine Mahd am der unteren Böschung
        case 24:
        case 50:
        case 2:
            strokeColor = 'rgba(230, 152, 0, 0.5)';
            break;
        // Mahd an Bauwerken
        case 200:
        case 201:
            strokeColor = 'rgba(205, 205, 205, 1)';
            break;
        // Schilfkrautung
        case 300:
            strokeColor = 'rgba(230, 230, 0, 0.5)';
            break;
        // Bauwerksunterhaltung
        case 400:
            strokeColor = 'rgba(130, 130, 130, 1)';
            break;
        // beobachtende Unterhaltung
        default:
            strokeColor = 'grey';
    }
    return new Style({
        stroke: new Stroke({
            color: strokeColor,
            width: 5
        })
    });
};


// Style für FSK
function getStyleForArtFSK(feature) {
    const artValue = feature.get('Art');
    let fillColor, strokeColor;
    switch (artValue) {
    case 'p':
        fillColor = 'rgba(200, 200, 200, .6)';
        strokeColor = 'black';
        break;
    case 'o':
        fillColor = 'rgba(255, 220, 220, .6)';
        strokeColor = 'black';
        break;
    case 'l':
        fillColor = 'rgba(255, 190, 150, .6)';
        strokeColor = 'black';
        break;
    default:
        fillColor = 'rgba(255, 255, 255, 1)';
        strokeColor = 'grey';
    }
    return new Style({
        fill: new Fill({
            color: fillColor
        }),
        stroke: new Stroke({
            color: strokeColor,
            width: 0.5
        })
       
    });
};

// Style für Kilomtrierung
const Km10scalStyle = new Style({
    stroke: new Stroke({
        color: 'grey',
        width: .5
    })
});
const Km100scalStyle = function(feature, km, resolution) {
    var minResolution = 0;
    var maxResolution = 5; 
    var kmInKilometer = km / 1000;
    var kmFormatted = kmInKilometer.toFixed(2);
    
    if (resolution > minResolution && resolution < maxResolution) {
        return new Style({
            text: new Text({
                text: kmFormatted.toString(), // Verwenden Sie den Wert von km als Text
                font: 'normal 18px "Arial Light", "Helvetica Neue Light", Arial, sans-serif',
                offsetX: -20,
                offsetY: 10,        
            }),
            stroke: new Stroke({
                color: 'black', // oder eine andere Linienfarbe
                width: 1 // oder eine andere Linienbreite  
            })
        });
    } else {
        return null;
    }
};
const Km500scalStyle = function(feature, km, resolution) {
    var minResolution = 0;
    var maxResolution = 14; 
    var kmInKilometer = km / 1000;
    var kmFormatted = kmInKilometer.toFixed(2);
    if (resolution > minResolution && resolution < maxResolution) {
        return new Style({
            text: new Text({
                text: kmFormatted.toString(), // Verwenden Sie den Wert von km als Text
                font: 'bold 20px "Arial Light", "Helvetica Neue Light", Arial, sans-serif', // Fett formatierter Text
                offsetX: -35,
                offsetY: 10,
                fill: new Fill({
                    color: 'rgba(0, 0, 0, 1)'
                }),
            }),
            stroke: new Stroke({
                color: 'black', // oder eine andere Linienfarbe
                width: 2 // oder eine andere Linienbreite  
            })
        });
    } else {
        return null;
    }
};


export {
    SleStyle,
    WehStyle,
    BruAndereStyle,
    BruNlwknStyle,
    DueStyle,
    getStyleForArtEin,
    getStyleForArtSonPun,
    QueStyle,
    getStyleForArtSonLin,
    getStyleForArtGewInfo,
    getStyleForArtUmn,
    Km10scalStyle,
    Km100scalStyle,
    Km500scalStyle,
    getStyleForArtFSK,

    
};