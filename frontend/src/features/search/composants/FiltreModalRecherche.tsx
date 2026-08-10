import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Animated,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Ride } from '../../../types/ride';
import { PRIMARY } from './theme-recherche';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type SortOption = 'earliest' | 'price_asc' | 'price_desc';
type TimeSlot = 'morning' | 'afternoon' | 'evening';

export interface FilterState {
  sort: SortOption;
  timeSlots: TimeSlot[];
  verifiedOnly: boolean;
  minSeats: number;
}

export const DEFAULT_FILTERS: FilterState = {
  sort: 'earliest',
  timeSlots: [],
  verifiedOnly: false,
  minSeats: 1,
};

const getHour = (t?: string) => (t ? parseInt(t.split(':')[0], 10) : 0);

const matchesSlot = (r: Ride, slots: TimeSlot[]) => {
  if (!slots.length) return true;
  const h = getHour(r.departure_time);
  return slots.some((s) =>
    s === 'morning' ? h >= 6 && h < 12
    : s === 'afternoon' ? h >= 12 && h < 18
    : h >= 18
  );
};

const SORT_OPTIONS: { id: SortOption; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'earliest',   label: 'Départ le plus tôt', icon: 'time-outline' },
  { id: 'price_asc',  label: 'Prix le plus bas',    icon: 'trending-down-outline' },
  { id: 'price_desc', label: 'Prix le plus élevé',  icon: 'trending-up-outline' },
];

const TIME_SLOTS: { id: TimeSlot; range: string; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'morning',   range: '06:00 – 12:00', label: 'Matin',      icon: 'sunny-outline' },
  { id: 'afternoon', range: '12:01 – 18:00', label: 'Après-midi', icon: 'partly-sunny-outline' },
  { id: 'evening',   range: 'Après 18:00',   label: 'Soirée',     icon: 'moon-outline' },
];

interface FilterModalProps {
  visible: boolean;
  filters: FilterState;
  rides: Ride[];
  onClose: () => void;
  onApply: (f: FilterState) => void;
}

/**
 * Modal de filtres de recherche : tri, plages horaires, conducteurs vérifiés
 * et nombre minimum de places disponibles.
 */
