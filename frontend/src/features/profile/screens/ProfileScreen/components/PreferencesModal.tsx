import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../../../../styles/theme';
import { styles } from '../styles';
import { AppBottomSheet } from '../../../../../components/AppBottomSheet';
import { CustomAlert } from '../../../../../utils/CustomAlert';

interface PreferencesModalProps {
  visible: boolean;
  onClose: () => void;
  user: any;
  authFetch: any;
}

export function PreferencesModal({
  visible,
  onClose,
  user,
  authFetch,
}: PreferencesModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [music, setMusic] = useState(true);
  const [smoking, setSmoking] = useState(false);
  const [chatty, setChatty] = useState(true);
  const [airCond, setAirCond] = useState(true);
  const [petsAllowed, setPetsAllowed] = useState(false);
  const [luggageAllowed, setLuggageAllowed] = useState(true);
  const [stopsAllowed, setStopsAllowed] = useState(true);
  const [notes, setNotes] = useState('');

  // Fetch current preferences when visible
  useEffect(() => {
    const fetchPreferences = async () => {
      if (!visible || !user) return;
      try {
        const data = await authFetch('/preferences/');
        if (data && data.length > 0) {
          const pref = data[0];
          setMusic(pref.music ?? true);
          setSmoking(pref.smoking ?? false);
          setChatty(pref.chatty ?? true);
          setAirCond(pref.air_conditioner ?? true);
          setPetsAllowed(pref.pets_allowed ?? false);
          setLuggageAllowed(pref.luggage_allowed ?? true);
          setStopsAllowed(pref.stops_allowed ?? true);
          setNotes(pref.notes || '');
        }
      } catch (e) {}
    };

    fetchPreferences();
  }, [visible, user]);

  const handleSavePreferences = async () => {
    setIsSaving(true);
    try {
      await authFetch('/preferences/', {
        method: 'POST',
        body: JSON.stringify({
          user: user!.id,
          music,
          smoking,
          chatty,
          air_conditioner: airCond,
          pets_allowed: petsAllowed,
          luggage_allowed: luggageAllowed,
          stops_allowed: stopsAllowed,
          notes: notes.trim(),
        }),
      });
      CustomAlert.alert('Succès ✅', 'Préférences sauvegardées !');
      onClose();
    } catch (e: any) {
      CustomAlert.alert('Erreur', e.message || 'Impossible de sauvegarder les préférences.');
    } finally {
      setIsSaving(false);
    }
  };

  const PrefCard = ({ label, value, onToggle, icon }: { label: string; value: boolean; onToggle: () => void; icon: string }) => (
    <TouchableOpacity
      style={styles.prefRow}
      onPress={onToggle}
      activeOpacity={0.8}
    >
      <View style={[styles.prefIconContainer, value && { backgroundColor: `${theme.colors.primary}15` }]}>
        <Ionicons name={icon as any} size={20} color={value ? theme.colors.primary : theme.colors.textMuted} />
      </View>
      <Text style={[styles.prefRowLabel, value && { color: theme.colors.text, fontWeight: '600' }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: '#E5E7EB', true: `${theme.colors.primary}80` }}
        thumbColor={value ? theme.colors.primary : '#F9FAFB'}
        ios_backgroundColor="#E5E7EB"
      />
    </TouchableOpacity>
  );

  return (
    <AppBottomSheet
      visible={visible}
      onClose={onClose}
      snapPoints={['75%', '95%']}
    >
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>Préférences de voyage</Text>
      </View>

      <View style={{ flex: 1 }}>
        <View style={styles.prefCardsContainer}>
          <PrefCard icon="musical-notes" label="Musique" value={music} onToggle={() => setMusic(!music)} />
          <PrefCard icon="chatbubbles" label="Bavard(e)" value={chatty} onToggle={() => setChatty(!chatty)} />
          <PrefCard icon="logo-no-smoking" label="Fumeurs" value={smoking} onToggle={() => setSmoking(!smoking)} />
          <PrefCard icon="snow" label="Climatisation" value={airCond} onToggle={() => setAirCond(!airCond)} />
          <PrefCard icon="paw" label="Animaux" value={petsAllowed} onToggle={() => setPetsAllowed(!petsAllowed)} />
          <PrefCard icon="briefcase" label="Bagages" value={luggageAllowed} onToggle={() => setLuggageAllowed(!luggageAllowed)} />
          <PrefCard icon="flag" label="Arrêts" value={stopsAllowed} onToggle={() => setStopsAllowed(!stopsAllowed)} />
        </View>

        <View style={{ marginTop: 24 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: theme.colors.text, marginBottom: 12 }}>
            Détails supplémentaires
          </Text>
          <View style={[styles.inputWrapper, { height: 100, alignItems: 'flex-start', paddingTop: 16 }]}>
            <Ionicons name="document-text-outline" size={20} color={theme.colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={[styles.modalInputModern, { textAlignVertical: 'top', paddingTop: 0 }]}
              placeholder="Ex: Je voyage avec mon chat, j'aime faire des pauses régulières..."
              value={notes}
              onChangeText={setNotes}
              multiline
              placeholderTextColor={theme.colors.textMuted}
            />
          </View>
        </View>

        <TouchableOpacity style={{ marginTop: 16 }} onPress={handleSavePreferences} disabled={isSaving} activeOpacity={0.8}>
          <LinearGradient colors={[theme.colors.primary, '#3B82F6']} style={styles.modalBtnGradient}>
            {isSaving ? <ActivityIndicator color={theme.colors.white} /> : (
              <>
                <Ionicons name="checkmark-circle" size={20} color={theme.colors.white} />
                <Text style={styles.modalBtnSaveText}>Sauvegarder</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </AppBottomSheet>
  );
}
