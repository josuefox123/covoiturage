import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getMediaUrl } from '../../../utils/media';
import { TitreSection } from './AnimationsFade';
import { C, SHsm } from './theme-trajet';

interface CarteConducteurProps {
  ride: any;
  canChat: boolean;
  chatLoading: boolean;
  heureDepart: string;
  heureArrivee: string;
  dureeTxt: string;
  onOpenChat: () => void;
}

/**
 * Carte d'information sur le conducteur :
 * avatar, nom, véhicule, statistiques, et bouton de contact.
 */
export function CarteConducteur({
  ride,
  canChat,
  chatLoading,
  heureDepart,
  heureArrivee,
  dureeTxt,
  onOpenChat
}: CarteConducteurProps) {
  const driverName = ride.driver_details?.full_name || 'Inconnu';
  const initials = driverName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
  const vehicle = ride.driver_details?.vehicles?.[0];

  return (
    <View style={styles.carte}>
      <TitreSection titre="Votre conducteur" icone="person-circle-outline" />

      {/* Avatar + Infos conducteur */}
      <View style={{ flexDirection: 'row', gap: 14, marginBottom: 16 }}>
        <View style={{ position: 'relative' }}>
          {ride.driver_details?.avatar
            ? <Image source={{ uri: getMediaUrl(ride.driver_details.avatar) }} style={styles.avatar} />
            : (
              <View style={[styles.avatar, styles.avatarPH]}>
                <Text style={styles.avatarI}>{initials}</Text>
              </View>
            )
          }
          <View style={styles.vBadge}>
            <Ionicons name="checkmark" size={10} color={C.white} />
          </View>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.dName}>{driverName}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="shield-checkmark" size={13} color={C.success} />
            <Text style={{ fontSize: 12, color: C.success, fontWeight: '700' }}>Compte vérifié</Text>
          </View>
          <Text style={{ fontSize: 13, color: C.textSec }}>
            <Text style={{ color: C.primary, fontWeight: '700' }}>
              {ride.driver_details?.rides_count ?? 0}
            </Text>{' '}trajets effectués
          </Text>
        </View>
      </View>

      {/* Véhicule */}
      {vehicle && (
        <View style={styles.vRow}>
          <Ionicons name="car-sport" size={18} color={C.primary} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: C.text }}>{vehicle.brand_model}</Text>
            <Text style={{ fontSize: 12, color: C.textSec, marginTop: 2 }}>
              {[vehicle.color, vehicle.license_plate].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <View style={styles.vtBadge}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: C.primary }}>
              {vehicle.vehicle_type === 'moto' ? 'Moto' : 'Voiture'}
            </Text>
          </View>
        </View>
      )}

      {/* Stats départ / arrivée / durée */}
      <View style={styles.dStats}>
        <View style={styles.dStat}>
          <Text style={styles.dStatV}>{heureDepart}</Text>
          <Text style={styles.dStatL}>Départ</Text>
        </View>
        <View style={{ width: 1, height: 28, backgroundColor: C.borderMid }} />
        <View style={styles.dStat}>
          <Text style={styles.dStatV}>{heureArrivee}</Text>
          <Text style={styles.dStatL}>Arrivée</Text>
        </View>
        <View style={{ width: 1, height: 28, backgroundColor: C.borderMid }} />
        <View style={styles.dStat}>
          <Text style={styles.dStatV}>{dureeTxt}</Text>
          <Text style={styles.dStatL}>Durée</Text>
        </View>
      </View>

      {/* Bouton contacter */}
      {canChat && (
        <TouchableOpacity style={styles.chatCTA} onPress={onOpenChat} disabled={chatLoading} activeOpacity={0.85}>
          {chatLoading
            ? <ActivityIndicator color={C.primary} size="small" />
            : (
              <>
                <Ionicons name="chatbubble-ellipses-outline" size={16} color={C.primary} />
                <Text style={{ fontSize: 14, fontWeight: '700', color: C.primary }}>Contacter le conducteur</Text>
              </>
            )
          }
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  carte: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, ...SHsm },
  avatar: { width: 60, height: 60, borderRadius: 30 },
  avatarPH: { backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center' },
  avatarI: { fontSize: 22, fontWeight: '800', color: C.primary },
  vBadge: {
    position: 'absolute', bottom: -2, right: -2,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: C.success, borderWidth: 2, borderColor: C.white,
    alignItems: 'center', justifyContent: 'center'
  },
  dName: { fontSize: 18, fontWeight: '800', color: C.text },
  vRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#F8FAFC', borderRadius: 14, padding: 14, marginBottom: 16
  },
  vtBadge: { backgroundColor: C.primaryLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  dStats: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8FAFC', borderRadius: 14, padding: 14, marginBottom: 14
  },
  dStat: { flex: 1, alignItems: 'center', gap: 3 },
  dStatV: { fontSize: 16, fontWeight: '800', color: C.text },
  dStatL: { fontSize: 11, color: C.textSec, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  chatCTA: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: C.primary, borderRadius: 14,
    paddingVertical: 12, paddingHorizontal: 16
  }
});
