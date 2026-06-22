/**
 * ==============================================================
 * Fichier :
 * CustomAlert.tsx
 *
 * Description :
 * Composant ou logique de l'application Zemy.
 *
 * Projet :
 * Zemy
 * ==============================================================
 */
import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Modal, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../styles/theme';

interface CustomAlertProps {
  visible: boolean;
  title: string;
  message: string;
  type?: 'error' | 'success' | 'info';
  onClose: () => void;
  buttonText?: string;
}

const { width } = Dimensions.get('window');

/**
 * Composant CustomAlert.
 *
 * Responsabilités :
 * - Affichage et gestion de l'état lié à CustomAlert.
 */
export default function CustomAlert({
  visible,
  title,
  message,
  type = 'error',
  onClose,
  buttonText = 'Compris'
}: CustomAlertProps) {
  const scaleValue = useRef(new Animated.Value(0)).current;
  const opacityValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleValue, {
          toValue: 1,
          useNativeDriver: true,
          tension: 40,
          friction: 7
        }),
        Animated.timing(opacityValue, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        })
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleValue, {
          toValue: 0.8,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(opacityValue, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        })
      ]).start();
    }
  }, [visible]);

  if (!visible && (opacityValue as any)._value === 0) return null;

  const getIconConfig = () => {
    switch (type) {
      case 'error': return { name: 'warning', color: theme.colors.error, bgColor: theme.colors.errorLight };
      case 'success': return { name: 'checkmark-circle', color: theme.colors.success, bgColor: theme.colors.secondaryLight };
      case 'info': return { name: 'information-circle', color: theme.colors.primary, bgColor: theme.colors.primaryLight };
      default: return { name: 'alert-circle', color: theme.colors.primary, bgColor: '#FCE7F3' };
    }
  };

  const iconConfig = getIconConfig();

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.overlayBg, { opacity: opacityValue }]} />

        <Animated.View
          style={[
            styles.alertBox,
            {
              opacity: opacityValue,
              transform: [{ scale: scaleValue }]
            }
          ]}
        >
          <View style={[styles.iconContainer, { backgroundColor: iconConfig.bgColor }]}>
            <Ionicons name={iconConfig.name as any} size={32} color={iconConfig.color} />
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: iconConfig.color }]}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>{buttonText}</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.overlay,
  },
  alertBox: {
    width: width * 0.85,
    backgroundColor: theme.colors.white,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    ...theme.typography.h3,
    color: theme.colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    ...theme.typography.bodyMedium,
    color: theme.colors.textLight,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  button: {
    width: '100%',
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    ...theme.typography.button,
    color: theme.colors.white,
    fontSize: 16,
  }
});
