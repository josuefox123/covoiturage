import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type FiltreStatut = 'upcoming' | 'live' | 'completed' | 'cancelled';

interface EtatVideProps {
  filtre: FiltreStatut;
  role: 'passenger' | 'driver';
}

const CONFIG_ETAT_VIDE: Record<FiltreStatut, {
  icone: string;
  couleur: string;
  titrePassager: string;
  titreConducteur: string;
  sousTitrePassager: string;
  sousTitreConducteur: string;
}> = {
  upcoming: {
    icone: 'time-outline',
    couleur: '#D97706',
    titrePassager: 'Aucune mission à venir',
    titreConducteur: 'Aucun trajet à venir',
    sousTitrePassager: 'Vos réservations confirmées et en attente apparaîtront ici.',
    sousTitreConducteur: 'Vos trajets publiés et à venir sont listés ici.'
  },
  live: {
    icone: 'navigate-outline',
    couleur: '#059669',
    titrePassager: 'Aucun trajet en cours',
    titreConducteur: 'Aucun trajet en conduite',
    sousTitrePassager: 'Aucune réservation active en ce moment.',
    sousTitreConducteur: 'Aucun trajet que vous conduisez actuellement.'
  },
  completed: {
    icone: 'checkmark-done-outline',
    couleur: '#7C3AED',
    titrePassager: 'Aucun historique',
    titreConducteur: 'Aucun trajet terminé',
    sousTitrePassager: "Votre historique de voyages s'affichera ici.",
    sousTitreConducteur: 'Vos trajets effectués apparaissent ici.'
  },
  cancelled: {
    icone: 'close-circle-outline',
    couleur: '#EF4444',
    titrePassager: 'Aucune annulation',
    titreConducteur: 'Aucun trajet annulé',
    sousTitrePassager: "Vos réservations annulées ou expirées s'afficheront ici.",
    sousTitreConducteur: "Vos trajets annulés s'afficheront ici."
  }
};

/**
 * Affichage d'un état vide lorsqu'aucun trajet ne correspond au filtre actif.
 */
export function EtatVide({ filtre, role }: EtatVideProps) {
  const config = CONFIG_ETAT_VIDE[filtre];
  const titre = role === 'passenger' ? config.titrePassager : config.titreConducteur;
  const sousTitre = role === 'passenger' ? config.sousTitrePassager : config.sousTitreConducteur;

  return (
    <View style={styles.container}>
      <View style={styles.conteneurIcone}>
        <Ionicons name={config.icone as any} size={40} color={config.couleur} />
      </View>
      <Text style={styles.titre}>{titre}</Text>
      <Text style={styles.sousTitre}>{sousTitre}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20
  },
  conteneurIcone: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16
  },
  titre: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
    textAlign: 'center'
  },
  sousTitre: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '500'
  }
});
