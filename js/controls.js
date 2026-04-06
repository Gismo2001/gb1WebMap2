import LayerSwitcher from 'ol-ext/control/LayerSwitcher';
import Bar from 'ol-ext/control/Bar';
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

  // 🔘 Toggle Button1
    const toggleBtn1 = new Toggle({
    html: '🏠',
    title: 'Toggle Button 1',
    bar: createSubBar3(),
    onToggle: function (active) {
        if (active) { 
          console.log('Toggle1 aktiviert');
          toggleBtn2.setActive(false); // Deaktiviert Toggle Button 2
          toggleBtn3.setActive(false); // Deaktiviert Toggle Button 3
        } else {
          console.log('Toggle1 deaktiviert');
        } 
    }
  });

  // 🔘 Toggle Button2
  const toggleBtn2 = new Toggle({
    html: '⚙️',
    title: 'Toggle Button 2',
    onToggle: function (active) {
      if (active) { 
          console.log('Toggle2 aktiviert');
          toggleBtn1.setActive(false); // Deaktiviert Toggle Button 1
          toggleBtn3.setActive(false); // Deaktiviert Toggle Button 3

        } else {
          console.log('Toggle2 deaktiviert');
        } 
    }
  });

  // 🔘 Toggle Button3
  const toggleBtn3 = new Toggle({
    html: '⚙️',
    title: 'Toggle Button 3',
    onToggle: function (active) {
      if (active) { 
          console.log('Toggle3 aktiviert');
          toggleBtn1.setActive(false); // Deaktiviert Toggle Button 1
          toggleBtn2.setActive(false); // Deaktiviert Toggle Button 2
        } else {
          console.log('Toggle3 deaktiviert');
        } 
    }
  });


  // Buttons zur Bar hinzufügen
  
  bar.addControl(toggleBtn1);
  bar.addControl(toggleBtn2);
  bar.addControl(toggleBtn3);


  return bar;
}

export function createSubBar3() {
  const bar = new Bar({
    toggleOne: true,
    controls: [
      // Tabelle anzeigen
      new Toggle({
        html: '<i class="fa fa-table" aria-hidden="true"></i>',
        title: "Tabelle anzeigen",
        onToggle: function (active) {}
      })
    ]
  });
  return bar;
};

