import { unByKey } from 'ol/Observable';
import { Draw } from 'ol/interaction';
import LineString from 'ol/geom/LineString';
import Polygon from 'ol/geom/Polygon';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { getArea, getLength } from 'ol/sphere';
import { Circle as CircleStyle, Fill, Stroke, Style } from 'ol/style';
import Overlay from 'ol/Overlay';

export function initMobileMeasurements(map) {
  const panel = document.getElementById('measurement-panel');
  const closePanelBtn = document.getElementById('close-measurement-panel-btn');
  const distanceBtn = document.getElementById('measure-distance-btn');
  const areaBtn = document.getElementById('measure-area-btn');
  const clearBtn = document.getElementById('clear-measurements-btn');
  const status = document.getElementById('measurement-status');
  const source = new VectorSource();
  const measureOverlays = [];
  let drawInteraction = null;
  let sketch = null;
  let helpTooltipElement = null;
  let helpTooltip = null;
  let measureTooltipElement = null;
  let measureTooltip = null;
  let measureGeometryListener = null;

  const measurementStyle = new Style({
    fill: new Fill({ color: 'rgba(144, 202, 249, 0.35)' }),
    stroke: new Stroke({ color: 'rgba(0, 0, 0, 0.5)', lineDash: [10, 10], width: 2 }),
    image: new CircleStyle({
      radius: 5,
      stroke: new Stroke({ color: 'rgba(0, 0, 0, 0.7)' }),
      fill: new Fill({ color: 'rgba(255, 255, 255, 0.2)' })
    })
  });

  const measurementLayer = new VectorLayer({
    source,
    title: 'Messungen',
    name: 'Messungen',
    displayInLayerSwitcher: false,
    style: measurementStyle
  });
  measurementLayer.set('isMeasurementLayer', true);
  map.addLayer(measurementLayer);

  function setActiveButton(activeButton) {
    [distanceBtn, areaBtn].forEach((button) => {
      const active = button === activeButton;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function rounded(value) {
    return (Math.round(value * 100) / 100).toLocaleString('de-DE', {
      maximumFractionDigits: 2
    });
  }

  function formatDistance(line) {
    const length = getLength(line, { projection: map.getView().getProjection() });
    return length > 100 ? `${rounded(length / 1000)} km` : `${rounded(length)} m`;
  }

  function formatArea(polygon) {
    const area = getArea(polygon, { projection: map.getView().getProjection() });
    return area > 10000
      ? `${rounded(area / 1000000)} km²`
      : `${rounded(area)} m²`;
  }

  function createHelpTooltip() {
    helpTooltipElement = document.createElement('div');
    helpTooltipElement.className = 'ol-tooltip hidden';
    helpTooltip = new Overlay({
      element: helpTooltipElement,
      offset: [15, 0],
      positioning: 'center-left',
      stopEvent: false
    });
    map.addOverlay(helpTooltip);
  }

  function createMeasureTooltip() {
    measureTooltipElement = document.createElement('div');
    measureTooltipElement.className = 'ol-tooltip ol-tooltip-measure';
    measureTooltip = new Overlay({
      element: measureTooltipElement,
      offset: [0, -15],
      positioning: 'bottom-center',
      stopEvent: false,
      insertFirst: false
    });
    map.addOverlay(measureTooltip);
  }

  function updateMeasureTooltip(geometry) {
    let output;
    let coordinate;

    if (geometry instanceof Polygon) {
      output = formatArea(geometry);
      coordinate = geometry.getInteriorPoint().getCoordinates().slice(0, 2);
    } else if (geometry instanceof LineString) {
      output = formatDistance(geometry);
      coordinate = geometry.getLastCoordinate();
    } else {
      return;
    }

    measureTooltipElement.textContent = output;
    measureTooltip.setPosition(coordinate);
    status.textContent = `Aktuelle Messung: ${output}`;
  }

  function handlePointerMove(event) {
    if (!drawInteraction || event.dragging) {
      helpTooltipElement.classList.add('hidden');
      return;
    }

    let message = 'Klicke, um die Messung zu starten.';
    if (sketch) {
      const geometry = sketch.getGeometry();
      if (geometry instanceof Polygon) {
        message = 'Klicke, um die Fläche weiterzuzeichnen.';
      } else if (geometry instanceof LineString) {
        message = 'Klicke, um die Linie weiterzuzeichnen.';
      }
    }

    helpTooltipElement.textContent = message;
    helpTooltip.setPosition(event.coordinate);
    helpTooltipElement.classList.remove('hidden');
    if (sketch) updateMeasureTooltip(sketch.getGeometry());
  }

  createHelpTooltip();
  map.on('pointermove', handlePointerMove);
  map.getViewport().addEventListener('mouseout', () => {
    helpTooltipElement.classList.add('hidden');
  });

  function stopDrawing() {
    if (drawInteraction) {
      map.removeInteraction(drawInteraction);
      drawInteraction = null;
    }
    if (measureGeometryListener) {
      unByKey(measureGeometryListener);
      measureGeometryListener = null;
    }
    if (measureTooltip) {
      map.removeOverlay(measureTooltip);
      measureTooltip = null;
      measureTooltipElement = null;
    }
    sketch = null;
    helpTooltipElement.classList.add('hidden');
    map.set('measurementDrawingActive', false);
    setActiveButton(null);
  }

  function startDrawing(type, activeButton) {
    stopDrawing();
    setActiveButton(activeButton);
    map.set('measurementDrawingActive', true);
    status.textContent = type === 'LineString'
      ? 'Klicke mehrere Punkte. Doppelklick beendet die Strecke.'
      : 'Klicke die Eckpunkte. Doppelklick beendet die Fläche.';

    drawInteraction = new Draw({
      source,
      type,
      style: (feature) => {
        const geometryType = feature.getGeometry().getType();
        return geometryType === type || geometryType === 'Point' ? measurementStyle : undefined;
      }
    });

    drawInteraction.on('drawstart', (event) => {
      sketch = event.feature;
      createMeasureTooltip();
      measureGeometryListener = sketch.getGeometry().on('change', (geometryEvent) => {
        updateMeasureTooltip(geometryEvent.target);
      });
    });

    drawInteraction.on('drawend', (event) => {
      const geometry = event.feature.getGeometry();
      const result = geometry instanceof LineString
        ? formatDistance(geometry)
        : formatArea(geometry);

      measureTooltipElement.className = 'ol-tooltip ol-tooltip-static';
      measureTooltip.setOffset([0, -7]);
      measureOverlays.push(measureTooltip);
      measureTooltip = null;
      measureTooltipElement = null;
      sketch = null;
      if (measureGeometryListener) {
        unByKey(measureGeometryListener);
        measureGeometryListener = null;
      }
      status.textContent = `Messung: ${result}. Du kannst weiter messen.`;
    });

    map.addInteraction(drawInteraction);
  }

  function closePanel() {
    stopDrawing();
    panel.hidden = true;
    status.textContent = 'Messwerkzeug beendet.';
  }

  distanceBtn.addEventListener('click', () => startDrawing('LineString', distanceBtn));
  areaBtn.addEventListener('click', () => startDrawing('Polygon', areaBtn));
  clearBtn.addEventListener('click', () => {
    stopDrawing();
    source.clear();
    measureOverlays.forEach((overlay) => map.removeOverlay(overlay));
    measureOverlays.length = 0;
    status.textContent = 'Alle Messungen wurden gelöscht.';
  });
  closePanelBtn.addEventListener('click', closePanel);

  return {
    openPanel() {
      panel.hidden = false;
    },
    closePanel
  };
}
