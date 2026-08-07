import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { Ride } from '../../../../src/types';

const { width: SW } = Dimensions.get('window');

interface RideMapProps {
  ride: Ride;
  passenger_dep_lat?: string;
  passenger_dep_lon?: string;
  passenger_arr_lat?: string;
  passenger_arr_lon?: string;
  departure?: string;
  destination?: string;
}

export function RideMap({
  ride,
  passenger_dep_lat,
  passenger_dep_lon,
  passenger_arr_lat,
  passenger_arr_lon,
  departure,
  destination
}: RideMapProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 700, delay: 300, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, delay: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  const stopoversJson = JSON.stringify(ride.stopovers || []);

  const hasCoords = ride.departure_latitude && ride.departure_longitude &&
    ride.arrival_latitude && ride.arrival_longitude;

  // Apple Maps-style custom map style JSON
  const mapStyle = JSON.stringify([
    { elementType: 'geometry', stylers: [{ color: '#f5f5f0' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f5f5' }] },
    { featureType: 'administrative.land_parcel', elementType: 'labels.text.fill', stylers: [{ color: '#bdbdbd' }] },
    { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#eeede8' }] },
    { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#dde8d0' }] },
    { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
    { featureType: 'road.arterial', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#f8e6c0' }] },
    { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
    { featureType: 'road.local', elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },
    { featureType: 'transit.line', elementType: 'geometry', stylers: [{ color: '#e5e5e5' }] },
    { featureType: 'transit.station', elementType: 'geometry', stylers: [{ color: '#eeeeee' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9d8e8' }] },
    { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },
    { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f5f5f0' }] },
    { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#c9c9c9' }] },
    { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
    { featureType: 'poi.attraction', stylers: [{ visibility: 'off' }] },
    { featureType: 'poi.government', stylers: [{ visibility: 'off' }] },
    { featureType: 'poi.medical', stylers: [{ visibility: 'off' }] },
    { featureType: 'poi.place_of_worship', stylers: [{ visibility: 'off' }] },
    { featureType: 'poi.school', stylers: [{ visibility: 'off' }] },
    { featureType: 'poi.sports_complex', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'simplified' }] },
  ]);

  const mapHtml = hasCoords ? `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body, html, #map { width: 100%; height: 100%; background: #F5F5F0; }

    /* Premium loader */
    #loader {
      position: absolute; inset: 0;
      background: linear-gradient(135deg, #F8FAFC 0%, #EBF4FF 100%);
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      z-index: 9999; gap: 14px;
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif;
    }
    .loader-icon {
      width: 48px; height: 48px; border-radius: 14px;
      background: linear-gradient(135deg, #2F80ED, #1A65C8);
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 8px 24px rgba(47,128,237,0.4);
      animation: pulse 1.5s ease-in-out infinite;
    }
    .loader-icon svg { width: 24px; height: 24px; fill: white; }
    .loader-text { font-size: 14px; font-weight: 600; color: #64748B; }
    .loader-dots { display: flex; gap: 6px; }
    .loader-dot { width: 6px; height: 6px; border-radius: 50%; background: #2F80ED; animation: bounce 1.2s ease-in-out infinite; }
    .loader-dot:nth-child(2) { animation-delay: 0.2s; }
    .loader-dot:nth-child(3) { animation-delay: 0.4s; }

    @keyframes pulse {
      0%, 100% { transform: scale(1); box-shadow: 0 8px 24px rgba(47,128,237,0.4); }
      50% { transform: scale(1.05); box-shadow: 0 12px 32px rgba(47,128,237,0.6); }
    }
    @keyframes bounce {
      0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
      40% { transform: translateY(-8px); opacity: 1; }
    }

    /* Custom marker styles */
    .marker-dep, .marker-arr, .marker-stop, .marker-pass-dep, .marker-pass-arr {
      position: relative; display: flex; align-items: center; justify-content: center;
    }

    /* Hide default Google Maps UI elements we don't want */
    .gm-bundled-control, .gm-svpc { display: none !important; }
    button[title="Toggle fullscreen view"] { display: none !important; }
    .gm-style-cc { display: none !important; }
    a[title="Report errors in the road map or imagery to Google"] { display: none !important; }
    .gm-style-pbt { display: none !important; }
    .gm-fullscreen-control { display: none !important; }
    .gm-compass { display: none !important; }
  </style>
</head>
<body>
  <div id="map"></div>
  <div id="loader">
    <div class="loader-icon">
      <svg viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
    </div>
    <div class="loader-text">Chargement de l'itinéraire</div>
    <div class="loader-dots">
      <div class="loader-dot"></div>
      <div class="loader-dot"></div>
      <div class="loader-dot"></div>
    </div>
  </div>

  <script>
    const depLat = ${ride.departure_latitude};
    const depLon = ${ride.departure_longitude};
    const arrLat = ${ride.arrival_latitude};
    const arrLon = ${ride.arrival_longitude};
    const stopovers = ${stopoversJson};
    const mapStyle = ${mapStyle};

    var map;
    var animationInterval;

    // Premium SVG marker factory
    function createSvgMarker(color, size, ringColor, isStart, label) {
      var ring = ringColor || 'rgba(255,255,255,0.6)';
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 48 48">'
        + '<circle cx="24" cy="24" r="22" fill="' + ring + '" stroke="none"/>'
        + '<circle cx="24" cy="24" r="15" fill="white" stroke="none"/>'
        + '<circle cx="24" cy="24" r="11" fill="' + color + '" stroke="none"/>'
        + (isStart ? '<circle cx="24" cy="24" r="5" fill="white" stroke="none"/>' : '')
        + '</svg>';
      return {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
        scaledSize: new google.maps.Size(size, size),
        anchor: new google.maps.Point(size/2, size/2)
      };
    }

    function createStopMarker(color, size) {
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 36 36">'
        + '<circle cx="18" cy="18" r="16" fill="white" stroke="' + color + '" stroke-width="3"/>'
        + '<circle cx="18" cy="18" r="9" fill="' + color + '" stroke="none"/>'
        + '</svg>';
      return {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
        scaledSize: new google.maps.Size(size, size),
        anchor: new google.maps.Point(size/2, size/2)
      };
    }

    function createPassengerMarker(color, label, size) {
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + (size+30) + '" height="' + size + '" viewBox="0 0 80 40">'
        + '<rect x="0" y="4" width="80" height="32" rx="16" fill="' + color + '"/>'
        + '<circle cx="22" cy="20" r="11" fill="rgba(255,255,255,0.25)"/>'
        + '<path d="M22 13 L22 27" stroke="white" stroke-width="2.5" stroke-linecap="round"/>'
        + '<path d="M15 20 L29 20" stroke="white" stroke-width="2.5" stroke-linecap="round"/>'
        + '<text x="42" y="25" font-family="-apple-system,BlinkMacSystemFont,sans-serif" font-size="11" font-weight="700" fill="white">' + label + '</text>'
        + '</svg>';
      return {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
        scaledSize: new google.maps.Size(size+30, size),
        anchor: new google.maps.Point(12, size/2)
      };
    }

    function initMap() {
      var centerLat = (depLat + arrLat) / 2;
      var centerLon = (depLon + arrLon) / 2;

      map = new google.maps.Map(document.getElementById('map'), {
        zoom: 11,
        center: { lat: centerLat, lng: centerLon },
        disableDefaultUI: true,
        zoomControl: false,
        mapTypeControl: false,
        scaleControl: false,
        streetViewControl: false,
        rotateControl: false,
        fullscreenControl: false,
        gestureHandling: 'cooperative',
        styles: mapStyle,
        backgroundColor: '#F5F5F0',
      });

      // Departure marker — glowing green dot
      new google.maps.Marker({
        position: { lat: depLat, lng: depLon },
        map: map,
        icon: createSvgMarker('#22C55E', 44, 'rgba(34,197,94,0.25)', true, ''),
        zIndex: 10,
      });

      // Arrival marker — elegant red dot
      new google.maps.Marker({
        position: { lat: arrLat, lng: arrLon },
        map: map,
        icon: createSvgMarker('#EF4444', 44, 'rgba(239,68,68,0.25)', false, ''),
        zIndex: 10,
      });

      // Passenger boarding marker
      const passDepLat = ${passenger_dep_lat ? parseFloat(passenger_dep_lat) : 'null'};
      const passDepLon = ${passenger_dep_lon ? parseFloat(passenger_dep_lon) : 'null'};
      const passArrLat = ${passenger_arr_lat ? parseFloat(passenger_arr_lat) : 'null'};
      const passArrLon = ${passenger_arr_lon ? parseFloat(passenger_arr_lon) : 'null'};

      if (passDepLat && passDepLon) {
        new google.maps.Marker({
          position: { lat: passDepLat, lng: passDepLon },
          map: map,
          icon: createPassengerMarker('#22C55E', 'Embarquement', 40),
          zIndex: 9,
        });
      }
      if (passArrLat && passArrLon) {
        new google.maps.Marker({
          position: { lat: passArrLat, lng: passArrLon },
          map: map,
          icon: createPassengerMarker('#DC2626', 'Dépose', 40),
          zIndex: 9,
        });
      }

      // Stopover markers — orange dots
      var waypoints = [];
      for (var i = 0; i < stopovers.length; i++) {
        var stop = stopovers[i];
        var stopLat = parseFloat(stop.latitude || stop.lat);
        var stopLon = parseFloat(stop.longitude || stop.lon);
        if (!isNaN(stopLat) && !isNaN(stopLon)) {
          new google.maps.Marker({
            position: { lat: stopLat, lng: stopLon },
            map: map,
            icon: createStopMarker('#F59E0B', 32),
            zIndex: 8,
          });
          waypoints.push({ location: { lat: stopLat, lng: stopLon }, stopover: true });
        }
      }

      // Draw route
      var directionsService = new google.maps.DirectionsService();

      // Glow effect — draw thick transparent blue first (outer glow)
      var glowRenderer = new google.maps.DirectionsRenderer({
        map: map,
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: '#2F80ED',
          strokeOpacity: 0.15,
          strokeWeight: 18,
          zIndex: 1,
        }
      });
      // Main route line
      var mainRenderer = new google.maps.DirectionsRenderer({
        map: map,
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: '#2F80ED',
          strokeOpacity: 0.92,
          strokeWeight: 6,
          zIndex: 2,
        }
      });
      // White border for definition
      var borderRenderer = new google.maps.DirectionsRenderer({
        map: map,
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: '#FFFFFF',
          strokeOpacity: 0.4,
          strokeWeight: 9,
          zIndex: 1,
        }
      });

      var routeRequest = {
        origin: { lat: depLat, lng: depLon },
        destination: { lat: arrLat, lng: arrLon },
        waypoints: waypoints,
        optimizeWaypoints: false,
        travelMode: google.maps.TravelMode.DRIVING
      };

      directionsService.route(routeRequest, function(response, status) {
        if (status === 'OK') {
          glowRenderer.setDirections(response);
          borderRenderer.setDirections(response);
          mainRenderer.setDirections(response);

          // Fit bounds with elegant padding
          var bounds = new google.maps.LatLngBounds();
          var legs = response.routes[0].legs;
          for (var l = 0; l < legs.length; l++) {
            var steps = legs[l].steps;
            for (var s = 0; s < steps.length; s++) {
              var path = steps[s].path;
              for (var p = 0; p < path.length; p++) {
                bounds.extend(path[p]);
              }
            }
          }
          map.fitBounds(bounds, { top: 60, right: 24, bottom: 80, left: 24 });

          fadeOutLoader();
        } else {
          drawFallback(waypoints);
        }
      });
    }

    function drawFallback(waypoints) {
      var points = [{ lat: depLat, lng: depLon }];
      if (waypoints) {
        for (var i = 0; i < waypoints.length; i++) {
          points.push(waypoints[i].location);
        }
      }
      points.push({ lat: arrLat, lng: arrLon });

      // Glow
      new google.maps.Polyline({ path: points, strokeColor: '#2F80ED', strokeOpacity: 0.12, strokeWeight: 20, map: map, zIndex: 1 });
      // Border
      new google.maps.Polyline({ path: points, strokeColor: '#FFFFFF', strokeOpacity: 0.5, strokeWeight: 10, map: map, zIndex: 1 });
      // Main
      new google.maps.Polyline({ path: points, strokeColor: '#2F80ED', strokeOpacity: 0.95, strokeWeight: 6, map: map, zIndex: 2 });

      var bounds = new google.maps.LatLngBounds();
      for (var i = 0; i < points.length; i++) bounds.extend(points[i]);
      map.fitBounds(bounds, { top: 60, right: 24, bottom: 80, left: 24 });

      fadeOutLoader();
    }

    function fadeOutLoader() {
      var loader = document.getElementById('loader');
      loader.style.transition = 'opacity 0.6s ease';
      loader.style.opacity = '0';
      setTimeout(function() { loader.style.display = 'none'; }, 600);
    }
  </script>
  <script async defer
    src="https://maps.googleapis.com/maps/api/js?key=AIzaSyDeQDN8_mfUVNcb37Tg1FsiMaBoCuYOgrc&callback=initMap">
  </script>
</body>
</html>
  ` : null;

  // Fallback UI when no coordinates
  if (!mapHtml) return null;

  return (
    <View style={styles.container}>
      {/* Map WebView */}
      <WebView
        originWhitelist={['*']}
        source={{ html: mapHtml }}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        mixedContentMode="always"
        allowsInlineMediaPlayback={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: '100%',
    width: '100%',
    backgroundColor: '#F5F5F0',
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
