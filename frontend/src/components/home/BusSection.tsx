import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CustomAlert } from '../../utils/CustomAlert';

const C = {
  primary: '#0066FF',
  primaryLight: '#EEF3FF',
  primaryDark: '#0047BB',
  success: '#10B981',
  successLight: '#ECFDF5',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  text: '#111827',
  textSec: '#6B7280',
  textLight: '#9CA3AF',
  bg: '#F9FAFB',
  card: '#FFFFFF',
  border: '#E5E7EB',
};

interface BusTrip {
  id: string;
  company: string;
  companyBadge: string;
  logoBg: string;
  logoIcon: keyof typeof Ionicons.glyphMap;
  departureCity: string;
  arrivalCity: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  price: number;
  busType: string;
  seatsAvailable: number;
  terminal: string;
  amenities: string[];
}

const BUS_TRIPS: BusTrip[] = [
  {
    id: 'bus-1',
    company: 'Baobab Express',
    companyBadge: 'Partenaire Officiel',
    logoBg: '#10B981',
    logoIcon: 'bus',
    departureCity: 'Cotonou',
    arrivalCity: 'Parakou',
    departureTime: '07:00',
    arrivalTime: '13:30',
    duration: '6h 30m',
    price: 6500,
    busType: 'Grand Confort VIP',
    seatsAvailable: 8,
    terminal: 'Gare Baobab Akpakpa',
    amenities: ['Climatisé ❄️', 'Wi-Fi 📶', 'Prise USB 🔌', 'Sièges inclinables 💺'],
  },
  {
    id: 'bus-2',
    company: 'Confort Lines',
    companyBadge: 'Express VIP',
    logoBg: '#8B5CF6',
    logoIcon: 'shield-checkmark',
    departureCity: 'Cotonou',
    arrivalCity: 'Natitingou',
    departureTime: '08:30',
    arrivalTime: '17:30',
    duration: '9h 00m',
    price: 8500,
    busType: 'Premium Longue Distance',
    seatsAvailable: 12,
    terminal: 'Station Confort Lines Védoko',
    amenities: ['Climatisé ❄️', 'Écran Vidéo 📺', 'Collation 🥤', '2 Bagages 🧳'],
  },
  {
    id: 'bus-3',
    company: 'ATT Transport',
    companyBadge: 'Réseau National',
    logoBg: '#F59E0B',
    logoIcon: 'navigate',
    departureCity: 'Porto-Novo',
    arrivalCity: 'Parakou',
    departureTime: '09:15',
    arrivalTime: '16:15',
    duration: '7h 00m',
    price: 6000,
    busType: 'Autocar Interurbain',
    seatsAvailable: 5,
    terminal: 'Gare Centrale Ouando',
    amenities: ['Climatisé ❄️', 'Prise USB 🔌', 'GPS temps réel 📡'],
  },
  {
    id: 'bus-4',
    company: 'La Richesse Express',
    companyBadge: 'Ligne Régionale',
    logoBg: '#EC4899',
    logoIcon: 'flash',
    departureCity: 'Cotonou',
    arrivalCity: 'Bohicon / Abomey',
    departureTime: '10:45',
    arrivalTime: '13:15',
    duration: '2h 30m',
    price: 3500,
    busType: 'Navette Express',
    seatsAvailable: 15,
    terminal: 'Carrefour Étoile Rouge',
    amenities: ['Climatisé ❄️', 'Départ ponctuel ⏱️'],
  },
  {
    id: 'bus-5',
    company: 'STA Transports',
    companyBadge: 'Long Courrier',
    logoBg: '#3B82F6',
    logoIcon: 'ribbon',
    departureCity: 'Cotonou',
    arrivalCity: 'Malanville',
    departureTime: '06:00',
    arrivalTime: '18:00',
    duration: '12h 00m',
    price: 12000,
    busType: 'Autocar Grand Luxe',
    seatsAvailable: 4,
    terminal: 'Gare Centrale Cadjehoun',
    amenities: ['Wi-Fi 📶', 'Toilette 🚽', 'Pause Repas 🍽️', 'Climatisé ❄️'],
  },
];

const COMPANIES = ['Toutes', 'Baobab Express', 'Confort Lines', 'ATT Transport', 'La Richesse', 'STA'];

