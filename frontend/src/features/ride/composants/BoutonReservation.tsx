import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CustomAlert } from '../../../utils/CustomAlert';
import { C, SHlg } from './theme-trajet';

interface BoutonReservationProps {
  rideAction: { action: string; label?: string };
  bookingLoading: boolean;
  isStarted: boolean;
  scaleAnim: Animated.Value;
  onBooking: () => void;
  onRetryPayment: () => void;
  onCancel: () => void;
  onShowNegModal: () => void;
}

/**
 * Bouton principal de l'écran détail trajet passager.
 * Adapte son rendu selon l'état de la réservation (action).
 */
export function BoutonReservation({
  rideAction,
  bookingLoading,
  isStarted,
  scaleAnim,
  onBooking,
  onRetryPayment,
  onCancel,
  onShowNegModal,
}: BoutonReservationProps) {
  const wrap = (content: React.ReactNode, fn: () => void, extraStyle?: any, dis?: boolean) => (
    <Animated.View style={{ flex: 1, transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={[styles.bookBtn, extraStyle, dis && { opacity: 0.6 }]}
        onPress={fn}
        disabled={dis}
        activeOpacity={0.9}
      >
        {content}
      </TouchableOpacity>
    </Animated.View>
  );

  switch (rideAction.action) {
    case 'own_ride':
      return (
        <View style={[styles.bookBtn, { backgroundColor: C.borderMid }]}>
          <Text style={[styles.bookBtnTxt, { color: C.textSec }]} adjustsFontSizeToFit numberOfLines={1}>
            Votre trajet
          </Text>
        </View>
      );

    case 'completed':
      return (
        <View style={[styles.bookBtn, { backgroundColor: C.borderMid }]}>
          <Text style={[styles.bookBtnTxt, { color: C.textSec }]} adjustsFontSizeToFit numberOfLines={1}>
            Trajet terminé
          </Text>
        </View>
      );

    case 'reserve':
    case 'expired':
    case 'cancelled':
      return wrap(
        bookingLoading ? <ActivityIndicator color={C.white} /> :
        isStarted ? <Text style={styles.bookBtnTxt} adjustsFontSizeToFit numberOfLines={1}>En cours</Text> : (
          <View style={styles.rowC}>
            <Text style={styles.bookBtnTxt} adjustsFontSizeToFit numberOfLines={1}>Réserver maintenant</Text>
            <Ionicons name="arrow-forward" size={19} color={C.white} />
          </View>
        ),
        onBooking, {}, bookingLoading || isStarted
      );

    case 'waiting_driver':
      return wrap(
        <View style={styles.rowC}>
          <Ionicons name="time-outline" size={17} color={C.white} />
          <Text style={styles.bookBtnTxt} adjustsFontSizeToFit numberOfLines={1}>En attente</Text>
        </View>,
        () => CustomAlert.alert('En attente', 'Le conducteur examine votre demande. Vous serez notifié(e) dès qu\'il répond.'),
        { backgroundColor: C.warning }
      );

    case 'offer_received':
      return wrap(
        <View style={styles.rowC}>
          <Ionicons name="alert-circle" size={17} color={C.white} />
          <Text style={styles.bookBtnTxt} adjustsFontSizeToFit numberOfLines={1}>Proposition reçue</Text>
        </View>,
        onShowNegModal, { backgroundColor: C.warning }
      );

    case 'pay':
      return (
        <View style={{ flexDirection: 'row', gap: 12, flex: 1 }}>
          {wrap(
            bookingLoading ? <ActivityIndicator color={C.white} /> : (
              <View style={styles.rowC}>
                <Ionicons name="card" size={17} color={C.white} />
                <Text style={styles.bookBtnTxt} adjustsFontSizeToFit numberOfLines={1}>{rideAction.label}</Text>
              </View>
            ),
            onRetryPayment, {}, bookingLoading
          )}
          {wrap(
            bookingLoading ? <ActivityIndicator color={C.white} /> : (
              <View style={styles.rowC}>
                <Ionicons name="close-circle" size={17} color={C.white} />
                <Text style={styles.bookBtnTxt} adjustsFontSizeToFit numberOfLines={1}>Annuler</Text>
              </View>
            ),
            onCancel, { backgroundColor: C.error }, bookingLoading
          )}
        </View>
      );

    case 'payment_processing':
      return (
        <View style={[styles.bookBtn, { backgroundColor: C.warning }]}>
          <View style={styles.rowC}>
            <ActivityIndicator color={C.white} />
            <Text style={styles.bookBtnTxt} adjustsFontSizeToFit numberOfLines={1}>Validation…</Text>
          </View>
        </View>
      );

    case 'confirmed':
      return wrap(
        bookingLoading ? <ActivityIndicator color={C.white} /> : (
          <View style={styles.rowC}>
            <Ionicons name="close-circle" size={17} color={C.white} />
            <Text style={styles.bookBtnTxt} adjustsFontSizeToFit numberOfLines={1}>Annuler</Text>
          </View>
        ),
        onCancel, { backgroundColor: C.error }, bookingLoading
      );

    default:
      return null;
  }
}

const styles = StyleSheet.create({
  bookBtn: {
    flex: 1, height: 52, borderRadius: 16,
    backgroundColor: C.primary,
    alignItems: 'center', justifyContent: 'center',
    ...SHlg
  },
  bookBtnTxt: { fontSize: 15, fontWeight: '800', color: C.white },
  rowC: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 6, flex: 1, paddingHorizontal: 4
  }
});
