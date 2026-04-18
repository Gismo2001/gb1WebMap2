import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { transform, fromLonLat } from 'ol/proj';
import VectorSource from 'ol/source/Vector';
import VectorLayer from 'ol/layer/Vector';
import { Style, Circle, Fill, Stroke } from 'ol/style';


// Diese Variablen halten wir lokal in diesem Modul
let ptnSource = null;
let ptnLayer = null;
let mapRef = null;


export function initPtn(map) { //hier wird map übergeben
    mapRef = map; // map wird mapRef zugewiesn
    console.log ('initPtn aufgerufen?')
    // Punktlayer erstellen für Visualisierung bei Hover in Tabelle
    if (!ptnLayer) { 
        console.log ('ptnLayer wird erstellt?')
        ptnSource = new VectorSource(
           
        );
        ptnLayer = new VectorLayer({
             title: 'test',
            source: ptnSource,
            // Optional: Ein schöner Style, damit der Punkt auffällt
            style: new Style({
                image: new Circle({
                    radius: 8,
                    fill: new Fill({ color: 'red' }),
                    stroke: new Stroke({ color: 'white', width: 2 })
                })

            })
        });
        ptnLayer.set('displayInLayerSwitcher', true);
        mapRef.addLayer(ptnLayer);
    }
}
export function handleCRSChange() {
    // 1. Nur das Menü einblenden
    const coordInputDiv = document.getElementById('coordinate_selection');
    if (coordInputDiv) {
        coordInputDiv.style.display = 'block';
    }


    // 2. Event-Listener für den Button (einmalig hinzufügen)
    const startBtn = document.getElementById('start-coord-input');
    if (startBtn) {
        // Wir entfernen alte Listener, falls vorhanden, um Doppelungen zu vermeiden
        startBtn.onclick = () => askForCoordinates();
    }
}
 function askForCoordinates() {
    const selectElement = document.getElementById('coord_select');
    const systemLabel = selectElement.value.toUpperCase();

    const coordInputDiv = document.getElementById('coordinate_selection');
    if (coordInputDiv) {
        coordInputDiv.style.display = 'block';
    }
    
    const input = prompt(
        `Koordinaten im Format "x;y" eingeben (${systemLabel}):\n` +
        `Beispiel (EPSG:4326): 52.564; 7.068 (Lat; Lon)\n` +
        `Beispiel (Metrisch): 345600; 5812000`
    );
    if (!input) return;

    if (coordInputDiv) coordInputDiv.style.display = 'block';
    
    
    const parts = input.split(';').map(str => str.trim());
    if (parts.length !== 2) {
        alert('❌ Format "x;y" (mit Semikolon) erforderlich.');
        return;
    }

    // Hilfsfunktion zum Parsen (ersetzt Komma durch Punkt)
    const cleanNum = (val) => parseFloat(val.replace(',', '.'));

    let x, y, transformed;

    try {
        if (systemLabel === 'EPSG:4326') {
            // Breitengrad (Y) zuerst eingegeben? In OpenLayers ist fromLonLat([lon, lat])
            y = cleanNum(parts[0]); // Lat
            x = cleanNum(parts[1]); // Lon
            transformed = fromLonLat([x, y]);
        } else {
            x = cleanNum(parts[0]);
            y = cleanNum(parts[1]);
            // Universelle Transformation nach WebMercator
            transformed = transform([x, y], systemLabel, 'EPSG:3857');
        }

        if (isNaN(transformed[0]) || isNaN(transformed[1])) throw new Error();
        
        drawPoint(transformed);

    } catch (err) {
        alert('❌ Fehler bei der Koordinate oder dem Koordinatensystem.');
    }
   drawPoint(transformed);
}
export function drawPoint(coords) {
    if (!ptnSource || !mapRef) return;

    // Optional: Alten Punkt löschen, wenn immer nur einer angezeigt werden soll
    ptnSource.clear(); 

    const pointFeature = new Feature({
        geometry: new Point(coords),
    });

    ptnSource.addFeature(pointFeature);

    
}
export function ptnDelFindCoord() {
    const coordInputDiv = document.getElementById('coordinate_selection');
    if (coordInputDiv) coordInputDiv.style.display = 'none';

    // Wenn der Nutzer den Button deaktiviert, löschen wir den Punkt
    // und entfernen den Layer komplett von der Karte
    if (ptnSource) ptnSource.clear();
    if (ptnLayer && mapRef) {
        mapRef.removeLayer(ptnLayer);
        ptnLayer = null; // Zurücksetzen, damit er beim nächsten Mal neu erstellt wird
        ptnSource = null;
    }
     
}
let searchSource = null;
let searchLayer = null;
export function drawSearchPoint(coords) {
    // 1. Sicherheitscheck: Wenn initPtn(map) noch nicht lief, haben wir kein mapRef
    if (!mapRef) {
        console.error("mapRef ist nicht gesetzt. Wurde initPtn(map) in main.js aufgerufen?");
        return;
    }

    // 2. Initialisiere den Such-Layer nur beim allerersten Mal
    if (!searchLayer) {
        searchSource = new VectorSource();
        searchLayer = new VectorLayer({
            source: searchSource,
            zIndex: 9999, // Suchergebnis immer ganz oben
            style: new Style({
                image: new Circle({
                    radius: 8,
                    fill: new Fill({ color: '#337ab7' }), // Blau für Suche
                    stroke: new Stroke({ color: 'white', width: 2 })
                })
            })

        });
        mapRef.addLayer(searchLayer);
        searchLayer.set('displayInLayerSwitcher', false);
    }

    // 3. Bestehende Suche löschen und neuen Punkt setzen
    searchSource.clear();
    const searchFeature = new Feature({
        geometry: new Point(coords)
    });
    searchSource.addFeature(searchFeature);
}