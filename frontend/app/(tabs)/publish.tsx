import React, { useRef, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

import { theme } from '../../src/styles/theme';
import { useAuth } from '../../src/context/AuthContext';
import { StepIndicator } from '../../src/components/publish/StepIndicator';
import LocationPicker from '../../src/components/LocationPicker';
import { AppBottomSheet } from '../../src/components/AppBottomSheet';

// Subcomponents & Hook
import { usePublishForm } from '@/src/features/publish/hooks/usePublishForm';
import { ItineraryStep } from '@/src/features/publish/components/ItineraryStep';
import { StopoversStep } from '@/src/features/publish/components/StopoversStep';
import { DateTimeStep } from '@/src/features/publish/components/DateTimeStep';
import { PriceStep } from '@/src/features/publish/components/PriceStep';
import { PreferencesStep } from '@/src/features/publish/components/PreferencesStep';
import { PublishSummaryModal } from '@/src/features/publish/components/PublishSummaryModal';
import { ProfileCompletionModal } from '@/src/features/publish/components/ProfileCompletionModal';

const STEP_LABELS = ['Itinéraire', 'Étapes', 'Date', 'Prix', 'Options'];

export default function PublishScreen() {
  const router = useRouter();
  const authCtx = useAuth();
  const user = authCtx?.user ?? null;

  const form = usePublishForm(authCtx);
  const webviewRef = useRef<WebView>(null);
  const buttonScale = useRef(new Animated.Value(1)).current;

  useFocusEffect(
    useCallback(() => {
      if (user && user.is_verified) {
        form.checkVehicle();
      }
    }, [user, form.checkVehicle])
  );

  // Google Maps HTML code
  const googleMapHtml = useMemo(() => {
    if (!form.departureCords || !form.arrivalCords) return '';
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
  <style>
    body, html, #map { width: 100%; height: 100%; margin: 0; padding: 0; background: #f3f4f6; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map;
    var directionsRenderer;
    var directionsService;
    var directionsResponse;
 
    function getRouteSteps(r) {
      var steps = [];
      r.legs.forEach(function(l) {
        if (l.steps) {
          l.steps.forEach(function(s) {
            steps.push({
              end_location: {
                lat: typeof s.end_location.lat === 'function' ? s.end_location.lat() : s.end_location.lat,
                lng: typeof s.end_location.lng === 'function' ? s.end_location.lng() : s.end_location.lng
              },
              html_instructions: s.instructions || s.html_instructions || ''
            });
          });
        }
      });
      return steps;
    }
 
    function getRouteLegs(r) {
      return r.legs.map(function(l) {
        return {
          start_address: l.start_address,
          end_address: l.end_address,
          distanceKm: Math.round(l.distance.value / 1000),
          durationMin: Math.round(l.duration.value / 60)
        };
      });
    }
 
    function initMap() {
      map = new google.maps.Map(document.getElementById('map'), {
        zoom: 12,
        center: { lat: ${form.departureCords.lat}, lng: ${form.departureCords.lon} },
        disableDefaultUI: true,
        zoomControl: false,
        styles: [
          { "featureType": "poi", "stylers": [{ "visibility": "off" }] },
          { "featureType": "transit", "stylers": [{ "visibility": "off" }] },
          { "featureType": "road", "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] }
        ]
      });
 
      directionsService = new google.maps.DirectionsService();
      
      directionsRenderer = new google.maps.DirectionsRenderer({
        map: map,
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: '#0066FF',
          strokeOpacity: 0.9,
          strokeWeight: 4
        }
      });
 
      directionsService.route({
        origin: { lat: ${form.departureCords.lat}, lng: ${form.departureCords.lon} },
        destination: { lat: ${form.arrivalCords.lat}, lng: ${form.arrivalCords.lon} },
        travelMode: google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: true
      }, function(response, status) {
        if (status === 'OK') {
          directionsResponse = response;
          directionsRenderer.setDirections(response);
          directionsRenderer.setRouteIndex(0);
          
          var routes = response.routes.map(function(r, idx) {
            return {
              index: idx,
              summary: r.summary || 'Itinéraire proposé',
              distanceText: r.legs[0].distance.text,
              distanceValue: r.legs[0].distance.value,
              durationText: r.legs[0].duration.text,
              durationValue: r.legs[0].duration.value,
              steps: getRouteSteps(r),
              legs: getRouteLegs(r)
            };
          });
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'routesCalculated',
            routes: routes
          }));
        } else {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'routesFailed'
          }));
          var flightPath = new google.maps.Polyline({
            path: [
              { lat: ${form.departureCords.lat}, lng: ${form.departureCords.lon} },
              { lat: ${form.arrivalCords.lat}, lng: ${form.arrivalCords.lon} }
            ],
            strokeColor: '#0066FF',
            strokeOpacity: 0.8,
            strokeWeight: 3,
            map: map
          });
          var bounds = new google.maps.LatLngBounds();
          bounds.extend({ lat: ${form.departureCords.lat}, lng: ${form.departureCords.lon} });
          bounds.extend({ lat: ${form.arrivalCords.lat}, lng: ${form.arrivalCords.lon} });
          map.fitBounds(bounds);
        }
      });
 
      new google.maps.Marker({
        position: { lat: ${form.departureCords.lat}, lng: ${form.departureCords.lon} },
        map: map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 7,
          fillColor: '#0066FF',
          fillOpacity: 1,
          strokeColor: 'white',
          strokeWeight: 3
        }
      });
 
      new google.maps.Marker({
        position: { lat: ${form.arrivalCords.lat}, lng: ${form.arrivalCords.lon} },
        map: map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 7,
          fillColor: '#EF4444',
          fillOpacity: 1,
          strokeColor: 'white',
          strokeWeight: 3
        }
      });
 
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
    }
 
    window.renderRoute = function(index) {
      if (directionsRenderer) {
        directionsRenderer.setRouteIndex(index);
      }
    };
 
    window.updateWaypoints = function(stopoversJson) {
      var stops = [];
      try {
        stops = JSON.parse(stopoversJson) || [];
      } catch (e) {
        console.error("Error parsing stops", e);
      }
 
      var waypoints = [];
      stops.forEach(function(s) {
        if (s.coords && s.coords.lat && s.coords.lon) {
          waypoints.push({
            location: new google.maps.LatLng(s.coords.lat, s.coords.lon),
            stopover: true
          });
        }
      });
 
      directionsService.route({
        origin: { lat: ${form.departureCords.lat}, lng: ${form.departureCords.lon} },
        destination: { lat: ${form.arrivalCords.lat}, lng: ${form.arrivalCords.lon} },
        waypoints: waypoints,
        optimizeWaypoints: false,
        travelMode: google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: waypoints.length === 0
      }, function(response, status) {
        if (status === 'OK') {
          directionsResponse = response;
          directionsRenderer.setDirections(response);
          directionsRenderer.setRouteIndex(0);
 
          var routes = response.routes.map(function(r, idx) {
            var distVal = 0;
            var durVal = 0;
            r.legs.forEach(function(l) {
              distVal += l.distance.value;
              durVal += l.duration.value;
            });
 
            var distText = (distVal / 1000).toFixed(1) + ' km';
            var totalMin = Math.round(durVal / 60);
            var hrs = Math.floor(totalMin / 60);
            var mins = totalMin % 60;
            var durText = hrs > 0 ? hrs + ' h ' + mins + ' min' : mins + ' min';
 
            return {
              index: idx,
              summary: r.summary || 'Itinéraire proposé',
              distanceText: distText,
              distanceValue: distVal,
              durationText: durText,
              durationValue: durVal,
              steps: getRouteSteps(r),
              legs: getRouteLegs(r)
            };
          });
 
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'routesCalculated',
            routes: routes
          }));
        } else {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'routesFailed'
          }));
        }
      });
    };
  </script>
  <script async defer
    src="https://maps.googleapis.com/maps/api/js?key=AIzaSyDeQDN8_mfUVNcb37Tg1FsiMaBoCuYOgrc&callback=initMap">
  </script>
