import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Draw, Modify, Snap, Select, Translate } from 'ol/interaction';
import { Style, Stroke, Fill, Circle as CircleStyle } from 'ol/style';
import { getLength, getArea } from 'ol/sphere';
import { transform } from 'ol/proj'; // 💡 NEU: Für die Koordinaten-Umrechnung
import { selectStyle } from './controls.js'; // 💡 NEU: Für die Auswahl-Interaktion


import { GeoJSON } from 'ol/format'; // 💡 Stelle sicher, dass GeoJSON oben importiert ist


let mapInstance = null;
export let drawSource = null;
export let drawLayer = null;

let drawInteraction = null;
let modifyInteraction = null;
let snapInteraction = null;
let deleteInteraction = null; // 💡 NEU: Für das gezielte Löschen per Klick
let translateInteraction = null; // 💡 NEU: Für das Verschieben ganzer Objekte
let selectInteraction = null; // 💡 NEU: Für die Auswahl von Objekten (z.B. zum Löschen oder Verschieben)

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
  //Event-Listener für den Export-Button
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
  if (translateInteraction) { mapInstance.removeInteraction(translateInteraction); translateInteraction = null; } 

  // Fall A: Navigation / Hand-Symbol aktiv
  if (type === 'None') {
    if (modifyInteraction) modifyInteraction.setActive(false);
    console.log("Zeichenmodus beendet. Navigation aktiv.");
    return;
  }

  // Fall B: Löschmodus aktiv
  if (type === 'Delete') {
    if (modifyInteraction) modifyInteraction.setActive(false); // Modify pausieren
    
    deleteInteraction = new Select({
      layers: [drawLayer],
      style: null 
    });

    deleteInteraction.on('select', function (e) {
      const selectedFeatures = e.target.getFeatures();
      
      if (selectedFeatures.getLength() > 0) {
        const featureToDelete = selectedFeatures.item(0);
        drawSource.removeFeature(featureToDelete);
        selectedFeatures.clear();
        console.log("Objekt erfolgreich gelöscht.");
      }
    });

    mapInstance.addInteraction(deleteInteraction);
    console.log("Löschmodus aktiv. Klicke auf ein Objekt zum Entfernen.");
    return;
  }

  

