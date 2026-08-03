import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { Ride } from '../../../src/types';

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
  const stopoversJson = JSON.stringify(ride.stopovers || []);
  
  const mapHtml = (ride.departure_latitude && ride.departure_longitude && ride.arrival_latitude && ride.arrival_longitude) ? `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
  <style>
    body, html, #map { width: 100%; height: 100%; margin: 0; padding: 0; background: #f3f4f6; }
    .loading-overlay {
      position: absolute; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(249, 250, 251, 0.9); display: flex;
      align-items: center; justify-content: center; z-index: 9999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 14px; color: #4b5563; font-weight: 500;
      flex-direction: column; gap: 10px;
    }
    .spinner {
      width: 32px; height: 32px; border: 3px solid #e5e7eb;
      border-top-color: #0066FF; border-radius: 50%;
      animation: spin 0.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div id="map"></div>
  <div class="loading-overlay" id="loader">
    <div class="spinner"></div>
    <span>Chargement de l'itinéraire...</span>
  </div>
  <script>
    const depLat = ${ride.departure_latitude};
    const depLon = ${ride.departure_longitude};
    const arrLat = ${ride.arrival_latitude};
    const arrLon = ${ride.arrival_longitude};
    const stopovers = ${stopoversJson};

    var map;

    function initMap() {
      var mapOptions = {
        zoom: 12,
        center: { lat: depLat, lng: depLon },
        disableDefaultUI: false,
        zoomControl: true
      };

      map = new google.maps.Map(document.getElementById('map'), mapOptions);

      var depMarker = new google.maps.Marker({
        position: { lat: depLat, lng: depLon },
        map: map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#0066FF',
          fillOpacity: 1,
          strokeColor: 'white',
          strokeWeight: 3
        }
      });

      var arrMarker = new google.maps.Marker({
        position: { lat: arrLat, lng: arrLon },
        map: map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#EF4444',
          fillOpacity: 1,
          strokeColor: 'white',
          strokeWeight: 3
        }
      });

      const passDepLat = ${passenger_dep_lat ? parseFloat(passenger_dep_lat) : 'null'};
      const passDepLon = ${passenger_dep_lon ? parseFloat(passenger_dep_lon) : 'null'};
      const passArrLat = ${passenger_arr_lat ? parseFloat(passenger_arr_lat) : 'null'};
      const passArrLon = ${passenger_arr_lon ? parseFloat(passenger_arr_lon) : 'null'};

      if (passDepLat && passDepLon) {
        var passDepMarker = new google.maps.Marker({
          position: { lat: passDepLat, lng: passDepLon },
          map: map,
          icon: {
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 5,
            fillColor: '#16A34A',
            fillOpacity: 1,
            strokeColor: 'white',
            strokeWeight: 2
          }
        });
        var infowDep = new google.maps.InfoWindow({
          content: '<div style="font-family: system-ui, -apple-system, sans-serif; font-size: 11px; font-weight: 700; color: #16A34A; padding: 2px;">Votre Embarquement</div>',
          disableAutoPan: true
        });
        passDepMarker.addListener('click', function() {
          infowDep.open(map, passDepMarker);
        });
      }

      if (passArrLat && passArrLon) {
        var passArrMarker = new google.maps.Marker({
          position: { lat: passArrLat, lng: passArrLon },
          map: map,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 7,
            fillColor: '#DC2626',
            fillOpacity: 1,
            strokeColor: 'white',
            strokeWeight: 2
          }
        });
        var infowArr = new google.maps.InfoWindow({
          content: '<div style="font-family: system-ui, -apple-system, sans-serif; font-size: 11px; font-weight: 700; color: #DC2626; padding: 2px;">Votre Dépose</div>',
          disableAutoPan: true
        });
        passArrMarker.addListener('click', function() {
          infowArr.open(map, passArrMarker);
        });
      }

      for (var i = 0; i < stopovers.length; i++) {
        var stop = stopovers[i];
        var stopLat = stop.latitude || stop.lat;
        var stopLon = stop.longitude || stop.lon;
        if (stopLat && stopLon) {
          var stopMarker = new google.maps.Marker({
            position: { lat: parseFloat(stopLat), lng: parseFloat(stopLon) },
            map: map,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 6,
              fillColor: '#F59E0B',
              fillOpacity: 1,
              strokeColor: 'white',
              strokeWeight: 2
            }
          });

          var cityName = stop.name.split(',')[0].trim();
          var infow = new google.maps.InfoWindow({
            content: '<div style="font-family: system-ui, -apple-system, sans-serif; font-size: 11px; font-weight: 700; color: #1F2937; padding: 2px;">' + cityName + '</div>',
            disableAutoPan: true
          });
          
          (function(m, iw) {
            m.addListener('click', function() {
              iw.open(map, m);
            });
          })(stopMarker, infow);
        }
      }
      var directionsService = new google.maps.DirectionsService();
      var directionsRenderer = new google.maps.DirectionsRenderer({
        map: map,
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: '#0066FF',
          strokeOpacity: 0.9,
          strokeWeight: 4
        }
      });

      var waypoints = [];
      for (var i = 0; i < stopovers.length; i++) {
        var stop = stopovers[i];
        var stopLat = stop.latitude || stop.lat;
        var stopLon = stop.longitude || stop.lon;
        if (stopLat && stopLon) {
          waypoints.push({
            location: { lat: parseFloat(stopLat), lng: parseFloat(stopLon) },
            stopover: true
          });
        }
      }

      directionsService.route({
        origin: { lat: depLat, lng: depLon },
        destination: { lat: arrLat, lng: arrLon },
        waypoints: waypoints,
        optimizeWaypoints: false,
        travelMode: google.maps.TravelMode.DRIVING
      }, function(response, status) {
        if (status === 'OK') {
          directionsRenderer.setDirections(response);
          document.getElementById('loader').style.display = 'none';
        } else {
          drawFallback();
        }
      });
    }

    function drawFallback() {
      var points = [{ lat: depLat, lng: depLon }];
      for (var i = 0; i < stopovers.length; i++) {
        var stop = stopovers[i];
        var stopLat = stop.latitude || stop.lat;
        var stopLon = stop.longitude || stop.lon;
        if (stopLat && stopLon) {
          points.push({ lat: parseFloat(stopLat), lng: parseFloat(stopLon) });
        }
      }
      points.push({ lat: arrLat, lng: arrLon });

      var flightPath = new google.maps.Polyline({
        path: points,
        strokeColor: '#0066FF',
        strokeOpacity: 0.8,
        strokeWeight: 3
      });
      flightPath.setMap(map);

      var bounds = new google.maps.LatLngBounds();
      for (var i = 0; i < points.length; i++) {
        bounds.extend(points[i]);
      }
      map.fitBounds(bounds);

      document.getElementById('loader').style.display = 'none';
    }
  </script>
  <script async defer
    src="https://maps.googleapis.com/maps/api/js?key=AIzaSyDeQDN8_mfUVNcb37Tg1FsiMaBoCuYOgrc&callback=initMap">
  </script>
</body>
</html>
  ` : null;

  if (!mapHtml) return null;

  return (
    <View style={{ marginBottom: 0 }}>
      <View style={styles.mapContainer}>
        <WebView
          originWhitelist={['*']}
          source={{ html: mapHtml }}
          scrollEnabled={true}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          style={{ flex: 1 }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          mixedContentMode="always"
        />
      </View>
      <View style={styles.routeBar}>
        <View style={[styles.routeDot, { backgroundColor: '#2F80ED' }]} />
        <Text style={styles.routeText} numberOfLines={1}>
          {ride.departure_location || 'Départ'}
        </Text>
        <Ionicons name="arrow-forward" size={14} color="#6B7280" />
        <Text style={[styles.routeText, { textAlign: 'right' }]} numberOfLines={1}>
          {ride.arrival_location || 'Arrivée'}
        </Text>
        <View style={[styles.routeDot, { backgroundColor: '#EF4444' }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mapContainer: {
    height: 380,
    width: '100%',
    overflow: 'hidden',
    backgroundColor: '#e8eaed',
    position: 'relative'
  },
  routeBar: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 8
  },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: 5
  },
  routeText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937'
  }
});
