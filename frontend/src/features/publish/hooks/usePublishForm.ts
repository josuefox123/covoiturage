import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Animated, Keyboard, DeviceEventEmitter } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { CustomAlert } from '../../../../src/utils/CustomAlert';

const BENIN_CITIES_COORDS = [
  { name: 'Allada', lat: 6.6655, lon: 2.1514 },
  { name: 'Bohicon', lat: 7.1782, lon: 2.0667 },
  { name: 'Abomey', lat: 7.1808, lon: 1.9978 },
  { name: 'Dassa-Zoumé', lat: 7.7472, lon: 2.1839 },
  { name: 'Dassa', lat: 7.7472, lon: 2.1839 },
  { name: 'Savè', lat: 8.0333, lon: 2.4833 },
  { name: 'Parakou', lat: 9.3372, lon: 2.6294 },
  { name: 'Tchaourou', lat: 8.8864, lon: 2.5975 },
  { name: 'N\'Dali', lat: 9.8617, lon: 2.6783 },
  { name: 'Bembéréké', lat: 10.2283, lon: 2.6636 },
  { name: 'Kandi', lat: 11.1342, lon: 2.9386 },
  { name: 'Malanville', lat: 11.8667, lon: 3.3833 },
  { name: 'Djougou', lat: 9.7085, lon: 1.6659 },
  { name: 'Natitingou', lat: 10.3042, lon: 1.3794 },
  { name: 'Tanguiéta', lat: 10.6214, lon: 1.2675 },
  { name: 'Ouidah', lat: 6.3667, lon: 2.0833 },
  { name: 'Grand-Popo', lat: 6.2803, lon: 1.8286 },
  { name: 'Lokosa', lat: 6.6384, lon: 1.7167 },
  { name: 'Comè', lat: 6.4083, lon: 1.8817 },
  { name: 'Sèmè-Kpodji', lat: 6.3764, lon: 2.5833 },
  { name: 'Porto-Novo', lat: 6.4969, lon: 2.6289 },
  { name: 'Pobè', lat: 6.9800, lon: 2.6789 },
  { name: 'Kétou', lat: 7.3633, lon: 2.7183 },
  { name: 'Sakété', lat: 6.7361, lon: 2.6586 },
  { name: 'Zogbodomey', lat: 6.9481, lon: 2.0994 },
  { name: 'Abomey-Calavi', lat: 6.4497, lon: 2.3486 },
  { name: 'Cotonou', lat: 6.3654, lon: 2.4183 }
];

