import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { Ride } from '../../../../src/types';
import { theme } from '../../../../src/styles/theme';

interface BookingConfirmModalProps {
  visible: boolean;
  ride: Ride;
  departure?: string;
  destination?: string;
  bookingLoading: boolean;
  pricePerSeat?: number;
  onClose: () => void;
  onConfirm: (
    seats: number,
    customPrice?: number,
    message?: string
  ) => void;
}

export function BookingConfirmModal({
  visible,
  ride,
  departure,
  destination,
  bookingLoading,
  pricePerSeat,
  onClose,
  onConfirm,
}: BookingConfirmModalProps) {
  const [seatsToBook, setSeatsToBook] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const [proposeCustomPrice, setProposeCustomPrice] = useState(false);
  const [proposedPriceText, setProposedPriceText] = useState('');
  const [passengerMessageText, setPassengerMessageText] = useState('');

  const displayPrice = pricePerSeat ?? ride?.price_per_seat ?? 0;
  const availableSeats = Math.max(0, ride?.seats_available ?? 0);

  const totalToPay = useMemo(
    () => displayPrice * seatsToBook,
    [displayPrice, seatsToBook]
  );

  const departureText = departure || ride?.departure_location || 'Départ';
  const destinationText = destination || ride?.arrival_location || 'Destination';

  useEffect(() => {
    if (!visible) {
      setSubmitting(false);
      setSeatsToBook(1);
      setProposeCustomPrice(false);
      setProposedPriceText('');
      setPassengerMessageText('');
    }
  }, [visible]);

  useEffect(() => {
    if (availableSeats > 0 && seatsToBook > availableSeats) {
      setSeatsToBook(availableSeats);
    }
    if (availableSeats === 0) {
      setSeatsToBook(1);
    }
  }, [availableSeats, seatsToBook]);

  const handleDecreaseSeats = () => {
    setSeatsToBook((prev) => Math.max(1, prev - 1));
  };

  const handleIncreaseSeats = () => {
    setSeatsToBook((prev) => Math.min(availableSeats || 1, prev + 1));
  };

  const handleConfirm = async () => {
    if (submitting || bookingLoading) return;
    if (availableSeats <= 0) return;

    const customPrice =
      proposeCustomPrice && proposedPriceText.trim()
        ? parseInt(proposedPriceText.replace(/\D/g, ''), 10)
        : undefined;

    if (proposeCustomPrice && (!customPrice || customPrice <= 0)) {
      return;
    }

    const message = passengerMessageText.trim() || undefined;

    setSubmitting(true);
    try {
      await onConfirm(seatsToBook, customPrice, message);
    } catch (error) {
      setSubmitting(false);
    }
  };

  const isLoading = submitting || bookingLoading;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.backdrop}>
          <TouchableOpacity
            style={styles.backdropTouchable}
            activeOpacity={1}
            onPress={onClose}
          />

          <View style={styles.modalSheet}>
            {/* Handle */}
            <View style={styles.handle} />

            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={styles.headerIcon}>
                  <Ionicons
                    name="car-sport"
                    size={21}
                    color={theme.colors.primary}
                  />
                </View>

                <View>
                  <Text style={styles.title}>
                    Réserver un trajet
                  </Text>

                  <Text style={styles.subtitle}>
                    Vérifiez les détails avant de continuer
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.closeButton}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="close"
                  size={21}
                  color={theme.colors.textLight}
                />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* TRAJET */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>
                  VOTRE TRAJET
                </Text>

                <View style={styles.routeCard}>
                  {/* Départ */}
                  <View style={styles.routeRow}>
                    <View style={styles.routeIndicatorContainer}>
                      <View style={styles.startDot} />
                      <View style={styles.routeLine} />
                    </View>

                    <View style={styles.routeContent}>
                      <Text style={styles.routeSmallLabel}>
                        DÉPART
                      </Text>
                      <Text
                        style={styles.routeLocation}
                        numberOfLines={2}
                      >
                        {departureText}
                      </Text>
                    </View>
                  </View>

                  {/* Destination */}
                  <View style={styles.routeRow}>
                    <View style={styles.routeIndicatorContainer}>
                      <View style={styles.destinationDot}>
                        <Ionicons
                          name="location"
                          size={10}
                          color={theme.colors.white}
                        />
                      </View>
                    </View>

                    <View style={styles.routeContent}>
                      <Text style={styles.routeSmallLabel}>
                        DESTINATION
                      </Text>
                      <Text
                        style={styles.routeLocation}
                        numberOfLines={2}
                      >
                        {destinationText}
                      </Text>
                    </View>
                  </View>

                  {/* Places disponibles */}
                  <View style={styles.availableSeats}>
                    <Ionicons
                      name="people-outline"
                      size={17}
                      color={theme.colors.primary}
                    />

                    <Text style={styles.availableSeatsText}>
                      {availableSeats} place
                      {availableSeats > 1 ? 's' : ''} disponible
                      {availableSeats > 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>
              </View>

              {/* PLACES */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>
                  NOMBRE DE PLACES
                </Text>

                <View style={styles.seatSelector}>
                  <View>
                    <Text style={styles.seatTitle}>
                      Combien de places ?
                    </Text>

                    <Text style={styles.seatSubtitle}>
                      {seatsToBook === 1
                        ? '1 passager'
                        : `${seatsToBook} passagers`}
                    </Text>
                  </View>

                  <View style={styles.counter}>
                    <TouchableOpacity
                      style={[
                        styles.counterButton,
                        seatsToBook <= 1 &&
                          styles.counterButtonDisabled,
                      ]}
                      onPress={handleDecreaseSeats}
                      disabled={seatsToBook <= 1}
                    >
                      <Ionicons
                        name="remove"
                        size={19}
                        color={
                          seatsToBook <= 1
                            ? theme.colors.grayLight
                            : theme.colors.text
                        }
                      />
                    </TouchableOpacity>

                    <Text style={styles.counterValue}>
                      {seatsToBook}
                    </Text>

                    <TouchableOpacity
                      style={[
                        styles.counterButton,
                        seatsToBook >= availableSeats &&
                          styles.counterButtonDisabled,
                      ]}
                      onPress={handleIncreaseSeats}
                      disabled={
                        seatsToBook >= availableSeats
                      }
                    >
                      <Ionicons
                        name="add"
                        size={19}
                        color={
                          seatsToBook >= availableSeats
                            ? theme.colors.grayLight
                            : theme.colors.white
                        }
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* PRIX */}
              <View style={styles.priceCard}>
                <View style={styles.priceHeader}>
                  <View style={styles.priceIcon}>
                    <Ionicons
                      name="wallet-outline"
                      size={20}
                      color={theme.colors.primary}
                    />
                  </View>

                  <View>
                    <Text style={styles.priceTitle}>
                      Récapitulatif
                    </Text>

                    <Text style={styles.priceSubtitle}>
                      Paiement sécurisé
                    </Text>
                  </View>
                </View>

                <View style={styles.priceRows}>
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>
                      Prix par place
                    </Text>

                    <Text style={styles.priceValue}>
                      {displayPrice.toLocaleString()} FCFA
                    </Text>
                  </View>

                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>
                      Places
                    </Text>

                    <Text style={styles.priceValue}>
                      × {seatsToBook}
                    </Text>
                  </View>
                </View>

                <View style={styles.priceDivider} />

                <View style={styles.totalRow}>
                  <View>
                    <Text style={styles.totalLabel}>
                      TOTAL À PAYER
                    </Text>

                    <Text style={styles.totalHint}>
                      Frais de service inclus
                    </Text>
                  </View>

                  <Text style={styles.totalValue}>
                    {totalToPay.toLocaleString()} FCFA
                  </Text>
                </View>
              </View>

              {/* NEGOCIATION */}
              <View style={styles.section}>
                <View style={styles.sectionTitleRow}>
                  <Text style={styles.sectionLabel}>
                    PROPOSITION DE PRIX
                  </Text>

                  <View style={styles.optionalBadge}>
                    <Text style={styles.optionalText}>
                      OPTIONNEL
                    </Text>
                  </View>
                </View>

                <Text style={styles.helperText}>
                  Vous pouvez proposer un autre montant au
                  chauffeur.
                </Text>

                <View style={styles.choiceContainer}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                      setProposeCustomPrice(false);
                      setProposedPriceText('');
                    }}
                    style={[
                      styles.choiceButton,
                      !proposeCustomPrice &&
                        styles.choiceButtonActive,
                    ]}
                  >
                    <View
                      style={[
                        styles.radio,
                        !proposeCustomPrice &&
                          styles.radioActive,
                      ]}
                    >
                      {!proposeCustomPrice && (
                        <View style={styles.radioDot} />
                      )}
                    </View>

                    <Text
                      style={[
                        styles.choiceText,
                        !proposeCustomPrice &&
                          styles.choiceTextActive,
                      ]}
                    >
                      Prix affiché
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() =>
                      setProposeCustomPrice(true)
                    }
                    style={[
                      styles.choiceButton,
                      proposeCustomPrice &&
                        styles.choiceButtonActive,
                    ]}
                  >
                    <View
                      style={[
                        styles.radio,
                        proposeCustomPrice &&
                          styles.radioActive,
                      ]}
                    >
                      {proposeCustomPrice && (
                        <View style={styles.radioDot} />
                      )}
                    </View>

                    <Text
                      style={[
                        styles.choiceText,
                        proposeCustomPrice &&
                          styles.choiceTextActive,
                      ]}
                    >
                      Proposer un prix
                    </Text>
                  </TouchableOpacity>
                </View>

                {proposeCustomPrice && (
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputLabel}>
                      Votre proposition par place
                    </Text>

                    <View style={styles.inputContainer}>
                      <Ionicons
                        name="cash-outline"
                        size={20}
                        color={theme.colors.textLight}
                      />

                      <TextInput
                        style={styles.priceInput}
                        keyboardType="numeric"
                        placeholder="Ex. 1 500"
                        placeholderTextColor={theme.colors.textMuted}
                        value={proposedPriceText}
                        onChangeText={(text) =>
                          setProposedPriceText(
                            text.replace(/\D/g, '')
                          )
                        }
                      />

                      <Text style={styles.currency}>
                        FCFA
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              {/* MESSAGE */}
              <View style={styles.section}>
                <View style={styles.sectionTitleRow}>
                  <Text style={styles.sectionLabel}>
                    MESSAGE AU CHAUFFEUR
                  </Text>

                  <View style={styles.optionalBadge}>
                    <Text style={styles.optionalText}>
                      OPTIONNEL
                    </Text>
                  </View>
                </View>

                <View style={styles.messageContainer}>
                  <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={19}
                    color={theme.colors.textLight}
                    style={styles.messageIcon}
                  />

                  <TextInput
                    style={styles.messageInput}
                    placeholder="Ex. Je serai à l'heure au point de départ..."
                    placeholderTextColor={theme.colors.textMuted}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                    value={passengerMessageText}
                    onChangeText={setPassengerMessageText}
                    maxLength={300}
                  />
                </View>

                <Text style={styles.characterCount}>
                  {passengerMessageText.length}/300
                </Text>
              </View>

              {/* SECURITE */}
              <View style={styles.securityNotice}>
                <View style={styles.securityIcon}>
                  <Ionicons
                    name="shield-checkmark"
                    size={19}
                    color={theme.colors.success}
                  />
                </View>

                <View style={styles.securityContent}>
                  <Text style={styles.securityTitle}>
                    Réservation sécurisée
                  </Text>

                  <Text style={styles.securityText}>
                    Vos informations restent protégées
                    pendant toute la réservation.
                  </Text>
                </View>
              </View>

              {/* ACTIONS */}
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[
                    styles.confirmButton,
                    (isLoading || availableSeats <= 0) &&
                      styles.confirmButtonDisabled,
                  ]}
                  onPress={handleConfirm}
                  disabled={
                    isLoading || availableSeats <= 0
                  }
                  activeOpacity={0.85}
                >
                  {isLoading ? (
                    <View style={styles.loadingRow}>
                      <ActivityIndicator
                        size="small"
                        color={theme.colors.white}
                      />

                      <Text style={styles.confirmButtonText}>
                        Réservation en cours...
                      </Text>
                    </View>
                  ) : (
                    <>
                      <Text style={styles.confirmButtonText}>
                        Continuer
                      </Text>

                      <Ionicons
                        name="arrow-forward"
                        size={19}
                        color={theme.colors.white}
                      />
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={onClose}
                  disabled={isLoading}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelButtonText}>
                    Annuler
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.bottomHint}>
                En continuant, vous acceptez les conditions de
                réservation de Zemy.
              </Text>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.62)',
    justifyContent: 'flex-end',
  },

  backdropTouchable: {
    flex: 1,
  },

  modalSheet: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: '92%',
    paddingTop: 10,
    overflow: 'hidden',
  },

  handle: {
    width: 42,
    height: 5,
    borderRadius: 10,
    backgroundColor: theme.colors.grayLight,
    alignSelf: 'center',
    marginBottom: 16,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.grayLighter,
  },

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  title: {
    fontSize: 19,
    fontWeight: '800',
    color: theme.colors.text,
    letterSpacing: -0.3,
  },

  subtitle: {
    fontSize: 12,
    color: theme.colors.textLight,
    marginTop: 3,
  },

  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },

  scrollContent: {
    padding: 20,
    paddingBottom: 35,
  },

  section: {
    marginBottom: 22,
  },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.textLight,
    letterSpacing: 0.8,
    marginBottom: 10,
  },

  routeCard: {
    backgroundColor: theme.colors.background,
    borderRadius: 20,
    padding: 17,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  routeRow: {
    flexDirection: 'row',
    minHeight: 55,
  },

  routeIndicatorContainer: {
    width: 25,
    alignItems: 'center',
  },

  startDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: theme.colors.primary,
    marginTop: 5,
  },

  destinationDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  routeLine: {
    width: 2,
    flex: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 5,
  },

  routeContent: {
    flex: 1,
    paddingLeft: 10,
    paddingBottom: 12,
  },

  routeSmallLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: theme.colors.textMuted,
    letterSpacing: 0.7,
    marginBottom: 3,
  },

  routeLocation: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
    lineHeight: 19,
  },

  availableSeats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primaryLight,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 4,
  },

  availableSeatsText: {
    marginLeft: 7,
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
  },

  seatSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.white,
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  seatTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.text,
  },

  seatSubtitle: {
    fontSize: 12,
    color: theme.colors.textLight,
    marginTop: 4,
  },

  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  counterButton: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  counterButtonDisabled: {
    backgroundColor: theme.colors.grayLightest,
  },

  counterValue: {
    width: 38,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.text,
  },

  priceCard: {
    backgroundColor: theme.colors.background,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 24,
  },

  priceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },

  priceIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  priceTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.text,
  },

  priceSubtitle: {
    fontSize: 11,
    color: theme.colors.textLight,
    marginTop: 2,
  },

  priceRows: {
    gap: 10,
  },

  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  priceLabel: {
    fontSize: 13,
    color: theme.colors.textLight,
  },

  priceValue: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
  },

  priceDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 15,
  },

  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  totalLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: theme.colors.primaryDark,
    letterSpacing: 0.5,
  },

  totalHint: {
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 3,
  },

  totalValue: {
    fontSize: 21,
    fontWeight: '900',
    color: theme.colors.primary,
    letterSpacing: -0.5,
  },

  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  optionalBadge: {
    backgroundColor: theme.colors.grayLighter,
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },

  optionalText: {
    fontSize: 8,
    fontWeight: '800',
    color: theme.colors.textLight,
    letterSpacing: 0.5,
  },

  helperText: {
    fontSize: 12,
    color: theme.colors.textLight,
    marginBottom: 12,
    marginTop: -3,
    lineHeight: 17,
  },

  choiceContainer: {
    flexDirection: 'row',
    gap: 10,
  },

  choiceButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.white,
    borderRadius: 14,
    padding: 13,
  },

  choiceButtonActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
  },

  radio: {
    width: 19,
    height: 19,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: theme.colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },

  radioActive: {
    borderColor: theme.colors.primary,
  },

  radioDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: theme.colors.primary,
  },

  choiceText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textLight,
  },

  choiceTextActive: {
    color: theme.colors.primary,
  },

  inputWrapper: {
    marginTop: 14,
  },

  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textLight,
    marginBottom: 7,
  },

  inputContainer: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  priceInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
    marginLeft: 9,
  },

  currency: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.textLight,
  },

  messageContainer: {
    minHeight: 100,
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: theme.colors.background,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 13,
  },

  messageIcon: {
    marginTop: 2,
    marginRight: 8,
  },

  messageInput: {
    flex: 1,
    minHeight: 70,
    fontSize: 13,
    color: theme.colors.text,
    lineHeight: 19,
  },

  characterCount: {
    textAlign: 'right',
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 5,
  },

  securityNotice: {
    flexDirection: 'row',
    backgroundColor: theme.colors.successLightest,
    borderRadius: 15,
    padding: 13,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: theme.colors.successLight,
  },

  securityIcon: {
    width: 35,
    height: 35,
    borderRadius: 10,
    backgroundColor: theme.colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  securityContent: {
    flex: 1,
  },

  securityTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.successDark || '#15803D',
    marginBottom: 2,
  },

  securityText: {
    fontSize: 10,
    lineHeight: 15,
    color: theme.colors.successDark || '#166534',
  },

  actions: {
    gap: 10,
  },

  confirmButton: {
    height: 56,
    borderRadius: 17,
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    shadowColor: theme.colors.primary,
    shadowOffset: {
      width: 0,
      height: 7,
    },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 5,
  },

  confirmButtonDisabled: {
    opacity: 0.55,
    shadowOpacity: 0,
    elevation: 0,
  },

  confirmButtonText: {
    color: theme.colors.white,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },

  cancelButton: {
    height: 48,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  cancelButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textLight,
  },

  bottomHint: {
    textAlign: 'center',
    fontSize: 9,
    lineHeight: 14,
    color: theme.colors.textMuted,
    marginTop: 13,
    paddingHorizontal: 20,
  },
});