export function BusSection() {
  const [selectedCompany, setSelectedCompany] = useState('Toutes');

  const filteredTrips = BUS_TRIPS.filter((t) =>
    selectedCompany === 'Toutes' ? true : t.company.toLowerCase().includes(selectedCompany.toLowerCase())
  );

  const handleInProductionAlert = (actionName: string, detail?: string) => {
    CustomAlert.alert(
      'En cours de production 🚀',
      `La fonctionnalité "${actionName}" pour les bus partenaires est en cours de développement.\n\nElle sera disponible très prochainement dans la prochaine version de Zemy !`
    );
  };

  return (
    <View style={styles.container}>
      {/* Header Banner */}
      <View style={styles.headerBanner}>
        <View style={styles.headerBadge}>
          <Ionicons name="bus" size={14} color="#FFFFFF" />
          <Text style={styles.headerBadgeTxt}>Partenaires Transport Zemy</Text>
        </View>
        <Text style={styles.headerTitle}>Compagnies & Lignes de Bus</Text>
        <Text style={styles.headerSub}>
          Réservez vos billets auprès des meilleures compagnies interurbaines agréées.
        </Text>
      </View>

      {/* Filtre par Compagnie */}
      <View style={styles.filterSection}>
        <Text style={styles.filterLabel}>FILTRER PAR COMPAGNIE</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {COMPANIES.map((comp) => {
            const isActive = selectedCompany === comp;
            return (
              <TouchableOpacity
                key={comp}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => setSelectedCompany(comp)}
                activeOpacity={0.8}
              >
                <Text style={[styles.filterChipTxt, isActive && styles.filterChipTxtActive]}>{comp}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Liste des Trajets de Bus */}
      <View style={styles.tripsList}>
        {filteredTrips.map((trip) => (
          <View key={trip.id} style={styles.busCard}>
            {/* Haut de la carte: Compagnie & Badge */}
            <View style={styles.cardHeader}>
              <View style={styles.companyInfo}>
                <View style={[styles.companyLogo, { backgroundColor: trip.logoBg }]}>
                  <Ionicons name={trip.logoIcon} size={18} color="#FFFFFF" />
                </View>
                <View>
                  <Text style={styles.companyName}>{trip.company}</Text>
                  <Text style={styles.companyBadgeTxt}>{trip.companyBadge}</Text>
                </View>
              </View>
              <View style={styles.busTypeTag}>
                <Text style={styles.busTypeTagTxt}>{trip.busType}</Text>
              </View>
            </View>

            {/* Trajet: Villes et Horaires */}
            <View style={styles.routeRow}>
              <View style={styles.cityCol}>
                <Text style={styles.timeTxt}>{trip.departureTime}</Text>
                <Text style={styles.cityName}>{trip.departureCity}</Text>
              </View>
              <View style={styles.durationCol}>
                <Text style={styles.durationTxt}>{trip.duration}</Text>
                <View style={styles.durationLine}>
                  <View style={styles.lineDot} />
                  <View style={styles.lineDash} />
                  <Ionicons name="bus" size={14} color={C.primary} />
                  <View style={styles.lineDash} />
                  <View style={styles.lineDot} />
                </View>
                <Text style={styles.directTxt}>Direct interurbain</Text>
              </View>
              <View style={[styles.cityCol, { alignItems: 'flex-end' }]}>
                <Text style={styles.timeTxt}>{trip.arrivalTime}</Text>
                <Text style={styles.cityName}>{trip.arrivalCity}</Text>
              </View>
            </View>

            {/* Équipements / Services */}
            <View style={styles.amenitiesRow}>
              {trip.amenities.map((item, idx) => (
                <View key={idx} style={styles.amenityChip}>
                  <Text style={styles.amenityTxt}>{item}</Text>
                </View>
              ))}
            </View>

            {/* Informations Gare & Places */}
            <View style={styles.infoFooterRow}>
              <View style={styles.terminalInfo}>
                <Ionicons name="location-outline" size={14} color={C.textSec} />
                <Text style={styles.terminalTxt} numberOfLines={1}>{trip.terminal}</Text>
              </View>
              <View style={styles.seatsInfo}>
                <View style={styles.seatsDot} />
                <Text style={styles.seatsTxt}>{trip.seatsAvailable} places dispo</Text>
              </View>
            </View>

            {/* Prix & Boutons d'Action */}
            <View style={styles.priceActionRow}>
              <View>
                <Text style={styles.priceVal}>{trip.price.toLocaleString()}</Text>
                <Text style={styles.priceCur}>FCFA / billet</Text>
              </View>

              <View style={styles.actionBtns}>
                <TouchableOpacity
                  style={styles.seatBtn}
                  onPress={() => handleInProductionAlert('Choix du siège', `Sélection de siège pour ${trip.company}`)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="grid-outline" size={15} color={C.primary} />
                  <Text style={styles.seatBtnTxt}>Siège</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.bookBtn}
                  onPress={() => handleInProductionAlert('Réservation Billet Bus', `Réservation ${trip.company} ${trip.departureCity} → ${trip.arrivalCity}`)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="ticket-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.bookBtnTxt}>Réserver</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}
      </View>

      {/* Banner Partenaire Bus */}
      <View style={styles.partnerBanner}>
        <View style={styles.partnerIconWrap}>
          <Ionicons name="business" size={24} color={C.primary} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={styles.partnerTitle}>Vous êtes une compagnie de transport ?</Text>
          <Text style={styles.partnerSub}>Numérisez la vente de vos billets et touchez des milliers de voyageurs avec Zemy.</Text>
        </View>
        <TouchableOpacity
          style={styles.partnerBtn}
          onPress={() => handleInProductionAlert('Espace Partenaire Transport')}
          activeOpacity={0.85}
        >
          <Text style={styles.partnerBtnTxt}>Rejoindre</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 8,
    paddingBottom: 24,
    gap: 16,
  },
  headerBanner: {
    backgroundColor: '#0F172A',
    borderRadius: 24,
    padding: 20,
    gap: 8,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  headerBadgeTxt: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  headerSub: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
    lineHeight: 18,
  },
  filterSection: {
    gap: 8,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: C.textSec,
    letterSpacing: 0.6,
    paddingHorizontal: 4,
  },
  filterScroll: {
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  filterChipActive: {
    backgroundColor: C.primary,
    borderColor: C.primary,
  },
  filterChipTxt: {
    fontSize: 12,
    fontWeight: '700',
    color: C.textSec,
  },
  filterChipTxtActive: {
    color: '#FFFFFF',
  },
  tripsList: {
    gap: 14,
  },
  busCard: {
    backgroundColor: C.card,
    borderRadius: 24,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  companyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  companyLogo: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  companyName: {
    fontSize: 15,
    fontWeight: '800',
    color: C.text,
  },
  companyBadgeTxt: {
    fontSize: 11,
    fontWeight: '600',
    color: C.textSec,
  },
  busTypeTag: {
    backgroundColor: C.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  busTypeTagTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: C.primary,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.bg,
    borderRadius: 16,
    padding: 14,
  },
  cityCol: {
    flex: 1,
    gap: 2,
  },
  timeTxt: {
    fontSize: 17,
    fontWeight: '900',
    color: C.text,
  },
  cityName: {
    fontSize: 13,
    fontWeight: '700',
    color: C.textSec,
  },
  durationCol: {
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
  },
  durationTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: C.primary,
  },
  durationLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginVertical: 2,
  },
  lineDash: {
    width: 16,
    height: 1.5,
    backgroundColor: C.primary + '50',
  },
  lineDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.primary,
  },
  directTxt: {
    fontSize: 10,
    color: C.textLight,
  },
  amenitiesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  amenityChip: {
    backgroundColor: C.bg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  amenityTxt: {
    fontSize: 11,
    fontWeight: '600',
    color: C.textSec,
  },
  infoFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  terminalInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    marginRight: 10,
  },
  terminalTxt: {
    fontSize: 11,
    color: C.textSec,
  },
  seatsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: C.successLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  seatsDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.success,
  },
  seatsTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: C.success,
  },
  priceActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  priceVal: {
    fontSize: 20,
    fontWeight: '900',
    color: C.primary,
  },
  priceCur: {
    fontSize: 11,
    color: C.textSec,
    fontWeight: '600',
  },
  actionBtns: {
    flexDirection: 'row',
    gap: 8,
  },
  seatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.primaryLight,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
  },
  seatBtnTxt: {
    fontSize: 13,
    fontWeight: '700',
    color: C.primary,
  },
  bookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
  },
  bookBtnTxt: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  partnerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.primaryLight,
    borderRadius: 20,
    padding: 16,
    marginTop: 8,
  },
  partnerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  partnerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: C.primaryDark,
  },
  partnerSub: {
    fontSize: 11,
    color: C.textSec,
    lineHeight: 15,
  },
  partnerBtn: {
    backgroundColor: C.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  partnerBtnTxt: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
