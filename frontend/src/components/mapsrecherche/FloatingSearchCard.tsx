import React from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface FloatingSearchCardProps {
  cardTopMargin: number;
  isSearchFocused: boolean;
  setIsSearchFocused: (focused: boolean) => void;
  searchQuery: string;
  handleSearchChange: (text: string) => void;
  handleFocusSearch: () => void;
  isSearching: boolean;
  setShowFilters: (show: boolean) => void;
  searchInputRef: React.RefObject<TextInput | null>;
  snapTo: (target: 'expanded' | 'lowered' | 'closed') => void;
}

export default function FloatingSearchCard({
  cardTopMargin,
  isSearchFocused,
  setIsSearchFocused,
  searchQuery,
  handleSearchChange,
  handleFocusSearch,
  isSearching,
  setShowFilters,
  searchInputRef,
  snapTo,
}: FloatingSearchCardProps) {
  return (
    <>
      {/* Back button visible when search is NOT focused */}
      {!isSearchFocused && (
        <View style={[styles.modernBackBtnContainer, { top: cardTopMargin }]}>
          <TouchableOpacity
            style={styles.modernBackBtn}
            onPress={() => snapTo('closed')}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={22} color="#1F2937" />
          </TouchableOpacity>
        </View>
      )}

      {/* Floating Search Bar */}
      <View
        style={[
          isSearchFocused ? styles.floatingSearchCardFocused : styles.floatingSearchCard,
          {
            top: cardTopMargin,
            left: isSearchFocused ? 16 : 72,
          },
        ]}
      >
        {isSearchFocused ? (
          <TouchableOpacity
            style={styles.floatingBackBtn}
            onPress={() => {
              Keyboard.dismiss();
              setIsSearchFocused(false);
            }}
          >
            <Ionicons name="arrow-back" size={22} color="#1F2937" />
          </TouchableOpacity>
        ) : (
          <Ionicons name="location" size={20} color="#0066FF" style={{ marginRight: 8 }} />
        )}
        <TextInput
          ref={searchInputRef}
          style={styles.floatingSearchInput}
          placeholder="Rechercher une ville, quartier..."
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={handleSearchChange}
          onFocus={handleFocusSearch}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          autoFocus={true}
        />
        {isSearching ? (
          <ActivityIndicator size="small" color="#0066FF" style={{ marginRight: 4 }} />
        ) : searchQuery.length > 0 ? (
          <TouchableOpacity onPress={() => handleSearchChange('')}>
            <Ionicons name="close-circle" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        ) : !isSearchFocused ? (
          <TouchableOpacity style={{ padding: 4 }} onPress={() => setShowFilters(true)}>
            <Ionicons name="options-outline" size={20} color="#6B7280" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => {
              Keyboard.dismiss();
              setIsSearchFocused(false);
            }}
          >
            <Ionicons name="chevron-up" size={18} color="#0066FF" />
          </TouchableOpacity>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  modernBackBtnContainer: {
    position: 'absolute',
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    zIndex: 101,
  },
  modernBackBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
  floatingSearchCard: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 16,
    height: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 100,
  },
  floatingSearchCardFocused: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 16,
    height: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 100,
  },
  floatingBackBtn: {
    padding: 8,
    marginRight: 4,
  },
  floatingSearchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    paddingVertical: 8,
  },
});
