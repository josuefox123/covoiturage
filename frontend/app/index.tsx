import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Dimensions,
  Image,
  Animated,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../src/styles/theme';


const { width, height } = Dimensions.get('window');
const PRIMARY_COLOR = theme.colors.primary;

export default function OnboardingScreen() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isLoading && user) {
      router.replace('/(tabs)/home');
    }
  }, [isLoading, user]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handlePressIn = () => {
    Animated.spring(buttonScale, {
      toValue: 0.96,
      friction: 5,
      tension: 100,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(buttonScale, {
      toValue: 1,
      friction: 5,
      tension: 100,
      useNativeDriver: true,
    }).start();
  };

  const handleLogin = () => {
    router.push('/(auth)/login');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />
      <RNStatusBar barStyle="dark-content" />

      {/* Image pleine largeur avec dégradé */}
      <View style={styles.imageWrapper}>
        <Image
          source={require('../assets/images/welcome_car.png')}
          style={styles.fullWidthImage}
          resizeMode="cover"
        />

        {/* Dégradé vers le blanc */}
        <LinearGradient
          colors={['rgba(255,255,255,0)', theme.colors.white, theme.colors.white]}
          locations={[0.4, 0.75, 1]}
          style={styles.gradientOverlay}
        />
      </View>

      {/* Contenu sur fond blanc */}
      <Animated.View
        style={[
          styles.contentContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }
        ]}
      >
        <View style={styles.textWrapper}>
          <Image 
            source={require('../assets/images/logozemy.png')} 
            style={styles.logoImage}
            resizeMode="contain"
          />

          <Text style={styles.subtitle}>
            Voyagez malin, économisez sur vos trajets et faites de belles rencontres
          </Text>
        </View>

        {/* Bouton Se connecter */}
        <Animated.View style={{ transform: [{ scale: buttonScale }], width: '100%' }}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={handleLogin}
          >
            <LinearGradient
              colors={[PRIMARY_COLOR, theme.colors.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.loginButton}
            >
              <Text style={styles.loginButtonText}>Se connecter</Text>
              <Ionicons name="arrow-forward" size={20} color={theme.colors.white} />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* Petit texte d'information */}
        <Text style={styles.footerText}>
          Rejoignez des milliers de voyageurs
        </Text>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  imageWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: height * 0.6,
  },
  fullWidthImage: {
    width: width,
    height: '100%',
  },
  gradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: height * 0.3,
  },
  contentContainer: {
    flex: 1,
    marginTop: height * 0.52, // Descendu un peu plus bas dans le blanc (avant 0.48)
    paddingHorizontal: 28,
    paddingBottom: Platform.OS === 'ios' ? 40 : 32,
    justifyContent: 'space-between',
  },
  textWrapper: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoImage: {
    width: 200, // Ajuste la largeur selon les dimensions de ton logo
    height: 80,  // Ajuste la hauteur
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textLight,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 18,
    borderRadius: 16,
    shadowColor: PRIMARY_COLOR,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: 20,
  },
  loginButtonText: {
    color: theme.colors.white,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  footerText: {
    textAlign: 'center',
    fontSize: 13,
    color: theme.colors.gray,
    fontWeight: '500',
  },
});