</body>
</html>
    `;
  }, [form.departureCords, form.arrivalCords]);

  const mapSource = useMemo(() => {
    if (!form.departureCords || !form.arrivalCords) return null;
    return { html: googleMapHtml };
  }, [googleMapHtml, form.departureCords, form.arrivalCords]);

  // Sync WebView route index with maps
  const selectRouteWithWebView = (idx: number) => {
    form.handleSelectRoute(idx);
    webviewRef.current?.injectJavaScript(`window.renderRoute && window.renderRoute(${idx}); true;`);
  };

  // Sync waypoints with maps
  const lastInjectedWaypointsRef = React.useRef<string>('');
  React.useEffect(() => {
    if (form.mapReady && form.departureCords && form.arrivalCords && webviewRef.current) {
      const stopoversJson = JSON.stringify(form.stopovers.map((s: any) => ({ name: s.name, coords: s.coords })));
      if (lastInjectedWaypointsRef.current === stopoversJson) return;
      lastInjectedWaypointsRef.current = stopoversJson;
      webviewRef.current.injectJavaScript(
        `window.updateWaypoints && window.updateWaypoints(${JSON.stringify(stopoversJson)}); true;`
      );
    }
  }, [form.stopovers, form.mapReady, form.departureCords, form.arrivalCords]);

  // Render correct steps
  const renderStepContent = () => {
    switch (form.formStep) {
      case 1:
        return (
          <ItineraryStep
            departure={form.departure}
            arrival={form.arrival}
            departureCords={form.departureCords}
            arrivalCords={form.arrivalCords}
            mapSource={mapSource}
            googleRoutes={form.googleRoutes}
            selectedRouteIndex={form.selectedRouteIndex}
            webviewRef={webviewRef}
            onMapMessage={form.onMapMessage}
            onPickLocation={form.setPickingLocationFor}
            onSelectRoute={selectRouteWithWebView}
            estimationLoading={form.estimationLoading}
          />
        );
      case 2:
        return (
          <StopoversStep
            departure={form.departure}
            arrival={form.arrival}
            subStep={form.stopoverSubStep}
            googleRoutes={form.googleRoutes}
            selectedRouteIndex={form.selectedRouteIndex}
            detectedStopovers={form.detectedStopovers}
            stopovers={form.stopovers}
            toggleStopoverCheck={form.toggleStopoverCheck}
            updateStopover={form.updateStopover}
            onAddStopoverPress={() => form.setPickingLocationFor('new_custom')}
            onPickLocationForStopover={form.setPickingLocationFor}
            estimationLoading={form.estimationLoading}
            estimation={form.estimation}
          />
        );
      case 3:
        return (
          <DateTimeStep
            selectedDateObj={form.selectedDateObj}
            time={form.time}
            seats={form.seats}
            isRecurrent={form.isRecurrent}
            repeatType={form.repeatType}
            endDateObj={form.endDateObj}
            selectedDays={form.selectedDays}
            daySchedules={form.daySchedules}
            showDatePicker={form.showDatePicker}
            showTimePicker={form.showTimePicker}
            showEndDatePicker={form.showEndDatePicker}
            timeDate={form.timeDate}
            setSelectedDays={form.setSelectedDays}
            setDaySchedules={form.setDaySchedules}
            setRepeatType={form.setRepeatType}
            setIsRecurrent={form.setIsRecurrent}
            setSeats={form.setSeats}
            setShowDatePicker={form.setShowDatePicker}
            setShowTimePicker={form.setShowTimePicker}
            setShowEndDatePicker={form.setShowEndDatePicker}
            onChangeDate={(event, date) => {
              form.setShowDatePicker(Platform.OS === 'ios');
              if (event.type === 'set' && date) {
                form.setShowDatePicker(false);
                form.setSelectedDateObj(date);
              } else if (event.type === 'dismissed') {
                form.setShowDatePicker(false);
              }
            }}
            onChangeEndDate={(event, date) => {
              form.setShowEndDatePicker(Platform.OS === 'ios');
              if (event.type === 'set' && date) {
                form.setShowEndDatePicker(false);
                form.setEndDateObj(date);
              } else if (event.type === 'dismissed') {
                form.setShowEndDatePicker(false);
              }
            }}
            onChangeTime={(event, date) => {
              form.setShowTimePicker(Platform.OS === 'ios');
              if (event.type === 'set' && date) {
                form.setShowTimePicker(false);
                const h = date.getHours().toString().padStart(2, '0');
                const m = date.getMinutes().toString().padStart(2, '0');
                form.setTime(`${h}:${m}`);
              } else if (event.type === 'dismissed') {
                form.setShowTimePicker(false);
              }
            }}
          />
        );
      case 4:
        return (
          <PriceStep
            price={form.price}
            priceLoading={form.priceLoading}
            priceSuggestion={form.priceSuggestion}
            estimation={form.estimation}
            localPriceText={form.localPriceText}
            setLocalPriceText={form.setLocalPriceText}
            updateOverallPrice={form.updateOverallPrice}
            priceInputFocused={form.priceInputFocused}
            setPriceInputFocused={form.setPriceInputFocused}
            legs={form.legs}
            legPrices={form.legPrices}
            setLegPrices={form.setLegPrices}
            departure={form.departure}
            arrival={form.arrival}
            stopovers={form.stopovers}
            seats={form.seats}
            financialSettings={form.financialSettings}
          />
        );
      case 5:
        return (
          <PreferencesStep
            music={form.music}
            setMusic={form.setMusic}
            smoking={form.smoking}
            setSmoking={form.setSmoking}
            chatty={form.chatty}
            setChatty={form.setChatty}
            airCond={form.airCond}
            setAirCond={form.setAirCond}
            petsAllowed={form.petsAllowed}
            setPetsAllowed={form.setPetsAllowed}
            luggageAllowed={form.luggageAllowed}
            setLuggageAllowed={form.setLuggageAllowed}
            luggageSize={form.luggageSize}
            setLuggageSize={form.setLuggageSize}
            luggageType={form.luggageType}
            setLuggageType={form.setLuggageType}
            luggageMaxWeightKg={form.luggageMaxWeightKg}
            setLuggageMaxWeightKg={form.setLuggageMaxWeightKg}
            drivingRelay={form.drivingRelay}
            setDrivingRelay={form.setDrivingRelay}
            stopsAllowed={form.stopsAllowed}
            setStopsAllowed={form.setStopsAllowed}
            description={form.description}
            setDescription={form.setDescription}
            departure={form.departure}
            arrival={form.arrival}
            price={form.price}
          />
        );
      default:
        return null;
    }
  };

  // Profile status guards
  if (!user) return (
    <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: theme.spacing.xl }]}>
      <Ionicons name="add-circle-outline" size={80} color={theme.colors.textMuted} />
      <Text style={styles.notLoggedTitle}>Publier un trajet</Text>
      <Text style={styles.notLoggedText}>Connectez-vous pour proposer un trajet.</Text>
      <TouchableOpacity style={styles.notLoggedButton} onPress={() => router.push('/(auth)/login')}>
        <LinearGradient colors={[theme.colors.primary, theme.colors.primaryDark]} style={styles.notLoggedGradient}>
          <Text style={styles.notLoggedButtonText}>Se connecter</Text>
        </LinearGradient>
      </TouchableOpacity>
    </SafeAreaView>
  );

  if (!user.is_verified) return (
    <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: theme.spacing.xl }]}>
      <Ionicons name="shield-checkmark-outline" size={80} color={theme.colors.textMuted} />
      <Text style={styles.notLoggedTitle}>Compte non vérifié</Text>
      <Text style={styles.notLoggedText}>Votre compte doit être vérifié pour proposer un trajet.</Text>
      <TouchableOpacity style={styles.notLoggedButton} onPress={() => router.push('/verify-identity')}>
        <LinearGradient colors={[theme.colors.primary, theme.colors.primaryDark]} style={styles.notLoggedGradient}>
          <Text style={styles.notLoggedButtonText}>Se faire vérifier</Text>
        </LinearGradient>
      </TouchableOpacity>
    </SafeAreaView>
  );

  if (form.checkingVehicle) return (
    <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
    </SafeAreaView>
  );

  if (!form.hasVehicle) {
    if (form.showExpiredLicenseWarning) {
      return (
        <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: theme.spacing.xl }]}>
          <Ionicons name="warning-outline" size={80} color={theme.colors.error} />
          <Text style={styles.notLoggedTitle}>Permis invalide</Text>
          <Text style={styles.notLoggedText}>Les informations de votre permis de conduire sont manquantes ou expirées.</Text>
          <TouchableOpacity style={styles.notLoggedButton} onPress={() => router.push('/(tabs)/profile')}>
            <LinearGradient colors={[theme.colors.primary, theme.colors.primaryDark]} style={styles.notLoggedGradient}>
              <Text style={styles.notLoggedButtonText}>Mettre à jour le permis</Text>
            </LinearGradient>
          </TouchableOpacity>
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: theme.spacing.xl }]}>
        <Ionicons name="car-sport-outline" size={80} color={theme.colors.textMuted} />
        <Text style={styles.notLoggedTitle}>Véhicule requis</Text>
        <Text style={styles.notLoggedText}>Vous devez enregistrer un véhicule dans votre profil pour pouvoir proposer un trajet.</Text>
        <TouchableOpacity style={styles.notLoggedButton} onPress={() => router.push('/(tabs)/profile?openVehicleModal=true')}>
          <LinearGradient colors={[theme.colors.primary, theme.colors.primaryDark]} style={styles.notLoggedGradient}>
            <Text style={styles.notLoggedButtonText}>Ajouter un véhicule</Text>
          </LinearGradient>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            {form.formStep > 1 ? (
              <TouchableOpacity onPress={form.handleBack} style={styles.backBtn}>
                <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
              </TouchableOpacity>
            ) : <View style={{ width: 40 }} />}
            <Text style={styles.headerTitle}>Publier un trajet</Text>
            <View style={{ width: 40 }} />
          </View>
          <StepIndicator currentStep={form.formStep} totalSteps={5} labels={STEP_LABELS} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={{ transform: [{ translateY: form.stepAnim }] }}>
            
            {renderStepContent()}

            {/* Next button (steps 1-4) */}
            {form.formStep < 5 && (
              <TouchableOpacity style={styles.nextBtn} onPress={form.handleNext} activeOpacity={0.85}>
                <LinearGradient
                  colors={[theme.colors.primary, theme.colors.primaryDark]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.nextBtnGradient}
                >
                  <Text style={styles.nextBtnText}>
                    {form.formStep === 4 ? 'Continuer vers les options' : 'Continuer'}
                  </Text>
                  <Ionicons name="arrow-forward" size={20} color={theme.colors.white} />
                </LinearGradient>
              </TouchableOpacity>
            )}

            {/* Publish button (step 5) */}
            {form.formStep === 5 && (
              <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                <TouchableOpacity
                  style={[styles.publishBtn, form.loading && styles.publishBtnDisabled]}
                  onPress={form.handlePublishPress}
                  activeOpacity={0.9}
                  disabled={form.loading}
                >
                  <LinearGradient
                    colors={[theme.colors.primary, theme.colors.primaryDark]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={styles.publishBtnGradient}
                  >
                    {form.loading ? (
                      <ActivityIndicator color={theme.colors.white} size="small" />
                    ) : (
                      <>
                        <Ionicons name="rocket-outline" size={22} color={theme.colors.white} />
                        <Text style={styles.publishBtnText}>Publier le trajet</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            )}

          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Location Picker Overlay */}
      {form.pickingLocationFor !== null && (
        <LocationPicker
          title={
            form.pickingLocationFor === 'departure'
              ? 'Lieu de départ'
              : form.pickingLocationFor === 'arrival'
              ? "Lieu d'arrivée"
              : "Ville / Point d'arrêt"
          }
          initialLocation={
            form.pickingLocationFor === 'departure' && form.departureCords && form.departure
              ? { latitude: form.departureCords.lat, longitude: form.departureCords.lon, name: form.departure }
              : form.pickingLocationFor === 'arrival' && form.arrivalCords && form.arrival
              ? { latitude: form.arrivalCords.lat, longitude: form.arrivalCords.lon, name: form.arrival }
              : undefined
          }
          onLocationSelected={(loc: any) => {
            const cords = { lat: loc.latitude, lon: loc.longitude };
            let newDep = form.departure;
            let newArr = form.arrival;

            if (form.pickingLocationFor === 'departure') {
              form.setDeparture(loc.name);
              form.setDepartureCords(cords);
              newDep = loc.name;
            } else if (form.pickingLocationFor === 'arrival') {
              form.setArrival(loc.name);
              form.setArrivalCords(cords);
              newArr = loc.name;
            } else if (form.pickingLocationFor === 'new_custom') {
              form.addStopover(loc.name, cords, 15);
            } else if (form.pickingLocationFor) {
              form.updateStopover(form.pickingLocationFor, { name: loc.name, coords: cords });
            }

            if (newDep && newArr && !form.description) {
              form.setDescription(`Départ de ${newDep} et arrivée à ${newArr}`);
            }
            form.setPickingLocationFor(null);
          }}
          onCancel={() => form.setPickingLocationFor(null)}
        />
      )}

      {/* Summary Recap Modal */}
      <PublishSummaryModal
        visible={form.showSummaryModal}
        onClose={() => form.setShowSummaryModal(false)}
        departure={form.departure}
        arrival={form.arrival}
        stopovers={form.stopovers}
        estimation={form.estimation}
        selectedDateObj={form.selectedDateObj}
        time={form.time}
        seats={form.seats}
        isRecurrent={form.isRecurrent}
        getEstimatedRidesCount={() => {
          if (!form.isRecurrent || form.selectedDays.length === 0) return 0;
          if (form.repeatType === 'single_week') return form.selectedDays.length;
          if (form.endDateObj < form.selectedDateObj) return 0;
          let count = 0;
          const current = new Date(form.selectedDateObj);
          while (current <= form.endDateObj) {
            const jsDay = current.getDay();
            const myDay = jsDay === 0 ? 6 : jsDay - 1;
            if (form.selectedDays.includes(myDay)) count++;
            current.setDate(current.getDate() + 1);
          }
          return count;
        }}
        price={form.price}
        financialSettings={form.financialSettings}
        music={form.music}
        chatty={form.chatty}
        airCond={form.airCond}
        luggageAllowed={form.luggageAllowed}
        luggageSize={form.luggageSize}
        luggageMaxWeightKg={form.luggageMaxWeightKg}
        luggageType={form.luggageType}
        drivingRelay={form.drivingRelay}
        petsAllowed={form.petsAllowed}
        smoking={form.smoking}
        stopsAllowed={form.stopsAllowed}
        description={form.description}
        loading={form.loading}
        onConfirm={() => {
          form.setShowSummaryModal(false);
          form.handlePublish();
        }}
      />

      {/* Profile completion modal */}
      <ProfileCompletionModal
        visible={form.profileModalVisible}
        onClose={() => form.setProfileModalVisible(false)}
        profileStep={form.profileStep}
        getProfileProgress={() => {
          if (form.profileStep === 'personal') return 33;
          if (form.profileStep === 'vehicle') return 66;
          return 100;
        }}
        pickAvatar={form.pickAvatar}
        avatarUri={form.avatarUri}
        editName={form.editName}
        setEditName={form.setEditName}
        editEmail={form.editEmail}
        setEditEmail={form.setEditEmail}
        isSavingProfile={form.isSavingProfile}
        handleSavePersonal={form.handleSavePersonal}
        plate={form.plate}
        setPlate={form.setPlate}
        vehicleType={form.vehicleType}
        setVehicleType={form.setVehicleType}
        driverLicense={form.driverLicense}
        setDriverLicense={form.setDriverLicense}
        licenseExpiration={form.licenseExpiration}
        setLicenseExpiration={form.setLicenseExpiration}
        licenseExpirationError={form.licenseExpirationError}
        pickLicensePhoto={form.pickLicensePhoto}
        driverLicensePhoto={form.driverLicensePhoto}
        setProfileStep={form.setProfileStep}
        handleSaveVehicle={form.handleSaveVehicle}
        music={form.music}
        setMusic={form.setMusic}
        chatty={form.chatty}
        setChatty={form.setChatty}
        smoking={form.smoking}
        setSmoking={form.setSmoking}
        airCond={form.airCond}
        setAirCond={form.setAirCond}
        handleSavePrefs={form.handleSavePrefs}
        user={user}
        brandModel={form.brandModel}
        setBrandModel={form.setBrandModel}
      />

      {/* Vehicle warning */}
      <AppBottomSheet visible={form.showVehicleWarning} onClose={() => form.setShowVehicleWarning(false)} snapPoints={['40%', '50%']}>
        <View style={{ alignItems: 'center', padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 16 }}>
            <Ionicons name="bicycle-outline" size={46} color={theme.colors.primary} />
            <Ionicons name="car-sport-outline" size={46} color={theme.colors.primary} />
            <Ionicons name="car-outline" size={46} color={theme.colors.primary} />
          </View>
          <Text style={styles.modalTitle}>Véhicule requis</Text>
          <Text style={[styles.notLoggedText, { textAlign: 'center', marginTop: 8 }]}>Enregistrez votre véhicule dans votre profil avant de publier.</Text>
          <TouchableOpacity style={[styles.modalBtn, { marginTop: 24, width: '100%' }]} onPress={() => { form.setShowVehicleWarning(false); router.push('/(tabs)/profile?openVehicleModal=true'); }}>
            <LinearGradient colors={[theme.colors.primary, '#3B82F6']} style={styles.modalBtnGradient}>
              <Text style={styles.modalBtnText}>Ajouter un véhicule</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </AppBottomSheet>

      {/* Expired license warning */}
      <AppBottomSheet visible={form.showExpiredLicenseWarning} onClose={() => form.setShowExpiredLicenseWarning(false)} snapPoints={['40%', '50%']}>
        <View style={{ alignItems: 'center', padding: 16 }}>
          <Ionicons name="warning-outline" size={60} color={theme.colors.error} style={{ marginBottom: 16 }} />
          <Text style={styles.modalTitle}>Permis invalide</Text>
          <Text style={[styles.notLoggedText, { textAlign: 'center', marginTop: 8 }]}>Les informations de votre permis sont manquantes ou expirées.</Text>
          <TouchableOpacity style={[styles.modalBtn, { marginTop: 24, width: '100%' }]} onPress={() => { form.setShowExpiredLicenseWarning(false); router.push('/(tabs)/profile'); }}>
            <LinearGradient colors={[theme.colors.primary, '#3B82F6']} style={styles.modalBtnGradient}>
              <Text style={styles.modalBtnText}>Mettre à jour le permis</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </AppBottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6FA' },
  scrollContent: { flexGrow: 1, paddingHorizontal: 16, paddingBottom: 48, paddingTop: 8 },
  header: { backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#EAEDF2', paddingBottom: 8 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: theme.colors.text },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  notLoggedTitle: { fontSize: 22, fontWeight: '800', color: theme.colors.text, marginTop: 16, marginBottom: 8, textAlign: 'center' },
  notLoggedText: { fontSize: 14, color: theme.colors.textLight, textAlign: 'center', marginBottom: 24 },
  notLoggedButton: { borderRadius: 12, overflow: 'hidden' },
  notLoggedGradient: { paddingHorizontal: 32, paddingVertical: 14, justifyContent: 'center', alignItems: 'center' },
  notLoggedButtonText: { color: theme.colors.white, fontWeight: 'bold', fontSize: 16 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: theme.colors.text },
  modalBtn: { marginTop: 8, overflow: 'hidden', borderRadius: 16 },
  modalBtnGradient: { flexDirection: 'row', height: 56, justifyContent: 'center', alignItems: 'center', gap: 8 },
  modalBtnText: { fontSize: 16, fontWeight: '700', color: theme.colors.white },
  nextBtn: { borderRadius: 18, overflow: 'hidden', marginTop: 8 },
  nextBtnGradient: { flexDirection: 'row', height: 60, justifyContent: 'center', alignItems: 'center', gap: 10 },
  nextBtnText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  publishBtn: { borderRadius: 18, overflow: 'hidden', marginTop: 8 },
  publishBtnGradient: { flexDirection: 'row', height: 64, justifyContent: 'center', alignItems: 'center', gap: 12 },
  publishBtnText: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  publishBtnDisabled: { opacity: 0.6 },
  preferencesStepPlaceholderTextActive: {}
});
