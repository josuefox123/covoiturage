import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ResolveurMission } from '../resolution/resolveur-mission';
import { BadgeStatut } from './BadgeStatut';
import { BoutonsAction } from './BoutonsAction';
import { BarreProgression } from './BarreProgression';
import { theme } from '../../../styles/theme';

interface CarteTrajetProps {
  item: any;
  role?: 'passenger' | 'driver';
  onPressCard?: () => void;
  onCancelBooking?: (bookingId: string) => void;
  onAcceptOffer?: (bookingId: string) => void;
  onRejectOffer?: (bookingId: string) => void;
  onRateDriver?: (rideId: string) => void;
  onStartTrip?: (rideId: string) => void;
  onFinishTrip?: (rideId: string) => void;
}

/**
 * Carte principale d'affichage d'un trajet ou d'une réservation.
 * Affiche les informations, le statut, l'itinéraire et les boutons d'action.
 */
export function CarteTrajet({
  item,
  role = 'passenger',
  onPressCard,
  onCancelBooking,
  onAcceptOffer,
  onRejectOffer,
  onRateDriver,
  onStartTrip,
  onFinishTrip
}: CarteTrajetProps) {
  const router = useRouter();
  const mission = ResolveurMission.resolveMission(item, role);
  const { data } = mission;

  const handlePress = () => {
    if (onPressCard) {
      onPressCard();
    } else if (data.rideId) {
      if (role === 'driver') {
        router.push(`/ride-management/${data.rideId}`);
      } else {
        router.push(`/ride/${data.rideId}`);
      }
    }
  };

  return (
    <TouchableOpacity
      style={styles.carte}
      activeOpacity={0.9}
      onPress={handlePress}
    >
      {/* En-tête avec titre et badge */}
      <View style={styles.entete}>
        <View style={styles.ligneTitre}>
          <Ionicons name={mission.iconName} size={18} color={mission.iconColor} />
          <Text style={styles.titre} numberOfLines={1}>
            {mission.title}
          </Text>
        </View>
        <BadgeStatut mission={mission} />
      </View>

      {/* Description */}
      <Text style={styles.description} numberOfLines={2}>
        {mission.description}
      </Text>

      {/* Itinéraire et horaire */}
      <View style={styles.conteneurItineraire}>
        <View style={styles.ligneRoute}>
          <Ionicons name="location-outline" size={16} color={theme.colors.primary} />
          <Text style={styles.texteRoute} numberOfLines={1}>
            {data.departureLocation}
          </Text>
          <Ionicons
            name="arrow-forward-outline"
            size={14}
            color={theme.colors.grayDark}
            style={{ marginHorizontal: 6 }}
          />
          <Text style={styles.texteRoute} numberOfLines={1}>
            {data.arrivalLocation}
          </Text>
        </View>

        <View style={styles.ligneHoraire}>
          <Ionicons name="calendar-outline" size={14} color={theme.colors.grayDark} />
          <Text style={styles.texteHoraire}>
            {data.departureDate} • {data.departureTime}
          </Text>
        </View>
      </View>

      {/* Prix et code OTP/Ticket */}
      <View style={styles.ligneInfos}>
        {data.amount ? (
          <View style={styles.chipPrix}>
            <Text style={styles.libellePrix}>Montant : </Text>
            <Text style={styles.valeurPrix}>
              {typeof data.amount === 'number'
                ? `${data.amount.toLocaleString()} FCFA`
                : data.amount}
            </Text>
          </View>
        ) : null}

        {data.otpCode ? (
          <View style={styles.chipOtp}>
            <Ionicons name="key-outline" size={14} color={theme.colors.primary} />
            <Text style={styles.libelleOtp}>
              {data.otpCode.startsWith('T-') ? 'N° Ticket : ' : 'Code OTP : '}
            </Text>
            <Text style={styles.valeurOtp}>{data.otpCode}</Text>
          </View>
        ) : null}
      </View>

      {/* Barre de progression */}
      {mission.progress > 0 && mission.progress < 100 ? (
        <BarreProgression progression={mission.progress} />
      ) : null}

      {/* Boutons d'action */}
      <BoutonsAction
        mission={mission}
        onCancelBooking={onCancelBooking}
        onAcceptOffer={onAcceptOffer}
        onRejectOffer={onRejectOffer}
        onRateDriver={onRateDriver}
        onStartTrip={onStartTrip}
        onFinishTrip={onFinishTrip}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  carte: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2
  },
  entete: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  ligneTitre: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: 8
  },
  titre: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
    flex: 1
  },
  description: {
    fontSize: 13,
    color: theme.colors.textLight,
    marginBottom: 12,
    lineHeight: 18
  },
  conteneurItineraire: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    gap: 6
  },
  ligneRoute: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  texteRoute: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text,
    flexShrink: 1
  },
  ligneHoraire: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  texteHoraire: {
    fontSize: 12,
    color: theme.colors.textLight
  },
  ligneInfos: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    flexWrap: 'wrap',
    gap: 8
  },
  chipPrix: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  libellePrix: {
    fontSize: 12,
    color: theme.colors.textLight
  },
  valeurPrix: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.primary
  },
  chipOtp: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4
  },
  libelleOtp: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '500'
  },
  valeurOtp: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.primary
  }
});
