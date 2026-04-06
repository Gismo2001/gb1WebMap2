import LayerSwitcher from 'ol-ext/control/LayerSwitcher';
import Bar from 'ol-ext/control/Bar';
import EditBar from 'ol-ext/control/EditBar';
import TextButton from 'ol-ext/control/TextButton';
import Button from 'ol-ext/control/Button';
import Toggle from 'ol-ext/control/Toggle';

export function createLayerSwitcher() {
  return new LayerSwitcher(
    {
   activationMode: 'click', 
  reverse: true, 
  trash: true, 
  tipLabel: 'Legende',
  onchangeCheck: function(layer, checked) {
     // console.log('Layer:', layer);  // Das gesamte Layer-Objekt
      //console.log('Layer Name:', layer.get('name')); // Den Namen des Layers abrufen

      if (checked) {
      //    console.log('Layer wurde aktiviert:', layer.get('name'));
          // Hier  weitere Aktionen
      } else {
         // console.log('Layer wurde deaktiviert:', layer.get('name'));
          // Hier weitere Aktionen
      }
  }
  }
);
}

export function createMainToolbar(map) {

  const bar = new Bar();

  // 🔘 einfacher Button
  const zoomToExtentBtn = new Button({
    html: '🏠',
    title: 'Zoom to extent',
    handleClick: function () {
      map.getView().fit([0, 0, 1000000, 1000000]); // Beispiel!
    }
  });

  // 🔘 Toggle Button
  const toggleBtn = new Toggle({
    html: '⚙️',
    title: 'Toggle Beispiel',
    onToggle: function (active) {
      console.log('Toggle:', active);
    }
  });

  // 🔘 TextButton
  const textBtn = new TextButton({
    html: 'Info',
    title: 'Info anzeigen',
    handleClick: function () {
      alert('Info Button geklickt');
    }
  });

  // Buttons zur Bar hinzufügen
  bar.addControl(zoomToExtentBtn);
  bar.addControl(toggleBtn);
  bar.addControl(textBtn);

  return bar;
}