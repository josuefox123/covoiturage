import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { theme } from '../styles/theme';
import { Ionicons } from '@expo/vector-icons';

type AlertButton = {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

type AlertOptions = {
  title: string;
  message?: string;
  buttons?: AlertButton[];
};

let alertListener: ((options: AlertOptions) => void) | null = null;

export const showCustomAlert = (title: string, message?: string, buttons?: AlertButton[]) => {
  if (alertListener) {
    alertListener({ title, message, buttons });
  } else {
    console.warn("CustomAlert not mounted. Fallback:", title, message);
  }
};

export const CustomAlert = {
  alert: showCustomAlert
};

export const CustomAlertProvider = () => {
  const [visible, setVisible] = useState(false);
  const [options, setOptions] = useState<AlertOptions | null>(null);
  const scaleValue = React.useRef(new Animated.Value(0)).current;
  const opacityValue = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    alertListener = (opts) => {
      setOptions(opts);
      setVisible(true);
      Animated.parallel([
        Animated.spring(scaleValue, {
          toValue: 1,
          useNativeDriver: true,
          tension: 40,
          friction: 5,
        }),
        Animated.timing(opacityValue, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    };
    return () => {
      alertListener = null;
    };
  }, []);

  const close = () => {
    Animated.parallel([
      Animated.timing(scaleValue, {
        toValue: 0.9,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(opacityValue, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setVisible(false);
      setOptions(null);
    });
  };

  if (!visible || !options) return null;

  const buttons = options.buttons && options.buttons.length > 0 
    ? options.buttons 
    : [{ text: 'OK' }];

  let iconName = 'information-circle';
  let iconColor = theme.colors.primary;
  
  if (options.title.toLowerCase().includes('erreur') || options.title.toLowerCase().includes('refus')) {
    iconName = 'alert-circle';
    iconColor = theme.colors.error;
  } else if (options.title.toLowerCase().includes('succès') || options.title.includes('🎉') || options.title.includes('✅')) {
    iconName = 'checkmark-circle';
    iconColor = theme.colors.success;
  } else if (options.title.toLowerCase().includes('attention')) {
    iconName = 'warning';
    iconColor = theme.colors.warning;
  }

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={close}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.alertBox, { opacity: opacityValue, transform: [{ scale: scaleValue }] }]}>
          <View style={styles.iconContainer}>
            <Ionicons name={iconName as any} size={48} color={iconColor} />
          </View>
          <Text style={styles.title}>{options.title}</Text>
          {options.message && <Text style={styles.message}>{options.message}</Text>}
          
          <View style={[styles.buttonContainer, buttons.length > 2 && styles.buttonContainerVertical]}>
            {buttons.map((btn, index) => {
              const isCancel = btn.style === 'cancel';
              const isDestructive = btn.style === 'destructive';
              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.button,
                    isCancel && styles.buttonCancel,
                    isDestructive && styles.buttonDestructive,
                    buttons.length > 2 && styles.buttonVertical
                  ]}
                  onPress={() => {
                    close();
                    if (btn.onPress) btn.onPress();
                  }}
                >
                  <Text style={[
                    styles.buttonText,
                    isCancel && styles.buttonTextCancel,
                    isDestructive && styles.buttonTextDestructive
                  ]}>
                    {btn.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  alertBox: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: theme.colors.white,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    color: theme.colors.textLight,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  buttonContainer: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  buttonContainerVertical: {
    flexDirection: 'column',
  },
  button: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonVertical: {
    width: '100%',
  },
  buttonCancel: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  buttonDestructive: {
    backgroundColor: theme.colors.error,
  },
  buttonText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  buttonTextCancel: {
    color: theme.colors.text,
  },
  buttonTextDestructive: {
    color: theme.colors.white,
  },
});