// In deinem Fall D ("Translate") in myDraw.js baust du das so um:
if (type === 'Translate') {
  if (modifyInteraction) modifyInteraction.setActive(false);
  if (drawInteraction) drawInteraction.setActive(false);

  // 1. Select-Modus starten, falls noch nicht aktiv
  if (!selectInteraction) {
    initSelectMode(mapInstance, drawLayer);
  } else {
    selectInteraction.setActive(true);
  }

  // 2. Translate an die Features des Select-Modus koppeln!
  translateInteraction = new Translate({
    // 💡 HIER DER TRICK: Statt 'layers: [drawLayer]' nutzen wir die Features der Auswahl!
    features: selectInteraction.getFeatures() 
  });

  // Metriken nach dem Verschieben für ALLE bewegten Objekte updaten
  translateInteraction.on('translateend', function (e) {
    const translatedFeatures = e.features.getArray();
    translatedFeatures.forEach(feature => {
      calculateMetrics(feature); 
    });
    // Tabelle live aktualisieren, falls offen
    if (typeof updateTableFromVisibleLayers === 'function') {
      updateTableFromVisibleLayers(mapInstance);
    }
    console.log(`${translatedFeatures.length} Objekt(e) erfolgreich verschoben.`);
  });

  mapInstance.addInteraction(translateInteraction);
  return;
  
}


  // ==========================================
  // Fall C: Normales Zeichnen (Point, Line, Polygon...)
  // ==========================================
  if (modifyInteraction) modifyInteraction.setActive(true);
  
  drawInteraction = new Draw({
    source: drawSource,
    type: type,
  });

  drawInteraction.on('drawend', function (event) {
    const feature = event.feature;
    
    // 💡 1. Eine absolut eindeutige ID generieren (Kombination aus Zeitstempel & Zufall)
    const eindeutigeId = `draw_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    // 💡 2. Für OpenLayers intern setzen (wichtig für interne Suchen)
    feature.setId(eindeutigeId);
    
    // 💡 3. In die Attribute schreiben (wichtig für deinen GeoJSON-Export!)
    feature.set('id', eindeutigeId);
    feature.set('erstellt_am', new Date().toISOString().slice(0, 10));
    feature.set('zeichnentyp', type); // Speichert z.B. 'Polygon' oder 'Point' im Datensatz

    // 4. Metriken berechnen (Fläche, UTM-Koordinaten etc.)
    calculateMetrics(feature);
    
    console.log(`Neues Objekt gezeichnet. ID vergeben: ${eindeutigeId}`);
  });

  mapInstance.addInteraction(drawInteraction);
  snapInteraction = new Snap({ source: drawSource });
  mapInstance.addInteraction(snapInteraction);
}
// 💡 NEU: Zentrale Hilfsfunktion zur Berechnung von Länge, Fläche und Typ
export function calculateMetrics(feature) {
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

// Prüft ob der Nutzer im Zeichen- ODER Verschiebe-Modus ist
export function isDrawingActive() {
  const drawActive = !!(drawInteraction && drawInteraction.getActive());
  const translateActive = !!(translateInteraction && translateInteraction.getActive());
  
  return drawActive || translateActive;
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
    if (translateInteraction) { translateInteraction.setActive(false); mapInstance.removeInteraction(translateInteraction);   }
    if (selectInteraction) { selectInteraction.getFeatures().clear();   mapInstance.removeInteraction(selectInteraction);  }
    
    
    drawInteraction = null;
    snapInteraction = null;
    deleteInteraction = null; // 💡 NEU
    translateInteraction = null; // 💡 NEU
    selectInteraction = null;
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

  const format = new GeoJSON();
  const geoJsonString = format.writeFeatures(drawSource.getFeatures(), {
    featureProjection: 'EPSG:3857',
    dataProjection: 'EPSG:4326'
  });

  const timestamp = new Date().toISOString().slice(0, 10);
  
  if ('showSaveFilePicker' in window) {

  // Konfiguration für den Windows-Dialog
  const options = {
    suggestedName: `karte_zeichnungen_${timestamp}.geojson`,
    types: [{
      description: 'GeoJSON-Datei',
      accept: { 'application/json': ['.geojson', '.json'] }
    }]
  };

  // 💡 Die "FileReader"-Entsprechung mit .then() statt async/await:
  window.showSaveFilePicker(options)
    .then((fileHandle) => {
      // 1. Datei-Zugriff erfolgreich geöffnet, jetzt "Writer" erstellen
      return fileHandle.createWritable();
    })
    .then((writer) => {
      // 2. Hier haben wir unseren "Writer" (Pendant zum Reader)
      // Wir schreiben den String hinein und schließen den Stream danach
      writer.write(geoJsonString)
        .then(() => writer.close())
        .then(() => {
          console.log("Datei erfolgreich über Windows-Dialog geschrieben!");
        });
    })
    .catch((err) => {
      // Fehlerbehandlung (z.B. wenn der Nutzer "Abbrechen" klickt)
      if (err.name === 'AbortError') {
        console.log("Nutzer hat den Speichern-Dialog abgebrochen.");
      } else {
        console.error("Fehler beim Schreibvorgang:", err);
      }
    });

     
  } else {
   // Blob-Download als Fallback
   const timestamp = new Date().toISOString().slice(0,10);

  const blob = new Blob(
    [geoJsonString],
    { type: 'application/json' }
  );

  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `karte_zeichnungen_${timestamp}.geojson`;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);
  }
}


// Füge das in deine myDraw.js ein und exportiere es:
export function istZeichenleisteAktiv() {
  const drawBar = document.getElementById('draw-bar'); // 💡 Passe die ID an deine HTML-Zeichenleiste an
  
  if (!drawBar) return false;
  
  // Prüft, ob die Leiste im CSS NICHT auf "none" steht und NICHT die Klasse "hidden" hat
  return drawBar.style.display !== 'none' && !drawBar.classList.contains('hidden');
}

export function deleteSelectedFeatures() {
  if (selectInteraction) {
    // Hole das Array aller aktuell ausgewählten Features
    const selectedFeatures = selectInteraction.getFeatures().getArray();
    
    if (selectedFeatures.length === 0) {
      alert("Bitte wähle zuerst Objekte mit STRG + Klick aus!");
      return;
    }

    if (confirm(`Möchtest du die ${selectedFeatures.length} ausgewählten Objekte wirklich löschen?`)) {
      // In umgekehrter Reihenfolge löschen, da sich das Array beim Löschen verändert
      for (let i = selectedFeatures.length - 1; i >= 0; i--) {
        drawSource.removeFeature(selectedFeatures[i]);
      }
      
      // Auswahl-Array wieder leeren
      selectInteraction.getFeatures().clear();
      
      // Tabelle aktualisieren
      updateTableFromVisibleLayers(mapInstance);
    }
  }
}


import { click, platformModifierKeyOnly } from 'ol/events/condition';
function initSelectMode(mapInstance, drawLayer) {
  selectInteraction = new Select({
    layers: [drawLayer], // Nur Objekte auf dem drawLayer auswählbar
    style: selectStyle,  // 💡 Der optische Style für ausgewählte Objekte
    // multi: true,      // Erlaubt das Auswählen mehrerer überlappender Objekte per Klick
    
    // 💡 Das Geheimnis für STRG + Klick:
    toggleCondition: platformModifierKeyOnly 
  });

  mapInstance.addInteraction(selectInteraction);
}