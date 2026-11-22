import { unByKey } from 'ol/Observable';
import { Draw } from 'ol/interaction';
import LineString from 'ol/geom/LineString';
import Polygon from 'ol/geom/Polygon';
import Point from 'ol/geom/Point';
import Feature from 'ol/Feature';
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
  const supportPointsCheckbox = document.getElementById('show-measurement-support-points');
  const segmentLengthsCheckbox = document.getElementById('show-measurement-segment-lengths');
  const status = document.getElementById('measurement-status');
  const overlay = document.getElementById('sidebar-overlay');
  const photoSidebar = document.getElementById('mobile-sidebar');
  const source = new VectorSource();
  supportPointsCheckbox.checked =
    localStorage.getItem('measurement-support-points') === 'true';
  const storedSegmentLengths = localStorage.getItem('measurement-segment-lengths');
  segmentLengthsCheckbox.checked = storedSegmentLengths === 'true';
  const measureOverlays = [];
  let segmentTooltipOverlays = [];
  let drawInteraction = null;
  let sketch = null;
  let helpTooltipElement = null;
  let helpTooltip = null;
  let measureTooltipElement = null;
  let measureTooltip = null;
  let measureGeometryListener = null;
  let temporarySupportPointFeatures = [];

  const measurementStyle = new Style({
    fill: new Fill({ color: 'rgba(144, 202, 249, 0.35)' }),
    stroke: new Stroke({ color: 'rgba(0, 0, 0, 0.5)', lineDash: [10, 10], width: 2 }),
    image: new CircleStyle({
      radius: 5,
      stroke: new Stroke({ color: 'rgba(0, 0, 0, 0.7)' }),
      fill: new Fill({ color: 'rgba(255, 255, 255, 0.2)' })
    })
  });

  segmentLengthsCheckbox.addEventListener('change', () => {
    localStorage.setItem(
      'measurement-segment-lengths',
      segmentLengthsCheckbox.checked ? 'true' : 'false'
    );
    [...measureOverlays, ...segmentTooltipOverlays].forEach((tooltip) => {
      const element = tooltip.getElement();
      if (element.classList.contains('ol-tooltip-segment')) {
        element.classList.toggle(
          'measurement-segments-hidden',
          !segmentLengthsCheckbox.checked
        );
      }
    });
  });
  const orthogonalSnapStyle = new Style({
    fill: measurementStyle.getFill(),
    stroke: new Stroke({ color: 'rgba(0, 0, 0, 0.7)', width: 2 }),
    image: measurementStyle.getImage()
  });
  const supportPointStyle = new Style({
    image: new CircleStyle({
      radius: 5,
      stroke: new Stroke({ color: 'rgba(0, 0, 0, 0.9)', width: 2 }),
      fill: new Fill({ color: 'rgba(144, 202, 249, 0.35)' })
    })
  });
  let orthogonalSnapActive = false;

  const measurementLayer = new VectorLayer({
    source,
    title: 'Messungen',
    name: 'Messungen',
    displayInLayerSwitcher: false,
    style: (feature) => feature.get('isMeasurementSupportPoint')
      ? supportPointStyle
      : measurementStyle
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

  function addSupportPoints(geometry) {
    if (!supportPointsCheckbox.checked) return;

    let coordinates;
    if (geometry instanceof Polygon) {
      coordinates = geometry.getCoordinates()[0];
    } else if (geometry instanceof LineString) {
      coordinates = geometry.getCoordinates();
    } else {
      return;
    }

    coordinates.forEach((coordinate, index) => {
      if (
        index > 0
        && coordinates[index - 1][0] === coordinate[0]
        && coordinates[index - 1][1] === coordinate[1]
      ) {
        return;
      }

      const supportPoint = new Feature(new Point(coordinate.slice()));
      supportPoint.set('isMeasurementSupportPoint', true);
      source.addFeature(supportPoint);
    });
  }

  function clearTemporarySupportPoints() {
    temporarySupportPointFeatures.forEach((feature) => source.removeFeature(feature));
    temporarySupportPointFeatures = [];
  }

  function updateTemporarySupportPoints(geometry) {
    clearTemporarySupportPoints();
    if (!supportPointsCheckbox.checked) return;

    let coordinates;
    if (geometry instanceof Polygon) {
      const ring = geometry.getCoordinates()[0];
      coordinates = ring.length > 2 ? ring.slice(0, -2) : ring.slice(0, -1);
    } else if (geometry instanceof LineString) {
      coordinates = geometry.getCoordinates().slice(0, -1);
    } else {
      return;
    }

    const uniqueCoordinates = [];
    coordinates.forEach((coordinate) => {
      if (!uniqueCoordinates.some((existing) =>
        existing[0] === coordinate[0] && existing[1] === coordinate[1]
      )) {
        uniqueCoordinates.push(coordinate);
      }
    });

    uniqueCoordinates.forEach((coordinate) => {
      const supportPoint = new Feature(new Point(coordinate.slice()));
      supportPoint.set('isMeasurementSupportPoint', true);
      source.addFeature(supportPoint);
      temporarySupportPointFeatures.push(supportPoint);
    });
  }

  supportPointsCheckbox.addEventListener('change', () => {
    localStorage.setItem(
      'measurement-support-points',
      supportPointsCheckbox.checked ? 'true' : 'false'
    );
    if (supportPointsCheckbox.checked) {
      if (sketch) updateTemporarySupportPoints(sketch.getGeometry());
      return;
    }
    clearTemporarySupportPoints();
    source.getFeatures().slice().forEach((feature) => {
      if (feature.get('isMeasurementSupportPoint')) {
        source.removeFeature(feature);
      }
    });
  });

  function createSegmentTooltip() {
    const element = document.createElement('div');
    element.className = 'ol-tooltip ol-tooltip-segment';
    element.classList.toggle('measurement-segments-hidden', !segmentLengthsCheckbox.checked);
    const segmentTooltip = new Overlay({
      element,
      offset: [0, -6],
      positioning: 'bottom-center',
      stopEvent: false,
      insertFirst: false
    });
    map.addOverlay(segmentTooltip);
    return segmentTooltip;
  }

  function updateSegmentTooltips(polygon) {
    const ring = polygon.getCoordinates()[0];
    const coordinates = ring.slice();

    while (
      coordinates.length > 1
      && coordinates[coordinates.length - 1][0] === coordinates[0][0]
      && coordinates[coordinates.length - 1][1] === coordinates[0][1]
    ) {
      coordinates.pop();
    }

    if (coordinates.length > 2) {
      coordinates.push(coordinates[0].slice());
    }

    const segmentCount = coordinates.length - 1;

    while (segmentTooltipOverlays.length < segmentCount) {
      segmentTooltipOverlays.push(createSegmentTooltip());
    }
    while (segmentTooltipOverlays.length > segmentCount) {
      map.removeOverlay(segmentTooltipOverlays.pop());
    }

    const projection = map.getView().getProjection();
    for (let index = 0; index < segmentCount; index += 1) {
      const start = coordinates[index];
      const end = coordinates[index + 1];
      const line = new LineString([start, end]);
      const length = getLength(line, { projection });
      const tooltip = segmentTooltipOverlays[index];
      const element = tooltip.getElement();

      element.textContent = formatDistance(line);
      element.classList.toggle('measurement-segments-hidden', !segmentLengthsCheckbox.checked);
      element.classList.toggle('hidden', length < 0.01);
      tooltip.setPosition([
        (start[0] + end[0]) / 2,
        (start[1] + end[1]) / 2
      ]);
    }
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
      updateSegmentTooltips(geometry);
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
  map.getViewport().addEventListener('contextmenu', (event) => {
    if (!drawInteraction || !map.get('measurementDrawingActive')) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    if (!sketch || event.button !== 2) return;

    const geometry = sketch.getGeometry();
    const coordinates = geometry instanceof Polygon
      ? geometry.getCoordinates()[0]
      : geometry.getCoordinates();
    if (coordinates.length <= 2) {
      status.textContent = 'Der erste Messpunkt kann nicht gelöscht werden.';
      return;
    }

    drawInteraction.removeLastPoint();
  }, true);

  function stopDrawing() {
    clearTemporarySupportPoints();
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
    segmentTooltipOverlays.forEach((tooltip) => map.removeOverlay(tooltip));
    segmentTooltipOverlays = [];
    sketch = null;
    orthogonalSnapActive = false;
    helpTooltipElement.classList.add('hidden');
    map.set('measurementDrawingActive', false);
    setActiveButton(null);
  }

  function hidePanel() {
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    if (!photoSidebar.classList.contains('open')) overlay.classList.remove('active');
  }

  function showPanel() {
    photoSidebar.classList.remove('open');
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    overlay.classList.add('active');
  }

  function startDrawing(type, activeButton) {
    stopDrawing();
    setActiveButton(activeButton);
    map.set('measurementDrawingActive', true);
    status.textContent = type === 'LineString'
      ? 'Klicke mehrere Punkte. Nahe 0°/180° oder 90° rastet die Strecke ein; Doppelklick beendet die Strecke.'
      : 'Klicke die Eckpunkte. Nahe 0°/180° oder 90° rastet die Kante ein; Doppelklick beendet die Fläche.';
    hidePanel();

    drawInteraction = new Draw({
      source,
      type,
      condition: (event) => event.originalEvent.button === 0,
      geometryFunction: (coordinates, geometry) => {
        const points = type === 'Polygon' ? coordinates[0] : coordinates;
        orthogonalSnapActive = false;
        if (type === 'Polygon' && points.length >= 4) {
          const first = points[0];
          const anchor = points[points.length - 2];
          const cursor = points[points.length - 1];
          const snapAngle = 2 * Math.PI / 180;

          function angleDistance(vectorX, vectorY, targetAngle) {
            const length = Math.hypot(vectorX, vectorY);
            if (length === 0) return Infinity;
            const angle = Math.atan2(vectorY, vectorX);
            return Math.abs(Math.atan2(
              Math.sin(angle - targetAngle),
              Math.cos(angle - targetAngle)
            ));
          }

          const firstToCursorX = cursor[0] - first[0];
          const firstToCursorY = cursor[1] - first[1];
          const anchorToCursorX = cursor[0] - anchor[0];
          const anchorToCursorY = cursor[1] - anchor[1];

          const candidateOne = [first[0], anchor[1]];
          const candidateTwo = [anchor[0], first[1]];

          let rectangleCandidate = null;
          const candidateOneErrorFromFirst =
            angleDistance(firstToCursorX, firstToCursorY, Math.PI / 2);
          const candidateOneErrorFromAnchor =
            angleDistance(anchorToCursorX, anchorToCursorY, 0);
          const candidateTwoErrorFromFirst =
            angleDistance(firstToCursorX, firstToCursorY, 0);
          const candidateTwoErrorFromAnchor =
            angleDistance(anchorToCursorX, anchorToCursorY, Math.PI / 2);
          const cursorPixel = map.getPixelFromCoordinate(cursor);
          const snapDistancePixels = 12;

          function isWithinSnapDistance(candidate) {
            const candidatePixel = map.getPixelFromCoordinate(candidate);
            return cursorPixel
              && candidatePixel
              && Math.hypot(
                candidatePixel[0] - cursorPixel[0],
                candidatePixel[1] - cursorPixel[1]
              ) <= snapDistancePixels;
          }

          if (
            candidateOneErrorFromFirst <= snapAngle
            && candidateOneErrorFromAnchor <= snapAngle
            && isWithinSnapDistance(candidateOne)
          ) {
            rectangleCandidate = candidateOne;
          }
          if (
            candidateTwoErrorFromFirst <= snapAngle
            && candidateTwoErrorFromAnchor <= snapAngle
            && isWithinSnapDistance(candidateTwo)
            && (
              candidateTwoErrorFromFirst + candidateTwoErrorFromAnchor
              < candidateOneErrorFromFirst + candidateOneErrorFromAnchor
            )
          ) {
            rectangleCandidate = candidateTwo;
          }

          if (rectangleCandidate) {
            cursor[0] = rectangleCandidate[0];
            cursor[1] = rectangleCandidate[1];
            orthogonalSnapActive = true;
          }
        }

        if (orthogonalSnapActive) {
          // Rechteck-Eckpunkt wurde bereits eingerastet.
        } else if (points.length === 2) {
          const first = points[0];
          const cursor = points[1];
          const movementX = cursor[0] - first[0];
          const movementY = cursor[1] - first[1];
          const movementLength = Math.hypot(movementX, movementY);

          if (movementLength > 0) {
            const angleFromHorizontal = Math.atan2(movementY, movementX) * 180 / Math.PI;
            const normalizedAngle = ((angleFromHorizontal % 180) + 180) % 180;
            const horizontalDistance = Math.min(normalizedAngle, 180 - normalizedAngle);
            const verticalDistance = Math.abs(normalizedAngle - 90);

            if (horizontalDistance <= 2) {
              cursor[1] = first[1];
              orthogonalSnapActive = true;
            } else if (verticalDistance <= 2) {
              cursor[0] = first[0];
              orthogonalSnapActive = true;
            }
          }
        } else if (points.length >= 3) {
          const previous = points[points.length - 3];
          const anchor = points[points.length - 2];
          const cursor = points[points.length - 1];
          const directionX = anchor[0] - previous[0];
          const directionY = anchor[1] - previous[1];
          const movementX = cursor[0] - anchor[0];
          const movementY = cursor[1] - anchor[1];
          const directionLength = Math.hypot(directionX, directionY);
          const movementLength = Math.hypot(movementX, movementY);

          if (directionLength > 0 && movementLength > 0) {
            const cosine = Math.abs(
              (directionX * movementX + directionY * movementY)
              / (directionLength * movementLength)
            );
            if (cosine <= Math.sin(2 * Math.PI / 180)) {
              const perpendicularX = -directionY / directionLength;
              const perpendicularY = directionX / directionLength;
              const distance = movementX * perpendicularX + movementY * perpendicularY;
              cursor[0] = anchor[0] + distance * perpendicularX;
              cursor[1] = anchor[1] + distance * perpendicularY;
              orthogonalSnapActive = true;
            } else if (cosine >= Math.cos(2 * Math.PI / 180)) {
              const projectionDistance =
                (movementX * directionX + movementY * directionY)
                / directionLength;
              cursor[0] = anchor[0] + projectionDistance * directionX / directionLength;
              cursor[1] = anchor[1] + projectionDistance * directionY / directionLength;
              orthogonalSnapActive = true;
            }
          }
        }

        if (type === 'Polygon') {
          if (!geometry) geometry = new Polygon(coordinates);
          else geometry.setCoordinates(coordinates);
        } else if (!geometry) {
          geometry = new LineString(coordinates);
        } else {
          geometry.setCoordinates(coordinates);
        }
        return geometry;
      },
      style: (feature) => {
        const geometryType = feature.getGeometry().getType();
        return geometryType === type || geometryType === 'Point'
          ? (orthogonalSnapActive ? orthogonalSnapStyle : measurementStyle)
          : undefined;
      }
    });

    drawInteraction.on('drawstart', (event) => {
      sketch = event.feature;
      createMeasureTooltip();
      measureGeometryListener = sketch.getGeometry().on('change', (geometryEvent) => {
        updateMeasureTooltip(geometryEvent.target);
        updateTemporarySupportPoints(geometryEvent.target);
      });
      updateTemporarySupportPoints(sketch.getGeometry());
    });

    drawInteraction.on('drawend', (event) => {
      const geometry = event.feature.getGeometry();
      const result = geometry instanceof LineString
        ? formatDistance(geometry)
        : formatArea(geometry);
      clearTemporarySupportPoints();
      addSupportPoints(geometry);
      orthogonalSnapActive = false;
      if (geometry instanceof Polygon) {
        updateSegmentTooltips(geometry);
        segmentTooltipOverlays.forEach((tooltip) => {
          tooltip.getElement().classList.add('ol-tooltip-static');
        });
        measureOverlays.push(...segmentTooltipOverlays);
        segmentTooltipOverlays = [];
      }

      measureTooltipElement.className = 'ol-tooltip ol-tooltip-static';
      measureTooltip.setOffset([0, -7]);
      if (drawInteraction) {
        map.removeInteraction(drawInteraction);
        drawInteraction = null;
      }
      setActiveButton(null);
      showPanel();
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
    hidePanel();
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
    openPanel: showPanel,
    closePanel
  };
}
