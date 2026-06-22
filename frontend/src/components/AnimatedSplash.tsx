/**
 * ==============================================================
 * Fichier :
 * AnimatedSplash.tsx
 *
 * Description :
 * Composant ou logique de l'application Zemy.
 *
 * Projet :
 * Zemy
 * ==============================================================
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, StyleSheet, Image, Dimensions } from 'react-native';
import { theme } from '../styles/theme';
import { fetchApi } from '../services/api';

type Props = {
  /** Callback called when the splash animation finishes */
  onFinish: () => void;
};

/**
 * Composant AnimatedSplash.
 *
 * Responsabilités :
 * - Affichage et gestion de l'état lié à AnimatedSplash.
 */
export default function AnimatedSplash({ onFinish }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const logoAnimScale = useRef(new Animated.Value(0.8)).current;

  const [branding, setBranding] = useState({
    logoUrl: null as string | null,
    scale: 1.0,
    posX: 160, // Default center of 320 canvas
    posY: 284, // Default center of 568 canvas
    animationType: 'fade_scale',
  });

  useEffect(() => {
    let animType = 'fade_scale';

    // 1. Fetch branding config
    fetchApi('/branding/')
      .then((data) => {
        if (data && data.logo) {
          animType = data.animation_type || 'fade_scale';
          setBranding({
            logoUrl: data.logo,
            scale: data.logo_scale || 1.0,
            posX: data.logo_position_x !== undefined ? data.logo_position_x : 160,
            posY: data.logo_position_y !== undefined ? data.logo_position_y : 284,
            animationType: animType,
          });
        }
      })
      .catch((err) => {
      })
      .finally(() => {
        // 2. Start animation based on the selected type
        let enterAnimation;
        
        if (animType === 'bounce') {
          logoAnimScale.setValue(0.3);
          enterAnimation = Animated.parallel([
            Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
            Animated.spring(logoAnimScale, {
              toValue: 1,
              friction: 3,
              tension: 40,
              useNativeDriver: true,
            })
          ]);
        } else if (animType === 'pulse') {
          logoAnimScale.setValue(0.8);
          enterAnimation = Animated.sequence([
            Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.timing(logoAnimScale, { toValue: 1.15, duration: 300, useNativeDriver: true }),
            Animated.timing(logoAnimScale, { toValue: 1.0, duration: 300, useNativeDriver: true }),
            Animated.timing(logoAnimScale, { toValue: 1.05, duration: 200, useNativeDriver: true }),
            Animated.timing(logoAnimScale, { toValue: 1.0, duration: 200, useNativeDriver: true }),
          ]);
        } else {
          // fade_scale
          logoAnimScale.setValue(0.8);
          enterAnimation = Animated.parallel([
            Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
            Animated.timing(logoAnimScale, { toValue: 1, duration: 500, useNativeDriver: true }),
          ]);
        }

        Animated.sequence([
          enterAnimation,
          Animated.delay(1200),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ]).start(() => {
          onFinish();
        });
      });
  }, []);

  const { width: windowWidth, height: windowHeight } = Dimensions.get('window');
  const scaleRatio = windowWidth / 320;

  // Calculate translations from center of the 320x568 virtual canvas, and scale to screen size
  const translateX = (branding.posX - 160) * scaleRatio;
  const translateY = (branding.posY - 284) * scaleRatio;
  
  // Combine the fetched scale with the animation scale AND screen ratio
  const combinedScale = Animated.multiply(logoAnimScale, branding.scale * scaleRatio);

  return (
    <View style={styles.container}>
      {branding.logoUrl ? (
        <View style={styles.virtualCanvas}>
          <Animated.Image
            source={{ uri: branding.logoUrl }}
            style={[
              styles.logoImage,
              { 
                opacity, 
                transform: [
                  { translateX }, 
                  { translateY }, 
                  { scale: combinedScale }
                ] 
              }
            ]}
            resizeMode="contain"
          />
        </View>
      ) : (
        <Animated.View
          style={[styles.iconContainer, { opacity, transform: [{ scale: logoAnimScale }] }]}>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.icon}
            resizeMode="contain"
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.primary, // Utilise la couleur principale Zemy par défaut
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  virtualCanvas: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImage: {
    width: 200, // Largeur par défaut, l'échelle (scale) s'appliquera par-dessus
    height: 200,
  },
  iconContainer: {
    width: 150,
    height: 150,
    backgroundColor: theme.colors.white,
    borderRadius: 32,
    padding: 16,
  },
  icon: {
    width: '100%',
    height: '100%',
  },
});
