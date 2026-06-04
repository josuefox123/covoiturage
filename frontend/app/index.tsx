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
import { theme } from '../src/styles/theme';

const { width, height } = Dimensions.get('window');

export default function OnboardingScreen() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const buttonScale1 = useRef(new Animated.Value(1)).current;
  const buttonScale2 = useRef(new Animated.Value(1)).current;
  const imageScale = useRef(new Animated.Value(1.1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const badgeSlideAnim = useRef(new Animated.Value(-50)).current;

  useEffect(() => {
    if (!isLoading && user) {
      router.replace('/(tabs)/home');
    }
  }, [isLoading, user]);

  useEffect(() => {
    // Animation d'entrée principale
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
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.spring(imageScale, {
        toValue: 1,
        friction: 10,
        tension: 30,
        useNativeDriver: true,
      }),
      Animated.spring(badgeSlideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // Animation de glow en boucle
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const handlePressIn = (buttonNumber: number) => {
    if (buttonNumber === 1) {
      Animated.spring(buttonScale1, {
        toValue: 0.97,
        friction: 5,
        tension: 100,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.spring(buttonScale2, {
        toValue: 0.97,
        friction: 5,
        tension: 100,
        useNativeDriver: true,
      }).start();
    }
  };

  const handlePressOut = (buttonNumber: number) => {
    if (buttonNumber === 1) {
      Animated.spring(buttonScale1, {
        toValue: 1,
        friction: 5,
        tension: 100,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.spring(buttonScale2, {
        toValue: 1,
        friction: 5,
        tension: 100,
        useNativeDriver: true,
      }).start();
    }
  };

  const handleLogin = () => {
    router.push('/(auth)/login');
  };

  const handleRegister = () => {
    router.push('/(auth)/register');
  };

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0.4, 0],
  });

  return (
    <View style={styles.container}>
      <StatusBar style="light" translucent backgroundColor={theme.colors.transparent} />
      <RNStatusBar translucent barStyle="light-content" backgroundColor={theme.colors.transparent} />

      {/* Image de fond animée */}
      <Animated.View
        style={[
          styles.imageContainer,
          {
            transform: [{ scale: imageScale }],
          },
        ]}
      >
        <Image
          source={require('../assets/images/welcome_car.png')}
          style={styles.image}
          resizeMode="cover"
        />

        {/* Dégradé amélioré */}
        <LinearGradient
          colors={['rgba(0,0,0,0.4)', 'rgba(0,0,0,0.1)', theme.colors.background]}
          locations={[0, 0.4, 1]}
          style={styles.gradientOverlay}
        />
      </Animated.View>

      {/* Badge décoratif animé */}
      <Animated.View
        style={[
          styles.badgeContainer,
          {
            transform: [{ translateY: badgeSlideAnim }],
          },
        ]}
      >
        <View style={styles.badge}>
          <View style={styles.badgeIcon}>
            <Ionicons name="car-sport" size={18} color={theme.colors.primary} />
          </View>
          <Text style={styles.badgeText}>Covoiturage Bénin</Text>
        </View>
      </Animated.View>

      {/* Contenu inférieur animé */}
      <Animated.View
        style={[
          styles.contentContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
          },
        ]}
      >
        <View style={styles.textContent}>
          <Text style={styles.title}>
            Voyagez{"\n"}
            <Text style={styles.titleHighlight}>autrement</Text>
          </Text>

          <View style={styles.titleUnderline}>
            <LinearGradient
              colors={[theme.colors.secondary, theme.colors.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.underlineGradient}
            />
          </View>

          <Text style={styles.subtitle}>
            Rejoignez une communauté de voyageurs partageant les mêmes idées.
            Économisez, rencontrez et partagez la route.
          </Text>
        </View>

        <View style={styles.actionContainer}>
          {/* Bouton Connexion */}
          <Animated.View style={{ transform: [{ scale: buttonScale1 }] }}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPressIn={() => handlePressIn(1)}
              onPressOut={() => handlePressOut(1)}
              onPress={handleLogin}
            >
              <LinearGradient
                colors={[theme.colors.primary, theme.colors.primaryDark || theme.colors.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.primaryBtn}
              >
                <View style={styles.btnContent}>
                  <Text style={styles.primaryBtnText}>SE CONNECTER</Text>
                  <View style={styles.btnIconCircle}>
                    <Ionicons name="arrow-forward" size={20} color={theme.colors.white} />
                  </View>
                </View>

                {/* Animation de glow */}
                <Animated.View
                  style={[
                    styles.btnGlow,
                    {
                      opacity: glowOpacity,
                    },
                  ]}
                />
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {/* Bouton Inscription */}
          <Animated.View style={{ transform: [{ scale: buttonScale2 }] }}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPressIn={() => handlePressIn(2)}
              onPressOut={() => handlePressOut(2)}
              onPress={handleRegister}
            >
              <LinearGradient
                colors={['rgba(0,0,0,0.03)', 'rgba(0,0,0,0.01)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.secondaryBtn}
              >
                <View style={styles.btnContentSecondary}>
                  <Ionicons name="person-add-outline" size={20} color={theme.colors.primary} />
                  <Text style={styles.secondaryBtnText}>CRÉER UN COMPTE</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>


        </View>
      </Animated.View>


    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  imageContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: height * 0.65,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  gradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: height * 0.4,
  },
  badgeContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 20,
    right: 20,
    zIndex: 10,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    alignSelf: 'flex-start',
  },
  badgeIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  contentContainer: {
    flex: 1,
    marginTop: height * 0.52,
    paddingHorizontal: 28,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  textContent: {
    marginBottom: 40,
  },
  title: {
    fontSize: 42,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 12,
    letterSpacing: -0.5,
    lineHeight: 50,
  },
  titleHighlight: {
    color: theme.colors.primary,
    position: 'relative',
  },
  titleUnderline: {
    width: 60,
    height: 4,
    marginBottom: 20,
  },
  underlineGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 2,
  },
  subtitle: {
    fontSize: 15,
    color: theme.colors.textLight,
    lineHeight: 22,
    fontWeight: '500',
  },
  actionContainer: {
    gap: 16,
  },
  primaryBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: theme.colors.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: 24,
  },
  btnContentSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    paddingHorizontal: 24,
  },
  primaryBtnText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
  btnIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderRadius: 16,
  },
  secondaryBtn: {
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    overflow: 'hidden',
    backgroundColor: theme.colors.white,
    ...Platform.select({
      ios: {
        shadowColor: theme.colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  secondaryBtnText: {
    color: theme.colors.primary,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
  guestLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 16,
  },
  guestLinkText: {
    fontSize: 14,
    color: theme.colors.textLight,
    fontWeight: '500',
  },
  pageIndicator: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 100 : 80,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.border,
  },
  dotActive: {
    width: 24,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  dotGradient: {
    width: '100%',
    height: '100%',
  },
});