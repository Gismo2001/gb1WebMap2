import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Draw, Modify, Snap, Select, Translate } from 'ol/interaction';
import { Style, Stroke, Fill, Circle as CircleStyle } from 'ol/style';
import { getLength, getArea } from 'ol/sphere';
import { transform } from 'ol/proj'; // 💡 NEU: Für die Koordinaten-Umrechnung

import { GeoJSON } from 'ol/format'; // 💡 Stelle sicher, dass GeoJSON oben importiert ist


let mapInstance = null;
let drawSource = null;
let drawLayer = null;

let drawInteraction = null;
let modifyInteraction = null;
let snapInteraction = null;
let deleteInteraction = null; // 💡 NEU: Für das gezielte Löschen per Klick
let translateInteraction = null; // 💡 NEU: Für das Verschieben ganzer Objekte

// Initialisiert die Zeichen-Funktionalität
export function initDrawing(map) {
  if (!map) return;
  mapInstance = map;
  
  // 1. VectorSource und Layer für die Zeichnungen erstellen
  drawSource = new VectorSource();
  drawLayer = new VectorLayer({
    source: drawSource,
    name: 'drawLayer',
    style: new Style({
      fill: new Fill({ color: 'rgba(255, 255, 255, 0.7)' }),
      stroke: new Stroke({ color: '#ffcc33', width: 3 }),
      image: new CircleStyle({
        radius: 7,
        fill: new Fill({ color: '#ffcc33' })
      })
    }),
    displayInLayerSwitcher: false,
  });

  // Layer der Karte hinzufügen
  mapInstance.addLayer(drawLayer);
  
  // 2. Modify-Interaktion dauerhaft aktivieren
  modifyInteraction = new Modify({ source: drawSource });
  mapInstance.addInteraction(modifyInteraction);

  // 💡 NEU: Automatische Neuberechnung nach dem Verschieben/Verändern von Punkten
  modifyInteraction.on('modifyend', function (event) {
    const modifiedFeatures = event.features.getArray();
    modifiedFeatures.forEach(feature => {
      calculateMetrics(feature);
    });
    console.log("Objekt-Attribute nach Modifikation live aktualisiert!");
  });

  // 3. UI-Button Event-Listener binden
  setupDrawUi();
}

// Bindet die Klick-Events an die HTML-Leiste
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
  // 💡 NEU: Event-Listener für den Export-Button
  const exportBtn = document.getElementById('draw-export');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      exportDrawFeatures();
    });
  }


}
// Wechselt den Zeichenmodus basierend auf dem ausgewählten Typ


function updateDrawInteraction(type) {
  // 1. Vorherige Interaktionen IMMER komplett von der Karte entfernen
  if (drawInteraction) { mapInstance.removeInteraction(drawInteraction); drawInteraction = null; }
  if (snapInteraction) { mapInstance.removeInteraction(snapInteraction); snapInteraction = null; }
  if (deleteInteraction) { mapInstance.removeInteraction(deleteInteraction); deleteInteraction = null; }
  if (translateInteraction) { mapInstance.removeInteraction(translateInteraction); translateInteraction = null; } // 💡 NEU

  // Fall A: Navigation / Hand-Symbol aktiv
  if (type === 'None') {
    if (modifyInteraction) modifyInteraction.setActive(false);
    console.log("Zeichenmodus beendet. Navigation aktiv.");
    return;
  }

  // 💡 Fall B: NEU - Löschmodus aktiv
  if (type === 'Delete') {
    if (modifyInteraction) modifyInteraction.setActive(false); // Modify pausieren
    
    // Select-Interaktion erstellen, die NUR auf unseren drawLayer reagiert
    deleteInteraction = new Select({
      layers: [drawLayer],
      style: null // Verhindert, dass OpenLayers das Objekt beim Anklicken blau einfärbt
    });

    // Sobald ein Objekt ausgewählt wird, feuert dieses Event
    deleteInteraction.on('select', function (e) {
      const selectedFeatures = e.target.getFeatures();
      
      if (selectedFeatures.getLength() > 0) {
        const featureToDelete = selectedFeatures.item(0);
        
        // Objekt aus der Source löschen
        drawSource.removeFeature(featureToDelete);
        
        // Die Auswahl sofort wieder leeren, damit das System bereit für den nächsten Klick ist
        selectedFeatures.clear();
        console.log("Objekt erfolgreich gelöscht.");
      }
    });

    mapInstance.addInteraction(deleteInteraction);
    console.log("Löschmodus aktiv. Klicke auf ein Objekt zum Entfernen.");
    return;
  }
// 💡 Fall D: NEU - Verschieben-Modus aktiv
  if (type === 'Translate') {
    if (modifyInteraction) modifyInteraction.setActive(false); // Normales Modify pausieren

    // Translate-Interaktion erstellen, die NUR auf unseren drawLayer reagiert
    translateInteraction = new Translate({
      layers: [drawLayer]
    });

    // optional: Nach dem Verschieben die Attribute (z.B. Punkt-Koordinaten) neu berechnen!
    translateInteraction.on('translateend', function (e) {
      const translatedFeatures = e.features.getArray();
      translatedFeatures.forEach(feature => {
        calculateMetrics(feature); // Aktualisiert die UTM/WGS84-Koordinaten bei Punkten!
      });
      console.log("Objekt(e) erfolgreich verschoben und Attribute aktualisiert.");
    });

    mapInstance.addInteraction(translateInteraction);
    console.log("Verschiebe-Modus aktiv. Ziehe ein Objekt mit gedrückter Maustaste.");
    return;
  }

  // Fall C: Normales Zeichnen (Point, Line, Polygon...)
  // ... dein bestehender Code für Draw und Snap
  // Fall C: Ein normales Zeichenwerkzeug (Point, Line, etc.) wurde gewählt
  if (modifyInteraction) modifyInteraction.setActive(true);
    
  drawInteraction = new Draw({
    source: drawSource,
    type: type,
  });

  drawInteraction.on('drawend', function (event) {
    const feature = event.feature;
    const currentId = drawSource.getFeatures().length + 1;
    feature.set('id', currentId);
    calculateMetrics(feature);
  });

  mapInstance.addInteraction(drawInteraction);

  snapInteraction = new Snap({ source: drawSource });
  mapInstance.addInteraction(snapInteraction);
}

