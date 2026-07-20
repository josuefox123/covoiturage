/**
 * SearchCard — carte de recherche complète.
 * Champs : départ, destination, date, heure, aller/retour, nombre de passagers.
 */
import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import LocationPicker from '../LocationPicker';
import { VehicleType } from './ServiceSelector';

import { CustomAlert } from '../../utils/CustomAlert';

const PRIMARY = '#0066FF';

export interface SearchParams {
  departure: string;
  destination: string;
  vehicleType: VehicleType;
  date: Date;
  tripType: 'aller' | 'retour';
  passengers: number;
}

interface SearchCardProps {
  params: SearchParams;
  onChange: (p: Partial<SearchParams>) => void;
  onSearch: () => void;
  onPickLocation: (type: 'departure' | 'arrival') => void;
}
const formatDate = (d: Date) =>
  d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });

export default function SearchCard({ params, onChange, onSearch, onPickLocation }: SearchCardProps) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const btnScale = useRef(new Animated.Value(1)).current;

  const handleSearchPress = () => {
    if (!params.departure.trim() && !params.destination.trim()) {
      CustomAlert.alert(
        'Lieu requis',
        'Veuillez renseigner au moins un lieu de départ ou une destination pour lancer la recherche.'
      );
      return;
    }

    Animated.sequence([
      Animated.timing(btnScale, { toValue: 0.95, duration: 80, useNativeDriver: true }),
      Animated.spring(btnScale, { toValue: 1, tension: 200, friction: 10, useNativeDriver: true }),
    ]).start();
    onSearch();
  };

  const swap = () => {
    onChange({ departure: params.destination, destination: params.departure });
  };

  const decreasePassengers = () => {
    if (params.passengers > 1) onChange({ passengers: params.passengers - 1 });
  };

  const increasePassengers = () => {
    if (params.passengers < 8) onChange({ passengers: params.passengers + 1 });
  };

  return (
    <>
      <View style={styles.card}>
        {/* ── Trip type toggle ── */}
        <View style={styles.tripTypeRow}>
          <TouchableOpacity
            style={[styles.tripTypeBtn, params.tripType === 'aller' && styles.tripTypeBtnActive]}
            onPress={() => onChange({ tripType: 'aller' })}
            activeOpacity={0.8}
          >
            <Ionicons
              name="arrow-forward"
              size={13}
              color={params.tripType === 'aller' ? '#fff' : '#6B7280'}
            />
            <Text style={[styles.tripTypeTxt, params.tripType === 'aller' && styles.tripTypeTxtActive]}>
              Aller simple
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tripTypeBtn, params.tripType === 'retour' && styles.tripTypeBtnActive]}
            onPress={() => onChange({ tripType: 'retour' })}
            activeOpacity={0.8}
          >
            <Ionicons
              name="swap-horizontal"
              size={13}
              color={params.tripType === 'retour' ? '#fff' : '#6B7280'}
            />
            <Text style={[styles.tripTypeTxt, params.tripType === 'retour' && styles.tripTypeTxtActive]}>
              Aller-retour
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Départ ── */}
        <TouchableOpacity
          style={styles.inputRow}
          onPress={() => onPickLocation('departure')}
          activeOpacity={0.8}
        >
          <View style={styles.dotFrom} />
          <View style={styles.inputContent}>
            <Text style={styles.inputLabel}>Départ</Text>
            <Text style={params.departure ? styles.inputValue : styles.inputPlaceholder}>
              {params.departure || "D'où partez-vous ?"}
            </Text>
          </View>
          {params.departure ? (
            <TouchableOpacity
              onPress={() => onChange({ departure: '' })}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          ) : (
            <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
          )}
        </TouchableOpacity>

        {/* swap button */}
        <View style={styles.swapRow}>
          <View style={styles.swapLine} />
          <TouchableOpacity style={styles.swapBtn} onPress={swap} activeOpacity={0.8}>
            <Ionicons name="swap-vertical" size={17} color={PRIMARY} />
          </TouchableOpacity>
        </View>

        {/* ── Destination ── */}
        <TouchableOpacity
          style={styles.inputRow}
          onPress={() => onPickLocation('arrival')}
          activeOpacity={0.8}
        >
          <View style={styles.dotTo} />
          <View style={styles.inputContent}>
            <Text style={styles.inputLabel}>Destination</Text>
            <Text style={params.destination ? styles.inputValue : styles.inputPlaceholder}>
              {params.destination || 'Où allez-vous ?'}
            </Text>
          </View>
          {params.destination ? (
            <TouchableOpacity
              onPress={() => onChange({ destination: '' })}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          ) : (
            <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
          )}
        </TouchableOpacity>

        <View style={styles.hr} />

        {/* ── Date + Passagers ── */}
        <View style={styles.metaGrid}>
          {/* Date */}
          <TouchableOpacity
            style={styles.metaCell}
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="calendar-outline" size={18} color={PRIMARY} />
            <View style={styles.metaCellText}>
              <Text style={styles.metaLabel}>Date</Text>
              <Text style={styles.metaValue}>{formatDate(params.date)}</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.metaVDivider} />

          {/* Passagers */}
          <View style={styles.metaCell}>
            <Ionicons name="people-outline" size={18} color={PRIMARY} />
            <View style={styles.metaCellText}>
              <Text style={styles.metaLabel}>Passager{params.passengers > 1 ? 's' : ''}</Text>
              <View style={styles.passengerRow}>
                <TouchableOpacity
                  onPress={decreasePassengers}
                  style={styles.counterBtn}
                  activeOpacity={0.8}
                >
                  <Ionicons name="remove" size={14} color={PRIMARY} />
                </TouchableOpacity>
                <Text style={styles.counterValue}>{params.passengers}</Text>
                <TouchableOpacity
                  onPress={increasePassengers}
                  style={styles.counterBtn}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add" size={14} color={PRIMARY} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* ── Search button ── */}
        <Animated.View style={{ transform: [{ scale: btnScale }], marginTop: 16 }}>
          <TouchableOpacity style={styles.searchBtn} onPress={handleSearchPress} activeOpacity={0.9}>
            <Ionicons name="search" size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.searchBtnText}>Rechercher</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* ── Date picker ── */}
      {showDatePicker && (
        <DateTimePicker
          value={params.date}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          minimumDate={new Date()}
          onChange={(_, selected) => {
            setShowDatePicker(Platform.OS === 'ios');
            if (selected) onChange({ date: selected });
            if (Platform.OS === 'android') setShowDatePicker(false);
          }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    marginHorizontal: 20,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 4,
    position: 'relative',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 10,
  },
  tripTypeRow: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
    marginBottom: 10,
  },
  tripTypeBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  tripTypeBtnActive: {
    backgroundColor: PRIMARY,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  tripTypeTxt: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  tripTypeTxtActive: {
    color: '#fff',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  dotFrom: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22C55E',
    marginRight: 14,
  },
  dotTo: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: PRIMARY,
    marginRight: 14,
  },
  inputContent: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
    marginBottom: 2,
  },
  inputValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
  },
  inputPlaceholder: {
    fontSize: 15,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  swapRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  swapLine: {
    width: 2,
    height: 10,
    backgroundColor: '#E5E7EB',
    marginLeft: 12,
  },
  swapBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  hr: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 6,
  },
  metaGrid: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 2,
  },
  metaCellText: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
  },
  metaVDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 12,
  },
  passengerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  counterBtn: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#EEF3FF', justifyContent: 'center', alignItems: 'center',
  },
  counterValue: { fontSize: 14, fontWeight: '800', color: '#1F2937' },

  searchBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  searchBtnText: {
    color: '#FFFFFF', fontSize: 15, fontWeight: '700', letterSpacing: 0.3,
  },
});
