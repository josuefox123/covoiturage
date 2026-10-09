/**
 * ==============================================================
 * Fichier : AnimatedSplash.tsx
 * Description : Écran de démarrage animé propre et ultra-sécurisé sans crash.
 * Projet : Zemy
 * ==============================================================
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, StyleSheet, Image } from 'react-native';
import { theme } from '../styles/theme';
import { fetchApi } from '../services/api';

type Props = {
  /** Callback appelée quand l'animation splash est terminée */
  onFinish: () => void;
};

export default function AnimatedSplash({ onFinish }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.85)).current;
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000);

    // Tentative de récupération du logo distant (1s max)
    fetchApi('/branding/', { signal: controller.signal })
      .then((data) => {
        if (mounted && data && data.logo) {
          setLogoUrl(data.logo);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!mounted) return;

        // Animation fluide d'entrée et de sortie
        Animated.sequence([
          Animated.parallel([
            Animated.timing(opacity, {
              toValue: 1,
              duration: 450,
              useNativeDriver: true,
            }),
            Animated.spring(logoScale, {
              toValue: 1,
              friction: 6,
              tension: 40,
              useNativeDriver: true,
            }),
          ]),
          Animated.delay(900),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 350,
            useNativeDriver: true,
          }),
        ]).start(() => {
          if (mounted) {
            onFinish();
          }
        });
      });

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
    };
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.logoWrapper, { opacity, transform: [{ scale: logoScale }] }]}>
        <Image
          source={logoUrl ? { uri: logoUrl } : require('../../assets/images/logozemy.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: theme.colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  logoWrapper: {
    width: 240,
    height: 110,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: '100%',
    height: '100%',
  },
});