// 💡 NEU: Zentrale Hilfsfunktion zur Berechnung von Länge, Fläche und Typ
function calculateMetrics(feature) {
  const geometry = feature.getGeometry();
  if (!geometry) return;
  
  const geomType = geometry.getType();

  if (geomType === 'LineString') {
    const length = getLength(geometry);
    feature.set('laenge_m', parseFloat(length.toFixed(2)));
    feature.set('typ', 'Linie');
    
  } else if (geomType === 'Polygon') {
    const area = getArea(geometry);
    feature.set('flaeche_qm', parseFloat(area.toFixed(2)));
    feature.set('typ', 'Fläche');

  } else if (geomType === 'Circle') {
    const radius = geometry.getRadius();
    const area = Math.PI * Math.pow(radius, 2);
    feature.set('radius_m', parseFloat(radius.toFixed(2)));
    feature.set('flaeche_qm', parseFloat(area.toFixed(2)));
    feature.set('typ', 'Kreis');

  } 
  // 💡 NEU: Umfassende Koordinatenberechnung für Punkte
  else if (geomType === 'Point') {
    feature.set('typ', 'Punkt');
    
    // Die native Koordinate im Kartensystem (EPSG:3857) auslesen
    const coords3857 = geometry.getCoordinates();
    feature.set('x_3857', parseFloat(coords3857[0].toFixed(2)));
    feature.set('y_3857', parseFloat(coords3857[1].toFixed(2)));
    
    // Umrechnung in EPSG:4326 (WGS84 - Gradzahlen für GPS/Google Maps)
    const coords4326 = transform(coords3857, 'EPSG:3857', 'EPSG:4326');
    feature.set('lon_4326', parseFloat(coords4326[0].toFixed(6))); // 6 Dezimalstellen reichen für cm-Genauigkeit
    feature.set('lat_4326', parseFloat(coords4326[1].toFixed(6)));
    
    // Umrechnung in EPSG:25832 (UTM Zone 32N - Meterkoordinaten für DE/Niedersachsen)
    const coords25832 = transform(coords3857, 'EPSG:3857', 'EPSG:25832');
    feature.set('x_25832', parseFloat(coords25832[0].toFixed(2)));
    feature.set('y_25832', parseFloat(coords25832[1].toFixed(2)));
  }
}
// Prüft ob der Nutzer im Zeichenmodus ist
export function isDrawingActive() {
  return !!(drawInteraction && drawInteraction.getActive());
}

// Gibt die VectorSource zurück
export function getDrawSource() {
  return drawSource;
}

// Zeichenmodus zurücksetzen
export function deactivateDrawing() {
  if (mapInstance) {
    if (drawInteraction) mapInstance.removeInteraction(drawInteraction);
    if (snapInteraction) mapInstance.removeInteraction(snapInteraction);
    if (deleteInteraction) mapInstance.removeInteraction(deleteInteraction); // 💡 NEU
    if (modifyInteraction) modifyInteraction.setActive(false);
    if (translateInteraction) mapInstance.removeInteraction(translateInteraction); // 💡 NEU
    
    
    drawInteraction = null;
    snapInteraction = null;
    deleteInteraction = null; // 💡 NEU
    translateInteraction = null; // 💡 NEU
  }

  const buttons = document.querySelectorAll('.draw-btn');
  buttons.forEach(b => b.classList.remove('active'));
  
  const noneBtn = document.getElementById('draw-none');
  if (noneBtn) noneBtn.classList.add('active');
}



export function exportDrawFeatures() {
  if (!drawSource || drawSource.getFeatures().length === 0) {
    alert("Es gibt keine gezeichneten Objekte zum Exportieren!");
    return;
  }

  // 1. OpenLayers GeoJSON-Formatierer initialisieren
  const format = new GeoJSON();

  // 2. Features in einen GeoJSON-String umwandeln
  // 💡 Wichtig: Wir sagen OpenLayers, dass die Daten von EPSG:3857 (Karte) nach EPSG:4326 (Standard-GeoJSON) konvertiert werden sollen
  const geoJsonString = format.writeFeatures(drawSource.getFeatures(), {
    featureProjection: 'EPSG:3857',
    dataProjection: 'EPSG:4326'
  });

  // 3. Den String in eine Datei umwandeln (Blob) und den Download im Browser triggern
  const blob = new Blob([geoJsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  // Dateiname mit aktuellem Zeitstempel versehen
  const timestamp = new Date().toISOString().slice(0, 10);
  a.download = `karte_zeichnungen_${timestamp}.geojson`;
  
  // Klick simulieren und aufräumen
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  console.log("GeoJSON-Export erfolgreich angestoßen.");
}