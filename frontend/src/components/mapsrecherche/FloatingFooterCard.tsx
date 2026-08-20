import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LocationData } from './types';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface FloatingFooterCardProps {
  panY: Animated.Value;
  panResponder: any;
  isLoadingAddress: boolean;
  selectedLocation: LocationData | null;
  isFavorite: boolean;
  setIsFavorite: (fav: boolean) => void;
  customLocationName: string;
  setCustomLocationName: (text: string) => void;
  handleConfirmLocation: () => void;
  selectShortcut: (type: string) => void;
  nearbySuggestions: LocationData[];
  setSelectedLocation: (loc: LocationData) => void;
  sendToMap: (msg: any) => void;
}

export default function FloatingFooterCard({
  panY,
  panResponder,
  isLoadingAddress,
  selectedLocation,
  isFavorite,
  setIsFavorite,
  customLocationName,
  setCustomLocationName,
  handleConfirmLocation,
  selectShortcut,
  nearbySuggestions,
  setSelectedLocation,
  sendToMap,
}: FloatingFooterCardProps) {
  const insets = useSafeAreaInsets();

  return (
    <Animated.View
      style={[
        styles.floatingFooterCard,
        {
          bottom: 0,
          transform: [
            {
              translateY: panY.interpolate({
                inputRange: [-100, 0, SCREEN_HEIGHT],
                outputRange: [0, 0, SCREEN_HEIGHT],
                extrapolate: 'clamp',
              }),
            },
          ],
        },
      ]}
    >
      {/* Header area acts as the PanResponder drag zone */}
      <View {...panResponder.panHandlers} style={styles.dragZone}>
        {/* Top Grab Handle */}
        <View style={styles.sheetHandle} />

        {/* Location Title Header with Favorite Star */}
        <View style={styles.bottomSheetHeader}>
          <View style={styles.locationIconCircle}>
            <Ionicons name="location" size={20} color="#0066FF" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            {isLoadingAddress ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#0066FF" style={{ marginRight: 6 }} />
                <Text style={styles.loadingAddrText}>Recherche du lieu...</Text>
              </View>
            ) : (
              <>
                <Text style={styles.sheetLocationTitle} numberOfLines={1}>
                  {selectedLocation?.name || 'Déplacez la carte pour choisir'}
                </Text>
                {selectedLocation?.address ? (
                  <Text style={styles.sheetLocationSubtitle} numberOfLines={1}>
                    {selectedLocation.address}
                  </Text>
                ) : null}
              </>
            )}
          </View>
          <TouchableOpacity style={styles.starBtn} onPress={() => setIsFavorite(!isFavorite)} activeOpacity={0.7}>
            <Ionicons name={isFavorite ? 'star' : 'star-outline'} size={22} color={isFavorite ? '#F59E0B' : '#9CA3AF'} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Scrollable sheet body content */}
      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
        {/* Saisie précision optionnelle */}
        <View style={styles.customNoteInputRow}>
          <Ionicons name="pencil" size={16} color="#6B7280" />
          <TextInput
            style={styles.customNoteInput}
            placeholder="Ajouter un détail (bâtiment, référence...)"
            placeholderTextColor="#9CA3AF"
            value={customLocationName}
            onChangeText={setCustomLocationName}
          />
        </View>

        {/* Bouton de confirmation principal */}
        <TouchableOpacity
          style={[styles.confirmLocationBtn, isLoadingAddress && styles.confirmBtnDisabled]}
          onPress={handleConfirmLocation}
          disabled={isLoadingAddress}
          activeOpacity={0.85}
        >
          <Text style={styles.confirmBtnText}>Confirmer cet emplacement</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
        </TouchableOpacity>



        {/* Suggestions proches */}
        {nearbySuggestions.length > 0 && (
          <>
            <Text style={styles.suggestionsSectionTitle}>Suggestions proches</Text>
            <View style={styles.nearbyList}>
              {nearbySuggestions.map((item, idx) => (
                <TouchableOpacity
                  key={`nearby-${idx}`}
                  style={styles.nearbyItem}
                  onPress={() => {
                    setSelectedLocation(item);
                    setCustomLocationName(item.name);
                    sendToMap({ type: 'setView', lat: item.latitude, lon: item.longitude, zoom: 16 });
                  }}
                  activeOpacity={0.75}
                >
                  <Ionicons name="location-outline" size={16} color="#9CA3AF" style={{ marginRight: 10 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.nearbyName}>{item.name}</Text>
                    <Text style={styles.nearbySub}>{item.city ? `${item.city}, Bénin` : 'Bénin'}</Text>
                  </View>
                  <Text style={styles.nearbyDistance}>{item.distanceText}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  floatingFooterCard: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.60,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 16,
    zIndex: 10,
  },
  dragZone: {
    width: '100%',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginBottom: 16,
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  locationIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetLocationTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1F2937',
  },
  sheetLocationSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  loadingAddrText: {
    fontSize: 12,
    color: '#0066FF',
    marginTop: 2,
  },
  starBtn: {
    padding: 6,
  },
  customNoteInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 16,
    gap: 8,
  },
  customNoteInput: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '500',
  },
  confirmLocationBtn: {
    backgroundColor: '#0B56E4',
    height: 52,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0B56E4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 16,
  },
  confirmBtnDisabled: {
    opacity: 0.6,
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  shortcutsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 20,
  },
  shortcutBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flex: 1,
    justifyContent: 'center',
  },
  shortcutText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },
  suggestionsSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 12,
  },
  nearbyList: {
    gap: 12,
    marginBottom: 10,
  },
  nearbyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  nearbyName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  nearbySub: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 1,
  },
  nearbyDistance: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
  },
});
