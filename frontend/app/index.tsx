import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Image, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { theme } from '../src/styles/theme';
import { StatusBar } from 'expo-status-bar';

const { width } = Dimensions.get('window');

export default function OnboardingScreen() {
  const router = useRouter();
  
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Background patterns */}
      <View style={styles.circleTop} />
      <View style={styles.circleBottom} />

      <Animated.ScrollView 
        contentContainerStyle={styles.scrollContent}
        style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header App Name */}
        <View style={styles.header}>
          <Text style={styles.appName}>Covoit<Text style={styles.appNameHighlight}>Bénin</Text></Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Bêta 🇧🇯</Text>
          </View>
        </View>

        {/* Visual / Illustration Area */}
        <View style={styles.illustrationContainer}>
          <View style={styles.illustrationCard}>
            <Image source={require('../assets/icon.png')} style={styles.logoImage} resizeMode="contain" />
            <Text style={styles.cardTitle}>Économique & Convivial</Text>
            <Text style={styles.cardSubtitle}>Partagez vos trajets de Cotonou à Parakou ou Porto-Novo.</Text>
          </View>
        </View>

        {/* Title and Descriptions */}
        <View style={styles.textContainer}>
          <Text style={styles.mainTitle}>Voyagez malin, voyagez ensemble !</Text>
          <Text style={styles.description}>
            Rejoignez la première communauté de covoiturage solidaire au Bénin. Moins cher, plus convivial et 100% sécurisé.
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={styles.primaryButton}
            onPress={() => router.push('/(auth)/login')}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>Commencer</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.secondaryButton}
            onPress={() => router.push('/(tabs)/home')}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryButtonText}>Accéder en invité</Text>
          </TouchableOpacity>
        </View>
      </Animated.ScrollView>
    </View>
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
    paddingTop: 60,
    paddingBottom: 40,
    justifyContent: 'space-between',
  },
  circleTop: {
    position: 'absolute',
    top: -100,
    right: -100,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: theme.colors.primaryLight,
    opacity: 0.5,
  },
  circleBottom: {
    position: 'absolute',
    bottom: -150,
    left: -150,
    width: 350,
    height: 350,
    borderRadius: 175,
    backgroundColor: theme.colors.secondaryLight,
    opacity: 0.3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xl,
  },
  appName: {
    ...theme.typography.h2,
    color: theme.colors.text,
  },
  appNameHighlight: {
    color: theme.colors.primary,
  },
  badge: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  illustrationContainer: {
    alignItems: 'center',
    marginVertical: theme.spacing.xl,
  },
  illustrationCard: {
    width: '100%',
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    alignItems: 'center',
    ...theme.shadows.md,
  },
  logoImage: {
    width: 120,
    height: 120,
    marginBottom: theme.spacing.lg,
    alignSelf: 'center',
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  cardTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  cardSubtitle: {
    ...theme.typography.bodyMedium,
    color: theme.colors.textLight,
    textAlign: 'center',
  },
  textContainer: {
    marginBottom: theme.spacing.xl,
  },
  mainTitle: {
    ...theme.typography.h1,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  description: {
    ...theme.typography.bodyLarge,
    color: theme.colors.textLight,
    textAlign: 'center',
  },
  buttonContainer: {
    gap: theme.spacing.md,
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 16,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    ...theme.shadows.sm,
  },
  primaryButtonText: {
    ...theme.typography.button,
    color: '#fff',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    paddingVertical: 16,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
  secondaryButtonText: {
    ...theme.typography.button,
    color: theme.colors.text,
  },
});
