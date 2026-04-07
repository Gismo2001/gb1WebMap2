import LayerSwitcher from 'ol-ext/control/LayerSwitcher';
import Bar from 'ol-ext/control/Bar';
import Toggle from 'ol-ext/control/Toggle';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import 'tabulator-tables/dist/css/tabulator.min.css';


export function createLayerSwitcher() {
  return new LayerSwitcher(
    {
  activationMode: 'click', 
  reverse: true, 
  trash: true, 
  tipLabel: 'Legende',
  onchangeCheck: function(layer, checked) {
  
      if (checked) {
      } else {
      }
  }
  }
);
}

export function createMainToolbar(map) {

  const bar = new Bar();

  // 🔘 Toggle Button1
    const toggleBtn1 = new Toggle({
    html: "I",
    title: 'Toggle Button 1',
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
    html: 'W',
    title: 'Dateien',
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
    html: 'T',
    title: 'Tabelle',
    bar: createSubBar3(),
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
  // 👉 Position setzen
  bar.setPosition('bottom-left');
  // 👉 Feintuning Abstand
  setTimeout(() => { bar.element.style.bottom = '60px'; }, 0);

  return bar;
}

export function createSubBar3() {
  // Tabelle anzeigen
  const tableToggleBtn = new Toggle({
    html: '<i class="fa fa-table" aria-hidden="true"></i>',
    title: "Tabelle anzeigen",
    onToggle: function (active) {}
  });

  const bar = new Bar({
    toggleOne: true,
    controls: [tableToggleBtn]
  });
  
  return bar;
};

export function createDataTable() {
  let table = new Tabulator("#wms_data_table", {
    height: "100%",        // Wichtig für den internen Scroll-Container
    layout: "fitData",     // ÄNDERUNG: Spalten behalten ihre natürliche Breite
    autoColumns: true,
    columnDefaults:{
        tooltip:true,      // Zeigt Inhalt beim Drüberfahren
    },
  });

  
// WICHTIG die Karte sich neu berechnen:
map.updateSize();
  return table;
}




