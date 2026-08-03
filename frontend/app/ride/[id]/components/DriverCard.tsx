import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Ride } from '../../../src/types';
import { getMediaUrl } from '../../../src/utils/media';

interface DriverCardProps {
  ride: Ride;
  chatLoading: boolean;
  openChat: () => void;
}

export function DriverCard({ ride, chatLoading, openChat }: DriverCardProps) {
  const driverName = ride.driver_details?.full_name || 'Inconnu';
  const driverAvatar = (driverName || '??').split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();

  return (
    <View style={styles.driverCard}>
      <View style={styles.driverProfileHeader}>
        {ride.driver_details?.avatar ? (
          <Image source={{ uri: getMediaUrl(ride.driver_details.avatar) }} style={styles.driverAvatarImage} />
        ) : (
          <View style={styles.driverAvatarPlaceholder}>
            <Text style={styles.driverAvatarText}>{driverAvatar}</Text>
          </View>
        )}
        <View style={styles.driverHeaderInfo}>
          <Text style={styles.driverNameText}>{driverName}</Text>
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={16} color="#F59E0B" />
            <Text style={styles.ratingValueText}>
              {ride.driver_details?.rating ? ride.driver_details.rating.toFixed(1) : '5.0'}
            </Text>
            <Text style={styles.ridesCountText}>
              • {ride.driver_details?.rides_count ?? 0} trajet(s) complété(s)
            </Text>
          </View>
          {ride.driver_details?.is_verified && (
            <View style={styles.verifiedBadgeRow}>
              <Ionicons name="shield-checkmark" size={14} color="#16A34A" />
              <Text style={styles.verifiedTextSmall}>Profil vérifié</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.divider} />

      {ride.driver_details?.vehicles && ride.driver_details.vehicles.length > 0 ? (
        <>
          <Text style={styles.subSectionTitle}>
            {ride.driver_details.vehicles[0].vehicle_type.charAt(0).toUpperCase() + ride.driver_details.vehicles[0].vehicle_type.slice(1)}
          </Text>
          <View style={styles.vehicleDetailsRow}>
            <Ionicons 
              name={
                ride.driver_details.vehicles[0].vehicle_type === 'moto' ? 'bicycle-outline' :
                ride.driver_details.vehicles[0].vehicle_type === 'tricycle' ? 'car-outline' :
                'car-sport-outline'
              } 
              size={24} 
              color="#2F80ED" 
            />
            <View style={styles.vehicleTextContainer}>
              <Text style={styles.vehicleModelText}>
                {ride.driver_details.vehicles[0].brand_model}
              </Text>
              <Text style={styles.vehiclePlateText}>
                Couleur : {ride.driver_details.vehicles[0].color} • Immatriculation : {ride.driver_details.vehicles[0].license_plate}
              </Text>
            </View>
          </View>
        </>
      ) : (
        <>
          <Text style={styles.subSectionTitle}>Véhicule</Text>
          <View style={styles.vehicleDetailsRow}>
            <Ionicons name="car-outline" size={24} color="#6B7280" />
            <View style={styles.vehicleTextContainer}>
              <Text style={styles.noVehicleText}>Aucun véhicule enregistré dans le profil.</Text>
            </View>
          </View>
        </>
      )}

      <View style={styles.divider} />

      {ride.driver_details?.preference && (
        <View style={styles.preferencesSection}>
          <Text style={styles.subSectionTitle}>Préférences de voyage</Text>
          <View style={styles.prefTagsContainer}>
            <View style={styles.prefTagItem}>
              <Text style={styles.prefTagText}>{ride.driver_details.preference.music ? "Musique autorisée" : "Pas de musique"}</Text>
            </View>
            <View style={styles.prefTagItem}>
              <Text style={styles.prefTagText}>{ride.driver_details.preference.smoking ? "Fumeur" : "Non-fumeur"}</Text>
            </View>
            <View style={styles.prefTagItem}>
              <Text style={styles.prefTagText}>{ride.driver_details.preference.chatty ? "Discussion" : "Calme"}</Text>
            </View>
            <View style={styles.prefTagItem}>
              <Text style={styles.prefTagText}>{ride.driver_details.preference.air_conditioner ? "Climatisation" : "Pas de clim"}</Text>
            </View>
            <View style={styles.prefTagItem}>
              <Text style={styles.prefTagText}>{ride.driver_details.preference.pets_allowed ? "Animaux admis" : "Sans animaux"}</Text>
            </View>
            <View style={styles.prefTagItem}>
              <Text style={styles.prefTagText}>{ride.driver_details.preference.luggage_allowed ? "Bagages admis" : "Bagages limités"}</Text>
            </View>
            <View style={styles.prefTagItem}>
              <Text style={styles.prefTagText}>{ride.driver_details.preference.stops_allowed ? "Arrêts possibles" : "Direct (sans arrêts)"}</Text>
            </View>
          </View>
          {ride.driver_details.preference.notes ? (
            <View style={styles.notesContainer}>
              <Text style={styles.notesLabel}>Notes complémentaires :</Text>
              <Text style={styles.notesText}>"{ride.driver_details.preference.notes}"</Text>
            </View>
          ) : null}
        </View>
      )}

      <View style={styles.divider} />

      <TouchableOpacity
        style={styles.contactDriverBtn}
        onPress={openChat}
        disabled={chatLoading}
      >
        {chatLoading ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <>
            <Ionicons name="chatbubble-ellipses" size={20} color="#FFFFFF" />
            <Text style={styles.contactDriverBtnText}>Contacter le conducteur</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  driverCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  driverProfileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16
  },
  driverAvatarImage: {
    width: 64,
    height: 64,
    borderRadius: 32
  },
  driverAvatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center'
  },
  driverAvatarText: {
    color: '#2F80ED',
    fontSize: 22,
    fontWeight: '700'
  },
  driverHeaderInfo: {
    flex: 1,
    gap: 4
  },
  driverNameText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937'
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  ratingValueText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937'
  },
  ridesCountText: {
    fontSize: 13,
    color: '#6B7280'
  },
  verifiedBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2
  },
  verifiedTextSmall: {
    fontSize: 12,
    fontWeight: '600',
    color: '#16A34A'
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 16
  },
  subSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12
  },
  vehicleDetailsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 4
  },
  vehicleTextContainer: {
    flex: 1,
    gap: 4
  },
  vehicleModelText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937'
  },
  vehiclePlateText: {
    fontSize: 13,
    color: '#6B7280'
  },
  noVehicleText: {
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic'
  },
  preferencesSection: {
    paddingHorizontal: 4
  },
  prefTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12
  },
  prefTagItem: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20
  },
  prefTagText: {
    fontSize: 12,
    color: '#1F2937',
    fontWeight: '500'
  },
  notesContainer: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 12,
    marginTop: 8
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2F80ED',
    marginBottom: 4
  },
  notesText: {
    fontSize: 13,
    color: '#1F2937',
    fontStyle: 'italic'
  },
  contactDriverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2F80ED',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
    marginTop: 8
  },
  contactDriverBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700'
  }
});
