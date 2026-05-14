import Chart from 'chart.js/auto';
import { Draw } from 'ol/interaction.js';
import LineString from 'ol/geom/LineString';
import { containsCoordinate } from 'ol/extent.js';
// Importiere die aktiven Layer aus deiner dgmdom.js
import { activeDgmRasterLayers, activeDomRasterLayers } from './dgmdom.js'; 


let profileDraw = null;
export let profileMode = false;
let currentMap = null;

// Diese Funktionen müssen exportiert werden, damit control.js sie nutzen kann
export function enableProfileDrawing(map, source) {
  profileMode = true; // Setzen beim Start
  currentMap = map;
  profileDraw = new Draw({
    source: source,
    type: 'LineString',
  });
    map.addInteraction(profileDraw);
    
    profileDraw.on('drawend', function(evt) {
        const coords = evt.feature.getGeometry().getCoordinates();
        generateElevationProfile(coords);
        // Interaction nach dem Zeichnen entfernen (optional, je nach Wunsch)
        map.removeInteraction(profileDraw);
        profileMode = false
        
    });
}

export function disableProfileDrawing(map) {
  profileMode = false; 
  // 1. Zeichnen-Interaktion entfernen
  if (profileDraw) {
    map.removeInteraction(profileDraw);
    profileDraw = null;
  }

    // 2. Marker-Layer entfernen
    if (markerLayer) {
        map.removeLayer(markerLayer);
        markerLayer = null;
    }

    // 3. Optional: Profil-Fenster schließen (falls gewünscht)
    // Wenn du eine Referenz auf 'win' globaler speicherst, könntest du hier win.close() rufen.
}
function generateElevationProfile(coords) {
    const profile = [];
    let cumulativeDist = 0;
    const activeLayer = [...activeDgmRasterLayers, ...activeDomRasterLayers].find(l => l.getVisible());
    const layerLabel = activeLayer ? activeLayer.get('title') : "Höhe (m)";

    for (let i = 0; i < coords.length - 1; i++) {
        const c1 = coords[i];
        const c2 = coords[i + 1];
        const segmentPoints = getProfilePoints(c1, c2, 5);
        
        for (const p of segmentPoints) {
            const height = getHeightAtCoordinate(p.coord);
            if (height !== null) {
                profile.push({
                    distance: cumulativeDist + p.dist,
                    height: height,
                    coord: p.coord
                });
            }
        }
        const dx = c2[0] - c1[0];
        const dy = c2[1] - c1[1];
        cumulativeDist += Math.sqrt(dx*dx + dy*dy);
    }
    
    if (profile.length > 0) {
        showProfileChart(profile, layerLabel)
    } else {
        alert("Keine Höhendaten gefunden.");
    }
}

// Nutzt deine activeDgmRasterLayers aus dgmdom.js
function getHeightAtCoordinate(coord) {
    if (!currentMap) return null;
    const pixel = currentMap.getPixelFromCoordinate(coord);
    const allRasterLayers = [...activeDgmRasterLayers, ...activeDomRasterLayers];

    for (const layer of allRasterLayers) {
        if (!layer.getVisible()) continue;
        if (layer.bbox && containsCoordinate(layer.bbox, coord)) {
            const data = layer.getData(pixel);
            if (data && !Number.isNaN(data[0]) && data[0] !== -9999) {
                return data[0];
            }
        }
    }
    return null;
}


function updateDgmInteraction() {
  const kachelnVisible = dgmKachelLayer.getVisible();
  if (kachelnVisible) {
    // Höhenanzeige deaktivieren
    if (dgmPointerMoveListener) {
      unByKey(dgmPointerMoveListener);
      dgmPointerMoveListener = null;
    }
   
  } else {
    // Höhenanzeige aktivieren
    if (!ismobile && !dgmPointerMoveListener) {
      dgmPointerMoveListener = map.on('pointermove', handleDgmPointerMove);
    }
   
  }
}

function lineIntersectsAnyDgm(coord1, coord2) {

  const lineExtent = boundingExtent([coord1, coord2]);

  for (const layer of activeDgmRasterLayers) {

    if (!layer.getVisible()) continue;

    if (!layer.bbox) continue;

    if (intersects(lineExtent, layer.bbox)) {
      return true;
    }

  }

  return false;
}

function getProfilePoints(coord1, coord2, step = 5) {
  const line = new LineString([coord1, coord2]);
  const length = line.getLength();
  const points = [];
  for (let d = 0; d <= length; d += step) {
    const coord = line.getCoordinateAt(d / length);
    points.push({coord, dist: d});
  }
  return points;
}

