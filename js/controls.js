import LayerSwitcher from 'ol-ext/control/LayerSwitcher';

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