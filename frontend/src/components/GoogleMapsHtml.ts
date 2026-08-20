/**
 * ==============================================================
 * GoogleMapsHtml.ts — Template HTML de la carte Google Maps (WebView)
 * ==============================================================
 * 
 * Ce fichier contient le template HTML injecté dans le composant WebView de React Native.
 * Il gère :
 * 1. L'affichage de la carte Google Maps.
 * 2. Le repère central (Marker Pin) avec animation de glissement.
 * 3. La communication bidirectionnelle (ReactNativeWebView.postMessage) pour notifier
 *    l'application lorsque la carte bouge ou est prête.
 * 4. Les marqueurs de prévisualisation et de position de l'utilisateur.
 */

export const getGoogleMapsHtml = (defaultLat: number, defaultLon: number): string => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body, html, #map { width: 100%; height: 100%; background: #f0f4f8; }
    .center-marker {
      position: absolute; top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      z-index: 1000; pointer-events: none; transition: transform 0.18s ease;
    }
    .center-marker.dragging { transform: translate(-50%, -60%) scale(1.12); }
    .marker-pin {
      width: 36px; height: 36px; border-radius: 50% 50% 50% 0;
      background: #EA4335; position: absolute; transform: rotate(-45deg);
      left: 50%; top: 50%; margin: -18px 0 0 -18px;
      box-shadow: 0 4px 14px rgba(234,67,53,0.45); border: 3px solid white;
    }
    .marker-pin::after {
      content: ''; width: 12px; height: 12px; margin: 9px 0 0 9px;
      background: white; position: absolute; border-radius: 50%;
    }
    .pulse {
      width: 64px; height: 64px; background: rgba(234,67,53,0.2);
      border-radius: 50%; position: absolute; left: 50%; top: 50%;
      margin: -32px 0 0 -32px; animation: pulse 1.6s infinite;
    }
    @keyframes pulse {
      0% { transform: scale(0.4); opacity: 1; }
      100% { transform: scale(1.6); opacity: 0; }
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <div class="center-marker" id="centerMarker">
    <div class="marker-pin"></div>
    <div class="pulse"></div>
  </div>
  <script>
    var map, userMarker, previewMarker, moveTimeout;
    var markerEl = document.getElementById('centerMarker');

    function initMap() {
      map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: ${defaultLat}, lng: ${defaultLon} },
        zoom: 13,
        disableDefaultUI: true,
        gestureHandling: 'greedy',
        mapTypeId: 'roadmap',
        styles: [
          { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
          { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] }
        ]
      });

      map.addListener('dragstart', function() {
        if (markerEl) markerEl.classList.add('dragging');
        clearTimeout(moveTimeout);
      });

      map.addListener('idle', function() {
        clearTimeout(moveTimeout);
        moveTimeout = setTimeout(function() {
          if (markerEl) markerEl.classList.remove('dragging');
          var c = map.getCenter();
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'centerChanged', lat: c.lat(), lon: c.lng()
          }));
        }, 120);
      });

      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
    }

    window.handleMessage = function(msg) {
      if (!map) return;
      if (msg.type === 'setView') {
        map.panTo({ lat: msg.lat, lng: msg.lon });
        if (msg.zoom) map.setZoom(msg.zoom);
      } else if (msg.type === 'previewLocation') {
        var pos = { lat: msg.lat, lng: msg.lon };
        if (previewMarker) {
          previewMarker.setPosition(pos);
        } else {
          previewMarker = new google.maps.Marker({
            position: pos, map: map,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 11, fillColor: '#FFAA00', fillOpacity: 0.9,
              strokeColor: 'white', strokeWeight: 2.5
            },
            animation: google.maps.Animation.DROP,
            zIndex: 150
          });
        }
        map.panTo(pos);
      } else if (msg.type === 'clearPreview') {
        if (previewMarker) { previewMarker.setMap(null); previewMarker = null; }
      } else if (msg.type === 'setUserMarker') {
        var uPos = { lat: msg.lat, lng: msg.lon };
        if (userMarker) { userMarker.setPosition(uPos); }
        else {
          userMarker = new google.maps.Marker({
            position: uPos, map: map,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 9, fillColor: '#1A73E8', fillOpacity: 1,
              strokeColor: '#FFFFFF', strokeWeight: 2.5
            },
            zIndex: 200
          });
        }
      } else if (msg.type === 'zoomIn') { map.setZoom(map.getZoom() + 1); }
      else if (msg.type === 'zoomOut') { map.setZoom(map.getZoom() - 1); }
    };
  </script>
  <script async defer
    src="https://maps.googleapis.com/maps/api/js?key=AIzaSyDeQDN8_mfUVNcb37Tg1FsiMaBoCuYOgrc&callback=initMap">
  </script>
</body>
</html>
`;
