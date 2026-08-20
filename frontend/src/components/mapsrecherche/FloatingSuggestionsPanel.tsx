import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LocationData } from './types';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface FloatingSuggestionsPanelProps {
  showSuggestions: boolean;
  isQueryEmpty: boolean;
  recentLocations: LocationData[];
  popularPlaces: LocationData[];
  searchResults: any[];
  isSearching: boolean;
  panY: Animated.Value;
  cardTopMargin: number;
  clearRecentLocations: () => void;
  handleSelectSuggestion: (loc: LocationData) => void;
  handleSelectSearchResult: (item: any) => void;
}

export default function FloatingSuggestionsPanel({
  showSuggestions,
  isQueryEmpty,
  recentLocations,
  popularPlaces,
  searchResults,
  isSearching,
  panY,
  cardTopMargin,
  clearRecentLocations,
  handleSelectSuggestion,
  handleSelectSearchResult,
}: FloatingSuggestionsPanelProps) {
  if (!showSuggestions) return null;

  return (
    <Animated.View
      style={[
        styles.floatingSuggestionsPanel,
        {
          top: cardTopMargin + 60,
          transform: [
            {
              translateY: panY.interpolate({
                inputRange: [-100, 0, SCREEN_HEIGHT],
                outputRange: [-10, 0, SCREEN_HEIGHT],
                extrapolate: 'clamp',
              }),
            },
          ],
        },
      ]}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 16 }}
      >
        {/* Départs récents */}
        {recentLocations.length > 0 && isQueryEmpty && (
          <View style={styles.dropdownSection}>
            <View style={styles.dropdownSectionHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="time-outline" size={15} color="#0066FF" style={{ marginRight: 5 }} />
                <Text style={styles.dropdownSectionTitle}>Départs récents</Text>
              </View>
              <TouchableOpacity onPress={clearRecentLocations} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.clearHistoryText}>Effacer</Text>
              </TouchableOpacity>
            </View>
            {recentLocations.map((item, index) => (
              <TouchableOpacity
                key={`recent-${index}-${item.name}`}
                style={[styles.suggestionItem, index === recentLocations.length - 1 && styles.suggestionItemLast]}
                onPress={() => handleSelectSuggestion(item)}
                activeOpacity={0.7}
              >
                <View style={styles.recentIconBadge}>
                  <Ionicons name="time" size={15} color="#0066FF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.suggestionTitle} numberOfLines={1}>{item.name}</Text>
                  {(item.address || item.city) ? (
                    <Text style={styles.suggestionSubtitle} numberOfLines={1}>{item.address || item.city}</Text>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={15} color="#D1D5DB" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Lieux populaires */}
        {isQueryEmpty && (
          <View style={styles.dropdownSection}>
            <View style={styles.dropdownSectionHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="sparkles-outline" size={15} color="#F59E0B" style={{ marginRight: 5 }} />
                <Text style={styles.dropdownSectionTitle}>Lieux populaires au Bénin</Text>
              </View>
            </View>
            {popularPlaces.map((item, index) => (
              <TouchableOpacity
                key={`popular-${index}-${item.name}`}
                style={[styles.suggestionItem, index === popularPlaces.length - 1 && styles.suggestionItemLast]}
                onPress={() => handleSelectSuggestion(item)}
                activeOpacity={0.7}
              >
                <View style={styles.popularIconBadge}>
                  <Ionicons name="location-sharp" size={15} color="#0066FF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.suggestionTitle} numberOfLines={1}>{item.name}</Text>
                  {(item.address || item.city) ? (
                    <Text style={styles.suggestionSubtitle} numberOfLines={1}>{item.address || item.city}</Text>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={15} color="#D1D5DB" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Résultats de recherche en direct */}
        {!isQueryEmpty && (
          <View>
            {isSearching && searchResults.length === 0 && (
              <View style={styles.searchingRow}>
                <ActivityIndicator size="small" color="#0066FF" />
                <Text style={styles.searchingText}>Recherche en cours...</Text>
              </View>
            )}
            {searchResults.map((item, index) => {
              let itemTitle = '';
              let itemSubtitle = '';
              if (item.latitude !== undefined) {
                itemTitle = item.name;
                itemSubtitle = item.city ? `${item.city}, Bénin` : 'Bénin';
              } else {
                const displayName = item.display_name || '';
                const parts = displayName.split(',');
                itemTitle = item.name || parts[0] || 'Lieu';
                itemSubtitle = parts.slice(1, 4).join(',').trim();
              }
              return (
                <TouchableOpacity
                  key={item.id || item.place_id?.toString() || `search-${index}`}
                  style={[
                    styles.suggestionItem,
                    index === 0 && styles.suggestionItemFirst,
                    index === searchResults.length - 1 && styles.suggestionItemLast,
                  ]}
                  onPress={() => handleSelectSearchResult(item)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.searchIconBadge, index === 0 && styles.searchIconBadgeTop]}>
                    <Ionicons name={index === 0 ? 'location' : 'navigate-outline'} size={15} color={index === 0 ? '#0066FF' : '#6B7280'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.suggestionTitle, index === 0 && styles.suggestionTitleTop]} numberOfLines={1}>{itemTitle}</Text>
                    {itemSubtitle ? (
                      <Text style={styles.suggestionSubtitle} numberOfLines={1}>{itemSubtitle}</Text>
                    ) : null}
                  </View>
                  {index === 0 && (
                    <View style={styles.previewBadge}>
                      <Text style={styles.previewBadgeText}>Aperçu</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
            {!isSearching && searchResults.length === 0 && (
              <View style={styles.emptySearchContainer}>
                <Ionicons name="search-outline" size={30} color="#9CA3AF" />
                <Text style={styles.emptySearchTitle}>Aucun résultat</Text>
                <Text style={styles.emptySearchSubtitle}>Essayez un autre terme ou glissez la carte.</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  floatingSuggestionsPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    maxHeight: '78%',
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 12,
    zIndex: 50,
    paddingTop: 6,
  },
  dropdownSection: {
    marginBottom: 10,
    backgroundColor: '#F8FAFF',
    borderRadius: 14,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dropdownSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginBottom: 4,
  },
  dropdownSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1F2937',
  },
  clearHistoryText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#EF4444',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 12,
  },
  suggestionItemFirst: {
    backgroundColor: '#F0F7FF',
    borderRadius: 10,
    paddingHorizontal: 8,
    marginBottom: 2,
  },
  suggestionItemLast: {
    borderBottomWidth: 0,
  },
  recentIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  popularIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchIconBadgeTop: {
    backgroundColor: '#A7F3D0',
  },
  suggestionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  suggestionTitleTop: {
    fontSize: 14,
    color: '#047857',
  },
  suggestionSubtitle: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1,
  },
  previewBadge: {
    backgroundColor: '#FFAA00',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  previewBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  searchingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 10,
  },
  searchingText: {
    fontSize: 13,
    color: '#6B7280',
  },
  emptySearchContainer: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySearchTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginTop: 6,
  },
  emptySearchSubtitle: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 2,
  },
});