export function FiltreModalRecherche({ visible, filters, rides, onClose, onApply }: FilterModalProps) {
  const insets = useSafeAreaInsets();
  const [local, setLocal] = useState<FilterState>(filters);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      setLocal(filters);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 260,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const toggleSlot = (s: TimeSlot) =>
    setLocal((p) => ({
      ...p,
      timeSlots: p.timeSlots.includes(s)
        ? p.timeSlots.filter((x) => x !== s)
        : [...p.timeSlots, s],
    }));

  const countSlot = (s: TimeSlot) => rides.filter((r) => matchesSlot(r, [s])).length;

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={StyleSheet.absoluteFillObject}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.backdrop} />
      </TouchableOpacity>

      <Animated.View
        style={[
          styles.sheet,
          {
            paddingBottom: insets.bottom + 12,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <View style={styles.handle} />

        {/* Barre de titre */}
        <View style={styles.titleBar}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={20} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.titleTxt}>Filtrer</Text>
          <TouchableOpacity onPress={() => setLocal(DEFAULT_FILTERS)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.clearTxt}>Tout effacer</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* SECTION : TRI */}
          <Text style={styles.sectionHead}>Trier par</Text>
          {SORT_OPTIONS.map((opt) => {
            const isSel = local.sort === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                style={styles.row}
                onPress={() => setLocal((p) => ({ ...p, sort: opt.id }))}
                activeOpacity={0.7}
              >
                <View style={styles.rowLeft}>
                  <View style={[styles.iconBox, isSel && styles.iconBoxOn]}>
                    <Ionicons name={opt.icon} size={16} color={isSel ? PRIMARY : '#4B5563'} />
                  </View>
                  <Text style={styles.rowLabel}>{opt.label}</Text>
                </View>
                <View style={[styles.radio, isSel && styles.radioOn]}>
                  {isSel && <View style={styles.radioDot} />}
                </View>
              </TouchableOpacity>
            );
          })}

          <View style={styles.sep} />

          {/* SECTION : HORAIRES */}
          <Text style={styles.sectionHead}>Heure de départ</Text>
          {TIME_SLOTS.map((slot) => {
            const isSel = local.timeSlots.includes(slot.id);
            const count = countSlot(slot.id);
            return (
              <TouchableOpacity
                key={slot.id}
                style={styles.row}
                onPress={() => toggleSlot(slot.id)}
                activeOpacity={0.7}
              >
                <View style={styles.rowLeft}>
                  <View style={[styles.iconBox, isSel && styles.iconBoxOn]}>
                    <Ionicons name={slot.icon} size={16} color={isSel ? PRIMARY : '#4B5563'} />
                  </View>
                  <View>
                    <Text style={styles.rowLabel}>{slot.label}</Text>
                    <Text style={styles.rowSub}>{slot.range}</Text>
                  </View>
                </View>
                <View style={styles.slotRight}>
                  <Text style={styles.countTxt}>{count}</Text>
                  <View style={[styles.checkbox, isSel && styles.checkboxOn]}>
                    {isSel && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}

          <View style={styles.sep} />

          {/* SECTION : CONDUCTEURS VÉRIFIÉS */}
          <Text style={styles.sectionHead}>Confiance & Sécurité</Text>
          <TouchableOpacity
            style={styles.row}
            onPress={() => setLocal((p) => ({ ...p, verifiedOnly: !p.verifiedOnly }))}
            activeOpacity={0.7}
          >
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, local.verifiedOnly && styles.iconBoxOn]}>
                <Ionicons name="shield-checkmark-outline" size={16} color={local.verifiedOnly ? PRIMARY : '#4B5563'} />
              </View>
              <View>
                <Text style={styles.rowLabel}>Conducteurs vérifiés uniquement</Text>
                <Text style={styles.rowSub}>Profils validés par nos équipes</Text>
              </View>
            </View>
            <View style={[styles.checkbox, local.verifiedOnly && styles.checkboxOn]}>
              {local.verifiedOnly && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
            </View>
          </TouchableOpacity>

          <View style={styles.sep} />

          {/* SECTION : PLACES MINIMUM */}
          <Text style={styles.sectionHead}>Nombre de places minimum</Text>
          <View style={styles.chipsRow}>
            {[1, 2, 3, 4].map((num) => {
              const isSel = local.minSeats === num;
              return (
                <TouchableOpacity
                  key={num}
                  style={[styles.chip, isSel && styles.chipOn]}
                  onPress={() => setLocal((p) => ({ ...p, minSeats: num }))}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.chipTxt, isSel && styles.chipTxtOn]}>
                    {num === 1 ? '1 place' : `${num} places`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.applyBtn}
            onPress={() => onApply(local)}
            activeOpacity={0.9}
          >
            <Text style={styles.applyTxt}>Voir les trajets</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.50)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 26, borderTopRightRadius: 26,
    maxHeight: SCREEN_HEIGHT * 0.88,
    shadowColor: '#000', shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15, shadowRadius: 20, elevation: 24
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB', marginTop: 10, marginBottom: 4 },
  titleBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  titleTxt: { fontSize: 17, fontWeight: '800', color: '#111827' },
  clearTxt: { fontSize: 13, fontWeight: '600', color: PRIMARY },
  scrollContent: { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 100 },
  sectionHead: { fontSize: 14, fontWeight: '800', color: '#111827', marginTop: 18, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: '500', color: '#1F2937' },
  rowSub: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  iconBox: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  iconBoxOn: { backgroundColor: '#EEF3FF' },
  slotRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  countTxt: { fontSize: 13, fontWeight: '700', color: '#9CA3AF', minWidth: 20, textAlign: 'right' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#D1D5DB', justifyContent: 'center', alignItems: 'center' },
  radioOn: { borderColor: PRIMARY },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: PRIMARY },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#D1D5DB', justifyContent: 'center', alignItems: 'center' },
  checkboxOn: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  sep: { height: 1, backgroundColor: '#F3F4F6', marginTop: 16 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingVertical: 12 },
  chip: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 50, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' },
  chipOn: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  chipTxt: { fontSize: 14, fontWeight: '700', color: '#6B7280' },
  chipTxtOn: { color: '#FFFFFF' },
  footer: { paddingHorizontal: 18, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  applyBtn: {
    backgroundColor: PRIMARY, borderRadius: 18, paddingVertical: 15, alignItems: 'center',
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6
  },
  applyTxt: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' }
});