function showProfileChart(profile, layerlabel) {
  
    // 1. Daten vorbereiten
    const distances = profile.map(p => p.distance.toFixed(2));
    const heights = profile.map(p => p.height.toFixed(2));
    const coords = profile.map(p => p.coord);

    // 2. Welcher Modus ist aktiv? (Priorität auf DOM, falls beide an sind)
    const isDom = activeDomRasterLayers.some(l => l.getVisible());
    const title = isDom ? "Höhenprofil (Digitales Oberflächenmodell)" : "Höhenprofil (Digitales Geländemodell)";
    const color = isDom ? 'rgba(255, 159, 64, 1)' : 'rgba(75, 192, 192, 1)'; // Orange für DOM, Türkis für DGM

    // 3. Fenster öffnen
    const win = window.open("", "Höhenprofil", "width=800,height=500");
    if (!win) return;
    win.Chart = window.Chart; 
// Falls du jQuery nutzt, auch das rübergeben:
win.jQuery = window.jQuery;
win.$ = window.$;
// Auch deine addMarker Funktion muss für das Fenster erreichbar sein
win.addMarker = addMarker;
  win.document.body.innerHTML = `
    <style>
      html, body {height:100%; margin:0;font-family:sans-serif;display:flex;flex-direction:column;}
      #chartContainer {flex:1;position:relative;}
      canvas { width:100% !important; height:100% !important;}
    </style>
    <h3 style="margin:10px">Höhenprofil</h3>
    <div id="chartContainer"> <canvas id="chart"></canvas> </div>
    <div id="controls">
      <button id="exportCsvBtn">CSV exportieren</button>
      <button id="addHorizontalBtn">Horizontale</button>
    </div>
    `;
  
  const ctx = win.document.getElementById("chart").getContext("2d");
  const container = win.document.getElementById("chartContainer");

  
  function resizeChartContainer(){
    const headerHeight = 60;
    const controlsHeight = 60;
    container.style.height = (win.innerHeight - headerHeight - controlsHeight) + "px";
  }
  resizeChartContainer();

  const chart = new win.Chart(ctx, {
  
    type: "line",
        data: {
            labels: distances,
            datasets: [{
                label: isDom ? "DOM Höhe (m)" : "DGM Höhe (m)",
                data: heights,
                borderColor: color,
                backgroundColor: color.replace('1)', '0.2)'),
                borderWidth: 2,
                fill: true,
                tension: 0.1,
                pointRadius: 0
            }]
        },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'nearest', intersect: false },
      onHover: function(event, elements) {
          if (elements.length > 0) {
              const index = elements[0].index;
              const coord = coords[index];
              // Rufe die Funktion über das Fenster-Objekt auf
              if (typeof win.addMarker === 'function') {
                  win.addMarker(coord);
              }
          } else {
              // Marker entfernen wenn die Maus nicht über einem Punkt ist
              if (typeof win.addMarker === 'function') {
                  win.addMarker(null);
              }
          }
      },
      scales: {
        x: { title: { display:true, text:"Distanz (m)" }},
        y: { title: { display:true, text:"Höhe (m)" }}
      }
    }
  });
  win.addEventListener("resize", () => {
    resizeChartContainer(); 
    if (chart) chart.resize(); 
});

  // CSV Export
  win.document.getElementById("exportCsvBtn").onclick = function(){
    let csv = "data:text/csv;charset=utf-8,Distanz;Hoehe\n";
    for(let i=0;i<profile.length;i++){
      const dist = distances[i].replace(".",",");
      const height = heights[i].replace(".",",");
      csv += dist + ";" + height + "\n";
    }
    const uri = encodeURI(csv);
    const link = win.document.createElement("a");
    link.setAttribute("href", uri);
    link.setAttribute("download","hoehenprofil.csv");
    win.document.body.appendChild(link);
    link.click();
    win.document.body.removeChild(link);
  };

  win.document.getElementById("addHorizontalBtn").onclick = function() {
    const value = win.prompt("Höhe für horizontale Linie (m):");
    if (value === null) return;
    const h = parseFloat(value);
    if (isNaN(h)) {
      win.alert("Bitte eine gültige Zahl eingeben.");
      return;
    }
    const horizontalData = new Array(distances.length).fill(h);
    chart.data.datasets.push({
      label: "Horizontale " + h + " m",
      data: horizontalData,
      borderColor: `hsl(${Math.random() * 360}, 70%, 50%)`,
      borderWidth: 3,
      borderDash: [6,6],
      pointRadius: 0,
      fill: false
    });
    chart.update();
  };
 win.onbeforeunload = () => {
  // 1. Marker aufräumen
  if (markerLayer && currentMap) {
    markerLayer.getSource().clear();
    currentMap.removeLayer(markerLayer);
    markerLayer = null; // Sicher, da addMarker ihn neu erstellt
  }

  // 2. Profil-Linie auf der Karte aufräumen
  if (profileLayer) {
    profileSource.clear(); 
    profileLayer.setVisible(false);
    currentMap.removeLayer(profileLayer);
  }
  
  // 3. Status zurücksetzen
  profileMode = false;
};
}

// In chart.js (außerhalb oder innerhalb von showProfileChart)

import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { Vector as VectorLayer } from 'ol/layer';
import { Vector as VectorSource } from 'ol/source';
import { Style, Icon } from 'ol/style';

// Globale Variable für den Marker-Layer in chart.js
let markerLayer = null;

export function addMarker(coord) {
    if (!currentMap) return;

    // Erstelle den Layer falls er nicht existiert
    if (!markerLayer) {
        markerLayer = new VectorLayer({
            source: new VectorSource(),
            // Optional: Style für den Marker (z.B. ein blauer Punkt oder Icon)
            style: new Style({
                image: new Icon({
                    anchor: [0.5, 1],
                    src: 'https://openlayers.org/en/latest/examples/data/icon.png',
                    scale: 0.5
                })
            })
        });
        currentMap.addLayer(markerLayer);
    }

    const source = markerLayer.getSource();
    source.clear(); // Alten Marker entfernen

    if (coord) {
        const feature = new Feature({
            geometry: new Point(coord)
        });
        source.addFeature(feature);
    }
}
