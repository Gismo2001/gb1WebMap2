import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Draw from 'ol/interaction/Draw';
import Modify from 'ol/interaction/Modify';
import Snap from 'ol/interaction/Snap';
import { Style, Stroke, Fill, Circle as CircleStyle } from 'ol/style';

// Globale Variablen innerhalb des Moduls
let mapInstance = null;
let drawSource = null;
let drawLayer = null;

let drawInteraction = null;
let modifyInteraction = null;
let snapInteraction = null;

/**
 * Initialisiert die Zeichen-Funktionalität
 * @param {ol.Map} map - Die bestehende OpenLayers Karteninstanz
 */
export function initDrawing(map) {
    if (!map) return;
    mapInstance = map;

    // 1. VectorSource und Layer für die Zeichnungen erstellen
    drawSource = new VectorSource();
    drawLayer = new VectorLayer({
        source: drawSource,
        // Schickes, halbtransparentes Standard-Styling für Zeichnungen
        style: new Style({
            fill: new Fill({
                color: 'rgba(255, 255, 255, 0.3)',
            }),
            stroke: new Stroke({
                color: '#ffcc33',
                width: 3,
            }),
            image: new CircleStyle({
                radius: 7,
                fill: new Fill({
                    color: '#ffcc33',
                }),
            }),
        }),
    });

    // Layer der Karte hinzufügen
    mapInstance.addLayer(drawLayer);

    // 2. Modify-Interaktion dauerhaft aktivieren (erlaubt Verschieben von Punkten jederzeit)
    modifyInteraction = new Modify({ source: drawSource });
    mapInstance.addInteraction(modifyInteraction);

    // 3. UI-Button Event-Listener binden
    setupDrawUi();
}

/**
 * Bindet die Klick-Events an die HTML-Leiste
 */
function setupDrawUi() {
    const buttons = document.querySelectorAll('.draw-btn');
    
    buttons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Aktiven Button-Style umschalten
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            

            const type = btn.getAttribute('data-type');
            updateDrawInteraction(type);
        });
    });

    // Mülleimer-Button zum Leeren der Zeichnungen
    const clearBtn = document.getElementById('draw-clear');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (drawSource && confirm('Möchtest du alle selbst gezeichneten Objekte löschen?')) {
                drawSource.clear();
            }
        });
    }
}
/**
 * Wechselt den Zeichenmodus basierend auf dem ausgewählten Typ
 * @param {string} type - 'Point', 'LineString', 'Polygon', 'Circle' oder 'None'
 */
function updateDrawInteraction(type) {
    // 1. Vorherige Interaktionen IMMER komplett von der Karte entfernen
    if (drawInteraction) {
        mapInstance.removeInteraction(drawInteraction);
        drawInteraction = null;
    }
    if (snapInteraction) {
        mapInstance.removeInteraction(snapInteraction);
        snapInteraction = null;
    }

    if (type === 'None') {
        // 👉 WICHTIG: Wenn die Hand aktiv ist, pausieren wir auch das Modify,
        // damit es deine WMS-Klicks nicht blockiert oder ablenkt!
        if (modifyInteraction) modifyInteraction.setActive(false);
        console.log("Zeichenmodus beendet. Navigation aktiv.");
        return;
    }

    // 👉 Wenn wir zeichnen, aktivieren wir das Modify wieder
    if (modifyInteraction) modifyInteraction.setActive(true);

    // 2. Neue Draw-Interaktion erstellen
    drawInteraction = new Draw({
        source: drawSource,
        type: type,
    });
    mapInstance.addInteraction(drawInteraction);

    // 3. Snap-Interaktion hinzufügen (rastet an Ecken ein)
    snapInteraction = new Snap({ source: drawSource });
    mapInstance.addInteraction(snapInteraction);
}

/**
 * Prüft glasklar, ob der Nutzer im Zeichenmodus ist
 * @returns {boolean}
 */
export function isDrawingActive() {
    // Nur wenn die Interaktion existiert UND auf der Karte aktiv geschaltet ist, lieferst du true
    return !!(drawInteraction && drawInteraction.getActive());
}
/**
 * Gibt die VectorSource zurück, falls man von außen darauf zugreifen will (z.B. für Exporte)
 */
export function getDrawSource() {
    return drawSource;
}
