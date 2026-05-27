import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { theme } from '../../src/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const BENIN_CITIES = ['Cotonou', 'Porto-Novo', 'Parakou', 'Bohicon', 'Abomey-Calavi', 'Ouidah', 'Natitingou', 'Djougou'];
const DATES = ['Aujourd\'hui', 'Demain', 'Dans 2 jours', 'Autre'];

export default function PublishScreen() {
  const router = useRouter();
  const [departure, setDeparture] = useState('Cotonou');
  const [arrival, setArrival] = useState('Parakou');
  const [date, setDate] = useState('Aujourd\'hui');
  const [time, setTime] = useState('');
  const [price, setPrice] = useState('');
  const [seats, setSeats] = useState(3);

  const handlePublish = () => {
    if (!departure || !arrival || !date || !time || !price) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires.');
      return;
    }
    
    if (departure === arrival) {
      Alert.alert('Erreur', 'Le lieu de départ et d\'arrivée doivent être différents.');
      return;
    }

    Alert.alert(
      'Félicitations ! 🎉',
      `Votre trajet de ${departure} vers ${arrival} a été publié avec succès.`,
      [
        {
          text: 'Ok',
          onPress: () => {
            // Reset form
            setDeparture('Cotonou');
            setArrival('Parakou');
            setDate('Aujourd\'hui');
            setTime('');
            setPrice('');
            setSeats(3);
            router.push('/(tabs)/home');
          }
        }
      ]
    );
  };

  const renderPills = (items: string[], selected: string, onSelect: (val: string) => void) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsContainer}>
      {items.map((item) => (
        <TouchableOpacity
          key={item}
          style={[styles.pill, selected === item && styles.pillSelected]}
          onPress={() => onSelect(item)}
          activeOpacity={0.7}
        >
          <Text style={[styles.pillText, selected === item && styles.pillTextSelected]}>
            {item}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Publier un trajet 🚗</Text>
            <Text style={styles.subtitle}>Voyagez à travers le Bénin et partagez vos frais.</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Route Section */}
            <Text style={styles.sectionLabel}>Itinéraire</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Départ</Text>
              {renderPills(BENIN_CITIES, departure, setDeparture)}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Arrivée</Text>
              {renderPills(BENIN_CITIES, arrival, setArrival)}
            </View>

            <View style={styles.divider} />

            {/* Date and Time Section */}
            <Text style={styles.sectionLabel}>Date et Heure</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Date du trajet</Text>
              {renderPills(DATES, date, setDate)}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Heure de départ</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="time-outline" size={20} color={theme.colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="ex: 08:30"
                  placeholderTextColor={theme.colors.textMuted}
                  value={time}
                  onChangeText={setTime}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>

            <View style={styles.divider} />

            {/* Price and Seats Section */}
            <Text style={styles.sectionLabel}>Prix et Places</Text>

            <View style={styles.row}>
              <View style={[styles.inputContainer, { flex: 1.2 }]}>
                <Text style={styles.label}>Prix par place (FCFA)</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="cash-outline" size={20} color={theme.colors.primary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="ex: 5000"
                    placeholderTextColor={theme.colors.textMuted}
                    value={price}
                    onChangeText={setPrice}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={[styles.inputContainer, { flex: 0.8, alignItems: 'center' }]}>
                <Text style={styles.label}>Places libres</Text>
                <View style={styles.counterWrapper}>
                  <TouchableOpacity 
                    style={styles.counterBtn} 
                    onPress={() => seats > 1 && setSeats(seats - 1)}
                  >
                    <Ionicons name="remove" size={18} color={theme.colors.text} />
                  </TouchableOpacity>
                  <Text style={styles.counterText}>{seats}</Text>
                  <TouchableOpacity 
                    style={styles.counterBtn} 
                    onPress={() => seats < 8 && setSeats(seats + 1)}
                  >
                    <Ionicons name="add" size={18} color={theme.colors.text} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Submit Button */}
            <TouchableOpacity 
              style={styles.publishBtn} 
              onPress={handlePublish}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-circle-outline" size={22} color="#fff" />
              <Text style={styles.publishBtnText}>Publier mon annonce</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  header: {
    marginVertical: theme.spacing.lg,
  },
  title: {
    ...theme.typography.h2,
    color: theme.colors.text,
  },
  subtitle: {
    ...theme.typography.bodyLarge,
    color: theme.colors.textLight,
    marginTop: 4,
  },
  form: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    ...theme.shadows.md,
  },
  sectionLabel: {
    ...theme.typography.h3,
    color: theme.colors.text,
    fontSize: 16,
    marginBottom: theme.spacing.md,
  },
  inputGroup: {
    marginBottom: theme.spacing.md,
  },
  pillsContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  pillSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  pillText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text,
    fontWeight: '500',
  },
  pillTextSelected: {
    color: '#fff',
    fontWeight: '700',
  },
  inputContainer: {
    marginBottom: theme.spacing.md,
  },
  label: {
    ...theme.typography.bodyMedium,
    fontWeight: '600',
    color: theme.colors.textLight,
    marginBottom: theme.spacing.xs,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    height: 50,
    backgroundColor: theme.colors.background,
  },
  inputIcon: {
    marginRight: theme.spacing.sm,
  },
  input: {
    flex: 1,
    color: theme.colors.text,
    ...theme.typography.bodyMedium,
    height: '100%',
  },
  row: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  counterWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    height: 50,
    width: '100%',
    backgroundColor: theme.colors.background,
    paddingHorizontal: 4,
  },
  counterBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.sm,
  },
  counterText: {
    ...theme.typography.bodyLarge,
    fontWeight: '700',
    color: theme.colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.md,
  },
  publishBtn: {
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    height: 52,
    borderRadius: theme.borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.lg,
    gap: 8,
    ...theme.shadows.sm,
  },
  publishBtnText: {
    ...theme.typography.button,
    color: '#fff',
  },
});