export function usePublishForm(authCtx: any) {
  const router = useRouter();
  const user = authCtx?.user ?? null;
  const authFetch = authCtx?.authFetch ?? (async () => ({}));
  const updateUser = authCtx?.updateUser ?? (() => { });

  const now = new Date();

  // Multi-step
  const [formStep, setFormStep] = useState(1);
  const [stopoverSubStep, setStopoverSubStep] = useState<1 | 2>(1);
  const stepAnim = useRef(new Animated.Value(0)).current;

  const animateStep = () => {
    stepAnim.setValue(40);
    Animated.spring(stepAnim, { toValue: 0, friction: 8, tension: 70, useNativeDriver: true }).start();
  };

  const goToStep = (step: number) => {
    animateStep();
    setFormStep(step);
  };

  // Locations & Routes
  const [departure, setDeparture] = useState('');
  const [arrival, setArrival] = useState('');
  const [departureCords, setDepartureCords] = useState<{ lat: number; lon: number } | null>(null);
  const [arrivalCords, setArrivalCords] = useState<{ lat: number; lon: number } | null>(null);
  const [estimation, setEstimation] = useState<{ distanceKm: number; durationMin: number } | null>(null);
  const [estimationLoading, setEstimationLoading] = useState(false);
  const [googleRoutes, setGoogleRoutes] = useState<any[]>([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState<number>(0);
  const [mapReady, setMapReady] = useState(false);

  // Date, Seats & Recurrence
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDateObj, setSelectedDateObj] = useState(now);
  const [timeDate, setTimeDate] = useState(now);
  const [time, setTime] = useState(
    `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
  );
  const [seats, setSeats] = useState(3);
  const [pickingLocationFor, setPickingLocationFor] = useState<string | null>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [isRecurrent, setIsRecurrent] = useState(false);
  const [endDateObj, setEndDateObj] = useState(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000));
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [repeatType, setRepeatType] = useState<'single_week' | 'weekly'>('single_week');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);

  // Stopovers
  const [stopovers, setStopovers] = useState<{ id: string; name: string; coords?: { lat: number; lon: number }; stopDurationMin: number }[]>([]);
  const [detectedStopovers, setDetectedStopovers] = useState<{
    id: string;
    name: string;
    coords: { lat: number; lon: number };
    checked: boolean;
    stopDurationMin: number;
  }[]>([]);

  // Prices
  const [priceSuggestion, setPriceSuggestion] = useState<{
    suggested_price: number; min_price: number; max_price: number;
    price_per_km: number; margin_percent: number;
  } | null>(null);
  const [price, setPrice] = useState('0');
  const [priceLoading, setPriceLoading] = useState(false);
  const [legs, setLegs] = useState<any[]>([]);
  const [legPrices, setLegPrices] = useState<number[]>([]);
  const [priceInputFocused, setPriceInputFocused] = useState(false);
  const [localPriceText, setLocalPriceText] = useState('0');

  // Preferences
  const [music, setMusic] = useState(true);
  const [smoking, setSmoking] = useState(false);
  const [chatty, setChatty] = useState(true);
  const [airCond, setAirCond] = useState(true);
  const [petsAllowed, setPetsAllowed] = useState(false);
  const [luggageAllowed, setLuggageAllowed] = useState(true);
  const [luggageSize, setLuggageSize] = useState<'petit' | 'moyen' | 'grand'>('moyen');
  const [luggageType, setLuggageType] = useState<'per_passenger' | 'total'>('per_passenger');
  const [luggageMaxWeightKg, setLuggageMaxWeightKg] = useState('15');
  const [drivingRelay, setDrivingRelay] = useState(false);
  const [stopsAllowed, setStopsAllowed] = useState(true);
  const [description, setDescription] = useState('');

  // Modals & Warnings
  const [loading, setLoading] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [financialSettings, setFinancialSettings] = useState<any>(null);

  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [profileStep, setProfileStep] = useState<'personal' | 'vehicle' | 'preferences'>('personal');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [editName, setEditName] = useState(user?.full_name || '');
  const [editEmail, setEditEmail] = useState(user?.email || '');
  const [avatarUri, setAvatarUri] = useState<string | null>(user?.avatar || null);
  const [brandModel, setBrandModel] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [plate, setPlate] = useState('');
  const [vehicleType, setVehicleType] = useState('voiture');
  const [driverLicense, setDriverLicense] = useState('');
  const [licenseExpiration, setLicenseExpiration] = useState('');
  const [licenseExpirationError, setLicenseExpirationError] = useState('');
  const [driverLicensePhoto, setDriverLicensePhoto] = useState<string | null>(null);

  const [hasVehicle, setHasVehicle] = useState(false);
  const [vehicleId, setVehicleId] = useState<number | null>(null);
  const [checkingVehicle, setCheckingVehicle] = useState(true);
  const [showVehicleWarning, setShowVehicleWarning] = useState(false);
  const [showExpiredLicenseWarning, setShowExpiredLicenseWarning] = useState(false);

  // Sync Support Bubble
  useEffect(() => {
    if (pickingLocationFor !== null) {
      DeviceEventEmitter.emit('toggleSupportBubble', false);
    } else {
      DeviceEventEmitter.emit('toggleSupportBubble', true);
    }
    return () => {
      DeviceEventEmitter.emit('toggleSupportBubble', true);
    };
  }, [pickingLocationFor]);

  // Sync profile data when user changes
  useEffect(() => {
    if (user) {
      setEditName(user.full_name || '');
      setEditEmail(user.email || '');
      setAvatarUri(user.avatar || null);
    }
  }, [user]);

  // Check vehicle registration
  const checkVehicle = useCallback(async () => {
    if (!user) return;
    try {
      const data = await authFetch(`/vehicles/?owner=${user.id}`);
      const results = Array.isArray(data) ? data : data.results || [];
      if (results.length > 0) {
        const primaryVehicle = results[0];
        setVehicleId(primaryVehicle.id);
        if (primaryVehicle.vehicle_type === 'voiture') {
          if (!primaryVehicle.license_expiration || !primaryVehicle.driver_license_number || !primaryVehicle.driver_license_photo) {
            setHasVehicle(false);
            setShowExpiredLicenseWarning(true);
            return;
          }
          const today = new Date();
          const expDate = new Date(primaryVehicle.license_expiration);
          today.setHours(0, 0, 0, 0);
          if (expDate < today) {
            setHasVehicle(false);
            setShowExpiredLicenseWarning(true);
            return;
          }
        }
        setHasVehicle(true);
      } else {
        setVehicleId(null);
        setHasVehicle(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCheckingVehicle(false);
    }
  }, [user, authFetch]);

  useEffect(() => {
    if (user && user.is_verified) {
      checkVehicle();
    } else {
      setCheckingVehicle(false);
    }
  }, [user, checkVehicle]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const data = await authFetch('/financial-settings/');
        const results = Array.isArray(data) ? data : data.results || [];
        if (results.length > 0) {
          setFinancialSettings(results[0]);
        }
      } catch (_) { }
    };
    fetchSettings();
  }, [authFetch]);

  // Fetch suggested price
  const lastPriceFetchKmRef = useRef<number | null>(null);
  const fetchPriceSuggestion = async (distanceKm: number) => {
    if (lastPriceFetchKmRef.current === distanceKm) return;
    lastPriceFetchKmRef.current = distanceKm;
    setPriceLoading(true);
    try {
      const data = await authFetch(`/rides/suggest-price/?distance_km=${distanceKm}`);
      if (data && data.suggested_price) {
        setPriceSuggestion(data);
      } else {
        throw new Error();
      }
    } catch (_) {
      const baseRate = 30;
      const calculatedPrice = Math.max(1000, Math.round((distanceKm * baseRate) / 100) * 100);
      const minPrice = Math.max(500, Math.round((calculatedPrice * 0.8) / 100) * 100);
      const maxPrice = Math.round((calculatedPrice * 1.2) / 100) * 100;
      setPriceSuggestion({
        suggested_price: calculatedPrice,
        min_price: minPrice,
        max_price: maxPrice,
        price_per_km: baseRate,
        margin_percent: 20,
      });
    } finally {
      setPriceLoading(false);
    }
  };

  // Sync price text
  useEffect(() => {
    if (price !== localPriceText) {
      setLocalPriceText(price);
    }
  }, [price]);

  // Distribute overall price to legs
  const updateOverallPrice = (valStr: string) => {
    const valNum = parseInt(valStr, 10) || 0;
    setPrice(valStr);
    
    if (legs.length > 1) {
      const totalDist = legs.reduce((sum, l) => sum + (l.distanceKm || 0), 0);
      let distributedSum = 0;
      const nextPrices = legs.map((leg, idx) => {
        if (idx === legs.length - 1) {
          return Math.max(0, valNum - distributedSum);
        }
        let share = totalDist > 0 ? (leg.distanceKm || 0) / totalDist : 1 / legs.length;
        const legVal = Math.max(0, Math.round((valNum * share) / 100) * 100);
        distributedSum += legVal;
        return legVal;
      });
      setLegPrices(nextPrices);
    }
  };

  // Build legs based on stopovers
  useEffect(() => {
    if (!departure || !arrival) return;

    const totalDist = estimation?.distanceKm || 100;
    const totalDur = estimation?.durationMin || 120;
    const activeRoute = googleRoutes[selectedRouteIndex];
    const numLegs = stopovers.length + 1;

    let computedLegs: any[] = [];

    if (activeRoute && activeRoute.legs && activeRoute.legs.length === numLegs) {
      computedLegs = activeRoute.legs.map((googleLeg: any, idx: number) => {
        const startLoc = idx === 0 ? departure : stopovers[idx - 1].name;
        const endLoc = idx === numLegs - 1 ? arrival : stopovers[idx].name;
        const distVal = googleLeg.distanceValue || googleLeg.distance?.value || 0;
        const durVal = googleLeg.durationValue || googleLeg.duration?.value || 0;
        const distKm = distVal > 0 ? Math.round(distVal / 1000) : Math.round(totalDist / numLegs);
        const durMin = durVal > 0 ? Math.round(durVal / 60) : Math.round(totalDur / numLegs);

        return {
          start_location: startLoc,
          end_location: endLoc,
          distanceKm: distKm,
          durationMin: durMin,
        };
      });
    } else if (stopovers.length === 0) {
      computedLegs = [
        {
          start_location: departure,
          end_location: arrival,
          distanceKm: totalDist,
          durationMin: totalDur,
        }
      ];
    } else {
      const legDist = Math.round(totalDist / numLegs);
      const legDur = Math.round(totalDur / numLegs);
      for (let i = 0; i < numLegs; i++) {
        const startLoc = i === 0 ? departure : stopovers[i - 1].name;
        const endLoc = i === numLegs - 1 ? arrival : stopovers[i].name;
        computedLegs.push({
          start_location: startLoc,
          end_location: endLoc,
          distanceKm: legDist,
          durationMin: legDur,
        });
      }
    }

    setLegs((prevLegs) => {
      if (JSON.stringify(prevLegs) === JSON.stringify(computedLegs)) return prevLegs;
      return computedLegs;
    });
  }, [stopovers, departure, arrival, estimation, googleRoutes, selectedRouteIndex]);

  // Sync leg prices
  useEffect(() => {
    if (legs && legs.length > 0) {
      setLegPrices((prevPrices) => {
        if (prevPrices.length === legs.length) return prevPrices;
        return legs.map(() => 0);
      });
    } else {
      setLegPrices((prevPrices) => {
        if (prevPrices.length === 0) return prevPrices;
        return [];
      });
    }
  }, [legs]);

  // Sync overall price with legs sum
  useEffect(() => {
    if (legPrices.length > 1) {
      const total = legPrices.reduce((sum, p) => sum + p, 0);
      setPrice(String(total));
    }
  }, [legPrices]);

  const suggestStopoversForRoute = (route: any) => {
    if (!route || !route.steps) return;
    const depCity = (departure || '').split(',')[0].trim().toLowerCase();
    const arrCity = (arrival || '').split(',')[0].trim().toLowerCase();
    
    const getDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371;
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    const suggestions: any[] = [];
    const matchedCitiesByText = new Set<string>();
    route.steps.forEach((step: any) => {
      const text = step.html_instructions || '';
      const cleanText = text.replace(/<[^>]*>/g, '').toLowerCase();
      BENIN_CITIES_COORDS.forEach(cityObj => {
        if (cleanText.includes(cityObj.name.toLowerCase())) {
          matchedCitiesByText.add(cityObj.name.toLowerCase());
        }
      });
    });

    BENIN_CITIES_COORDS.forEach(cityObj => {
      const cityLower = cityObj.name.toLowerCase();
      if (cityLower === depCity || cityLower === arrCity) return;
      if (departureCords && getDistanceKm(cityObj.lat, cityObj.lon, departureCords.lat, departureCords.lon) < 10) return;
      if (arrivalCords && getDistanceKm(cityObj.lat, cityObj.lon, arrivalCords.lat, arrivalCords.lon) < 10) return;

      let isNearRoute = false;
      if (matchedCitiesByText.has(cityLower)) {
        isNearRoute = true;
      } else {
        for (const step of route.steps) {
          if (step.end_location && typeof step.end_location.lat === 'number' && typeof step.end_location.lng === 'number') {
            const dist = getDistanceKm(cityObj.lat, cityObj.lon, step.end_location.lat, step.end_location.lng);
            if (dist <= 12) {
              isNearRoute = true;
              break;
            }
          }
        }
      }

      if (isNearRoute) {
        suggestions.push({
          id: `stopover_${cityObj.name.toLowerCase()}`,
          name: cityObj.name,
          coords: { lat: cityObj.lat, lon: cityObj.lon },
          stopDurationMin: 15
        });
      }
    });

    const checkedStatus = suggestions.map(s => ({ ...s, checked: true }));
    const newStopovers = checkedStatus.map(s => ({ id: s.id, name: s.name, coords: s.coords, stopDurationMin: s.stopDurationMin }));

    setDetectedStopovers((prev) => {
      const prevKey = prev.map(p => p.id).sort().join(',');
      const nextKey = checkedStatus.map(n => n.id).sort().join(',');
      if (prevKey === nextKey) return prev;
      return checkedStatus;
    });

    setStopovers((prev) => {
      const prevKey = prev.map(p => p.id).sort().join(',');
      const nextKey = newStopovers.map(n => n.id).sort().join(',');
      if (prevKey === nextKey) return prev;
      return newStopovers;
    });
  };

  const handleSelectRoute = (idx: number) => {
    setSelectedRouteIndex(idx);
    const selectedRoute = googleRoutes[idx];
    setEstimation({
      distanceKm: Math.round(selectedRoute.distanceValue / 1000),
      durationMin: Math.round(selectedRoute.durationValue / 60)
    });
    fetchPriceSuggestion(Math.round(selectedRoute.distanceValue / 1000));
    suggestStopoversForRoute(selectedRoute);
    setLegs(selectedRoute.legs || []);
  };

  const onMapMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'ready') {
        setMapReady(true);
      } else if (data.type === 'routesCalculated') {
        setGoogleRoutes(data.routes);
        const firstRoute = data.routes[0];
        if (firstRoute) {
          const distKm = Math.round(firstRoute.distanceValue / 1000);
          const durMin = Math.round(firstRoute.durationValue / 60);

          setEstimation((prev) => {
            if (prev && prev.distanceKm === distKm && prev.durationMin === durMin) return prev;
            return { distanceKm: distKm, durationMin: durMin };
          });

          fetchPriceSuggestion(distKm);
          suggestStopoversForRoute(firstRoute);
          setLegs((prevLegs) => {
            const nextLegs = firstRoute.legs || [];
            if (JSON.stringify(prevLegs) === JSON.stringify(nextLegs)) return prevLegs;
            return nextLegs;
          });
        }
        setEstimationLoading(false);
      } else if (data.type === 'routesFailed') {
        if (departureCords && arrivalCords) {
          const R = 6371;
          const dLat = ((arrivalCords.lat - departureCords.lat) * Math.PI) / 180;
          const dLon = ((arrivalCords.lon - departureCords.lon) * Math.PI) / 180;
          const a = Math.sin(dLat / 2) ** 2 + Math.cos((departureCords.lat * Math.PI) / 180) * Math.cos((arrivalCords.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
          const straightKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const distanceKm = Math.round(straightKm * 1.35);
          const durationMin = Math.round((distanceKm / 45) * 60);
          setEstimation((prev) => {
            if (prev && prev.distanceKm === distanceKm && prev.durationMin === durationMin) return prev;
            return { distanceKm, durationMin };
          });
          fetchPriceSuggestion(distanceKm);
        }
        setEstimationLoading(false);
      }
    } catch (e) {
      console.error(e);
      setEstimationLoading(false);
    }
  }, [departureCords, arrivalCords]);

  const toggleStopoverCheck = (id: string) => {
    setDetectedStopovers((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newChecked = !item.checked;
          if (newChecked) {
            setStopovers((prevStops) => {
              if (!prevStops.some((s) => s.name.toLowerCase() === item.name.toLowerCase())) {
                return [...prevStops, { id: item.id, name: item.name, coords: item.coords, stopDurationMin: item.stopDurationMin }];
              }
              return prevStops;
            });
          } else {
            setStopovers((prevStops) => prevStops.filter((s) => s.name.toLowerCase() !== item.name.toLowerCase()));
          }
          return { ...item, checked: newChecked };
        }
        return item;
      })
    );
  };

  const addStopover = (city = '', coords?: { lat: number; lon: number }, duration = 15) => {
    const newId = Math.random().toString();
    setStopovers((prev) => [...prev, { id: newId, name: city, coords, stopDurationMin: duration }]);
    if (coords) {
      setDetectedStopovers((prev) => {
        if (prev.some((s) => s.name.toLowerCase() === city.toLowerCase())) return prev;
        return [...prev, { id: newId, name: city, coords, checked: true, stopDurationMin: duration }];
      });
    }
  };

  const updateStopover = (id: string, updates: Partial<{ name: string; coords?: { lat: number; lon: number }; stopDurationMin: number }>) => {
    setStopovers((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  const removeStopover = (id: string) => {
    setStopovers((prev) => prev.filter((s) => s.id !== id));
  };

  const validateStep1 = () => {
    if (!departure.trim() || !arrival.trim()) {
      CustomAlert.alert('Champs manquants', 'Veuillez sélectionner un lieu de départ et d\'arrivée.');
      return false;
    }
    if (departure === arrival) {
      CustomAlert.alert('Erreur', 'Le départ et l\'arrivée doivent être différents.');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (isRecurrent && selectedDays.length === 0) {
      CustomAlert.alert('Jours manquants', 'Veuillez sélectionner au moins un jour pour la récurrence.');
      return false;
    }
    if (isRecurrent && repeatType === 'weekly' && endDateObj < selectedDateObj) {
      CustomAlert.alert('Erreur', 'La date de fin doit être postérieure à la date de début.');
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    const priceNum = parseInt(price, 10);
    if (!price || isNaN(priceNum) || priceNum <= 0) {
      CustomAlert.alert('Prix manquant', 'Veuillez entrer un prix valide.');
      return false;
    }
    // PRIX OBLIGATOIRES PAR TRONÇON : si le conducteur a des points d'arrêt,
    // chaque tronçon doit avoir un prix > 0 pour que les passagers puissent payer.
    if (stopovers && stopovers.length > 0) {
      const numLegs = stopovers.length + 1;
      for (let i = 0; i < numLegs; i++) {
        const legPrice = legPrices && legPrices.length > i ? legPrices[i] : 0;
        if (!legPrice || legPrice <= 0) {
          CustomAlert.alert(
            'Prix des tronçons obligatoires',
            `Vous avez ajouté des points d'arrêt. Veuillez définir un prix > 0 pour chaque tronçon (tronçon ${i + 1} est à 0).`
          );
          return false;
        }
      }
    }
    return true;
  };


  const handleNext = () => {
    Keyboard.dismiss();
    if (formStep === 1) {
      if (!validateStep1()) return;
      if (googleRoutes.length === 0) {
        CustomAlert.alert('Itinéraire manquant', 'Veuillez patienter pendant le calcul de l\'itinéraire.');
        return;
      }
      setStopoverSubStep(1);
      goToStep(2);
    } else if (formStep === 2) {
      if (stopoverSubStep === 1) {
        setStopoverSubStep(2);
      } else {
        goToStep(3);
      }
    } else if (formStep === 3) {
      if (!validateStep2()) return;
      goToStep(4);
    } else if (formStep === 4) {
      if (!validateStep3()) return;
      if (estimation) fetchPriceSuggestion(estimation.distanceKm);
      goToStep(5);
    }
  };

  const handleBack = () => {
    Keyboard.dismiss();
    if (formStep === 2) {
      if (stopoverSubStep === 2) {
        setStopoverSubStep(1);
      } else {
        goToStep(1);
      }
    } else if (formStep > 1) {
      goToStep(formStep - 1);
    } else {
      router.push('/(tabs)/home');
    }
  };

  const handlePublishPress = () => {
    Keyboard.dismiss();
    const isProfileComplete = !!(user?.full_name && user.full_name.trim() !== '');
    if (!isProfileComplete) {
      setEditName(user?.full_name || '');
      setProfileStep('personal');
      setProfileModalVisible(true);
    } else if (!hasVehicle) {
      setShowVehicleWarning(true);
    } else {
      setShowSummaryModal(true);
    }
  };

  const handlePublish = async () => {
    setLoading(true);
    try {
      const dateString = selectedDateObj.toISOString().split('T')[0];
      const priceNum = parseInt(price, 10);
      const payload: any = {
        departure_location: departure,
        arrival_location: arrival,
        departure_date: dateString,
        departure_time: time + ':00',
        driver_payout: priceNum,
        total_seats: seats,
        seats_available: seats,
        vehicle: vehicleId,
        accepts_parcels: false,
        description: description.trim() || null,
        music,
        smoking,
        chatty,
        air_conditioner: airCond,
        pets_allowed: petsAllowed,
        luggage_allowed: luggageAllowed,
        stops_allowed: stopsAllowed,
        distance_km: estimation?.distanceKm ?? null,
        duration_min: estimation?.durationMin ?? null,
      };

      if (departureCords) { payload.departure_latitude = departureCords.lat; payload.departure_longitude = departureCords.lon; }
      if (arrivalCords) { payload.arrival_latitude = arrivalCords.lat; payload.arrival_longitude = arrivalCords.lon; }

      if (stopovers && stopovers.length > 0) {
        payload.stopovers = stopovers.map((s, idx) => {
          const stopoverPrice = legPrices && legPrices.length > idx ? legPrices[idx] : 0;
          const arrivalPrice = legPrices && legPrices.length > idx + 1 ? legPrices[idx + 1] : 0;
          return {
            name: s.name,
            stopDurationMin: s.stopDurationMin,
            latitude: s.coords?.lat ?? null,
            longitude: s.coords?.lon ?? null,
            price: stopoverPrice,
            ...(idx === stopovers.length - 1 ? { arrival_price: arrivalPrice } : {})
          };
        });
      }

      if (isRecurrent) {
        payload.is_recurrent = true;
        payload.start_date = dateString;
        if (repeatType === 'single_week') {
          const end = new Date(selectedDateObj); end.setDate(end.getDate() + 6);
          payload.end_date = end.toISOString().split('T')[0];
        } else {
          payload.end_date = endDateObj.toISOString().split('T')[0];
        }
        payload.repeat_type = 'weekly';
        payload.week_days = selectedDays;
      }

      const res = await authFetch('/rides/', { method: 'POST', body: JSON.stringify(payload) });
      const message = isRecurrent && res.message ? res.message : `Votre trajet de ${departure} vers ${arrival} a été publié !`;

      CustomAlert.alert('Félicitations !', message, [
        { text: 'Voir mes trajets', onPress: () => router.push('/(tabs)/home') }
      ]);

      // Reset form
      setDeparture(''); setArrival(''); setDepartureCords(null); setArrivalCords(null);
      setStopovers([]); setDetectedStopovers([]); setGoogleRoutes([]); setSelectedRouteIndex(0);
      setEstimation(null); setPrice(''); setSeats(3); setDescription('');
      setIsRecurrent(false); setSelectedDays([]);
      setPriceSuggestion(null);
      goToStep(1);
    } catch (error: any) {
      CustomAlert.alert('Erreur', error.message || 'Impossible de publier le trajet.');
    } finally {
      setLoading(false);
    }
  };

  // Avatar and license picker
  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { CustomAlert.alert('Permission refusée', 'Autorisez l\'accès à vos photos.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.8 });
    if (!result.canceled && result.assets[0]) setAvatarUri(result.assets[0].uri);
  };

  const pickLicensePhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { CustomAlert.alert('Permission refusée', 'Autorisez l\'accès à vos photos.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.8 });
    if (!result.canceled && result.assets[0]) setDriverLicensePhoto(result.assets[0].uri);
  };

  const handleSavePersonal = async () => {
    if (!editName.trim()) { CustomAlert.alert('Erreur', 'Le nom complet est obligatoire.'); return; }
    setIsSavingProfile(true);
    try {
      const formData = new FormData();
      formData.append('full_name', editName);
      if (editEmail) formData.append('email', editEmail);
      if (avatarUri && avatarUri !== user?.avatar) {
        const filename = avatarUri.split('/').pop() || 'avatar.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';
        formData.append('avatar', { uri: avatarUri, name: filename, type } as any);
      }
      await authFetch(`/users/${user!.id}/`, { method: 'PATCH', body: formData });
      updateUser({ full_name: editName, avatar: avatarUri, email: editEmail });
      setProfileStep('vehicle');
    } catch (e: any) {
      CustomAlert.alert('Erreur', e.message || 'Impossible de sauvegarder.');
    } finally { setIsSavingProfile(false); }
  };

  const handleSaveVehicle = async () => {
    if (!brandModel.trim() || !plate.trim()) { CustomAlert.alert('Erreur', 'Veuillez remplir les champs obligatoires du véhicule.'); return; }
    if (vehicleType === 'voiture') {
      if (!driverLicense.trim() || !licenseExpiration.trim() || !driverLicensePhoto) {
        CustomAlert.alert('Erreur', 'Les informations du permis de conduire sont obligatoires pour les voitures.'); return;
      }
      const expDate = new Date(licenseExpiration); const today = new Date(); today.setHours(0, 0, 0, 0);
      if (expDate < today) { setLicenseExpirationError('La date de votre permis est déjà expirée.'); return; }
      else setLicenseExpirationError('');
    }
    setIsSavingProfile(true);
    const formData = new FormData();
    formData.append('owner', user!.id);
    formData.append('brand_model', brandModel);
    formData.append('color', vehicleColor);
    formData.append('license_plate', plate);
    formData.append('vehicle_type', vehicleType);
    if (vehicleType === 'voiture') {
      formData.append('driver_license_number', driverLicense);
      formData.append('license_expiration', licenseExpiration);
    }
    if (vehicleType === 'voiture' && driverLicensePhoto && !driverLicensePhoto.startsWith('http')) {
      const filename = driverLicensePhoto.split('/').pop() || 'license.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';
      formData.append('driver_license_photo', { uri: driverLicensePhoto, name: filename, type } as any);
    }
    try {
      await authFetch('/vehicles/', { method: 'POST', body: formData });
      setHasVehicle(true);
      setProfileStep('preferences');
    } catch (e: any) {
      CustomAlert.alert('Erreur', e.message || 'Impossible d\'ajouter le véhicule.');
    } finally { setIsSavingProfile(false); }
  };

  const handleSavePrefs = async () => {
    setIsSavingProfile(true);
    try {
      await authFetch('/preferences/', { method: 'POST', body: JSON.stringify({ user: user!.id, music, smoking, chatty, air_conditioner: airCond }) });
    } catch (_) { } finally { setIsSavingProfile(false); }
    setProfileModalVisible(false);
    handlePublish();
  };

  const calcCommission = (driverPayout: number) => {
    if (!financialSettings) {
      const pct = 10;
      const minC = 100;
      let commission = Math.floor(driverPayout * (pct / 100));
      if (commission < minC) commission = minC;
      return commission;
    }
    if (!financialSettings.is_commission_active) return 0;
    const pct = financialSettings.commission_percentage !== undefined ? financialSettings.commission_percentage : 10;
    const minC = financialSettings.min_commission !== undefined ? financialSettings.min_commission : 100;
    const maxC = financialSettings.max_commission;
    let commission = Math.floor(driverPayout * (pct / 100));
    if (commission < minC) commission = minC;
    if (maxC && commission > maxC) commission = maxC;
    return commission;
  };

  return {
    formStep,
    stopoverSubStep,
    stepAnim,
    departure,
    arrival,
    departureCords,
    arrivalCords,
    estimation,
    estimationLoading,
    googleRoutes,
    selectedRouteIndex,
    mapReady,
    showDatePicker,
    selectedDateObj,
    timeDate,
    time,
    seats,
    pickingLocationFor,
    showTimePicker,
    isRecurrent,
    endDateObj,
    showEndDatePicker,
    repeatType,
    selectedDays,
    stopovers,
    detectedStopovers,
    priceSuggestion,
    price,
    priceLoading,
    legs,
    legPrices,
    priceInputFocused,
    localPriceText,
    music,
    smoking,
    chatty,
    airCond,
    petsAllowed,
    luggageAllowed,
    luggageSize,
    luggageType,
    luggageMaxWeightKg,
    drivingRelay,
    stopsAllowed,
    description,
    loading,
    showSummaryModal,
    financialSettings,
    profileModalVisible,
    profileStep,
    isSavingProfile,
    editName,
    editEmail,
    avatarUri,
    brandModel,
    vehicleColor,
    plate,
    vehicleType,
    driverLicense,
    licenseExpiration,
    licenseExpirationError,
    driverLicensePhoto,
    hasVehicle,
    vehicleId,
    checkingVehicle,
    showVehicleWarning,
    showExpiredLicenseWarning,
    setDeparture,
    setArrival,
    setDepartureCords,
    setArrivalCords,
    setStopovers,
    setDetectedStopovers,
    setPrice,
    setLocalPriceText,
    setSeats,
    setDescription,
    setIsRecurrent,
    setSelectedDays,
    setRepeatType,
    setSelectedDateObj,
    setEndDateObj,
    setTime,
    setPickingLocationFor,
    setShowDatePicker,
    setShowTimePicker,
    setShowEndDatePicker,
    toggleStopoverCheck,
    addStopover,
    updateStopover,
    removeStopover,
    handleNext,
    handleBack,
    handlePublishPress,
    handlePublish,
    onMapMessage,
    handleSelectRoute,
    pickAvatar,
    pickLicensePhoto,
    handleSavePersonal,
    handleSaveVehicle,
    handleSavePrefs,
    setProfileModalVisible,
    setProfileStep,
    setEditName,
    setEditEmail,
    setBrandModel,
    setVehicleColor,
    setPlate,
    setVehicleType,
    setDriverLicense,
    setLicenseExpiration,
    setDriverLicensePhoto,
    setShowVehicleWarning,
    setShowExpiredLicenseWarning,
    setPriceInputFocused,
    updateOverallPrice,
    setLegPrices,
    setMusic,
    setSmoking,
    setChatty,
    setAirCond,
    setPetsAllowed,
    setLuggageAllowed,
    setLuggageSize,
    setLuggageType,
    setLuggageMaxWeightKg,
    setDrivingRelay,
    setStopsAllowed,
    setShowSummaryModal,
    calcCommission,
  };
}
