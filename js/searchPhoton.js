import SearchPhoton from 'ol-ext/control/SearchPhoton';




export function searchPhotonFunc(map) {
  const searchPhoton = new SearchPhogon('#wms_data_table', {
    //target: $(".options").get(0),
  lang:"de",		// Force preferred language
  polygon: $("#polygon").prop("checked"),
  reverse: true,
  position: true	  
  });

}
