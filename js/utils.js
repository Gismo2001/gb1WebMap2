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


function getStyleForArtSonPun(feature) {
    const artValue = feature.get('bauart');
    let iconSrc;

    if (/boots/i.test(artValue)) {
        iconSrc = './data/bwSonPun_Anleger.svg';
    
    }else if (/betriebs/i.test(artValue)) {
        iconSrc = './data/sonPunBetrieb.svg';
    
    }else if (/steg/i.test(artValue)) {
        iconSrc = './data/bwSonPun_Anleger.svg';   
        
    } else if (artValue === 'Infotafel') {
        iconSrc = './data/sonPunInfo.svg';
    } else if (artValue === 'Auskolkung') {
        iconSrc = './data/sonPunKolk.svg';
    } else if (artValue === 'Furt') {
        iconSrc = './data/bwSonPun_Furt.svg';
    } else if (artValue === 'Tor') {
        iconSrc = './data/bwSonPun_Tor.svg';
    } else if (artValue === 'Überfahrt') {
        iconSrc = './data/bwSonPun_Ueberfahrt.svg';
    } else if (artValue === 'Betriebspegel') {
        iconSrc = './data/bwSonPun_Betriebspegel.svg';
    } else {
        iconSrc = './data/sonPunSonstige.svg';
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
    const txtIdUabschn = feature.get('IDUabschn')
    let strokeColor;
    let lineDash = [10, 15]; // Gilt für alle Linien

    // Linienfarbe festlegen abhängig von uArt
    if (uArt === 'E') {
        strokeColor = 'green'; // Grün für "E"
    } else {
        strokeColor = 'red'; // Rot für alles andere
    }

    // Stil zurückgeben, der Linien und Punkte für Linienenden definiert
    return [
        new Style({
            stroke: new Stroke({
                color: strokeColor,
                width: 5, // Feste Breite
                lineDash: lineDash
            }),
            fill: new Fill({
                color: strokeColor // Füllung abhängig von der Linienfarbe
            })
        }),
        // Stil für die Kreise an den Linienenden
        new Style({
            geometry: function(feature) {
                const coordinates = feature.getGeometry().getCoordinates(); // Koordinaten der Geometrie
                return new MultiPoint([coordinates[0], coordinates[coordinates.length - 1]]); // Start- und Endpunkt
            },
            image: new CircleStyle({
                radius: 5, // Größe des Kreises
                fill: new Fill({
                    color: 'black' // Schwarzer gefüllter Kreis
                })
            })
        }),
        new Style({
            text: new Text({
                text: txtIdUabschn, // Text ist der Wert von IDUabschn
                font: 'bold 14px Arial',
                fill: new Fill({
                    color: '#000' // Schwarze Schriftfarbe
                }),
                stroke: new Stroke({
                    color: '#fff', // Weißer Rand um den Text
                    width: 3
                }),
                overflow: true, // Text wird auch außerhalb des Features angezeigt
                placement: 'point', // Text wird an einem Punkt und nicht entlang der Linie platziert
                rotation: 0, // Rotation auf 0 setzen, damit der Text waagerecht bleibt
            })
        })
    ];
}

/* // Style für Kilomtrierung
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

 */

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
   /*  Km10scalStyle,
    Km100scalStyle,
    Km500scalStyle */

};