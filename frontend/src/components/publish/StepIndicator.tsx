/**
 * StepIndicator.tsx
 * Barre de progression multi-étapes animée et interactive pour le formulaire de publication de trajet.
 */
import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { theme } from '../../styles/theme';

interface StepIndicatorProps {
  currentStep: number; // 1-indexed
  totalSteps: number;
  labels?: string[];
  maxStepReached?: number;
  onStepPress?: (step: number) => void;
}

export function StepIndicator({
  currentStep,
  totalSteps,
  labels,
  maxStepReached,
  onStepPress,
}: StepIndicatorProps) {
  const animatedWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const progress = ((currentStep - 1) / (totalSteps - 1)) * 100;
    Animated.spring(animatedWidth, {
      toValue: progress,
      useNativeDriver: false,
      friction: 6,
      tension: 60,
    }).start();
  }, [currentStep, totalSteps]);

  const maxAllowed = maxStepReached ?? currentStep;

  return (
    <View style={styles.container}>
      {/* Progress track */}
      <View style={styles.trackContainer}>
        <View style={styles.trackBackground} />
        <Animated.View
          style={[
            styles.trackFill,
            {
              width: animatedWidth.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
        {/* Step circles */}
        <View style={styles.stepsRow}>
          {Array.from({ length: totalSteps }).map((_, index) => {
            const stepNum = index + 1;
            const isCompleted = stepNum < currentStep;
            const isCurrent = stepNum === currentStep;
            const isUnlocked = stepNum <= maxAllowed;
            const isClickable = Boolean(onStepPress && isUnlocked && !isCurrent);

            return (
              <TouchableOpacity
                key={stepNum}
                disabled={!isClickable}
                onPress={() => onStepPress?.(stepNum)}
                activeOpacity={0.7}
                style={styles.stepWrapper}
                accessibilityRole={isClickable ? 'button' : undefined}
                accessibilityLabel={labels && labels[index] ? `Étape ${labels[index]}` : `Étape ${stepNum}`}
              >
                <View
                  style={[
                    styles.circle,
                    isCompleted && styles.circleCompleted,
                    isCurrent && styles.circleCurrent,
                    isUnlocked && !isCompleted && !isCurrent && styles.circleUnlocked,
                  ]}
                >
                  {isCompleted ? (
                    <Text style={styles.checkmark}>✓</Text>
                  ) : (
                    <Text
                      style={[
                        styles.stepNum,
                        isCurrent && styles.stepNumCurrent,
                        isUnlocked && !isCurrent && styles.stepNumUnlocked,
                      ]}
                    >
                      {stepNum}
                    </Text>
                  )}
                </View>
                {labels && labels[index] ? (
                  <Text
                    style={[
                      styles.label,
                      isCurrent && styles.labelActive,
                      isUnlocked && !isCurrent && styles.labelUnlocked,
                    ]}
                  >
                    {labels[index]}
                  </Text>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  trackContainer: {
    position: 'relative',
    height: 40,
    justifyContent: 'center',
  },
  trackBackground: {
    position: 'absolute',
    top: 15,
    left: 20,
    right: 20,
    height: 2,
    backgroundColor: '#E5E7EB',
    borderRadius: 1,
  },
  trackFill: {
    position: 'absolute',
    top: 15,
    left: 20,
    height: 2,
    backgroundColor: theme.colors.primary,
    borderRadius: 1,
  },
  stepsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepWrapper: {
    alignItems: 'center',
  },
  circle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F3F4F6',
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleCompleted: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  circleCurrent: {
    backgroundColor: '#FFFFFF',
    borderColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  circleUnlocked: {
    borderColor: theme.colors.primary,
    backgroundColor: '#EFF6FF',
  },
  stepNum: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  stepNumCurrent: {
    color: theme.colors.primary,
  },
  stepNumUnlocked: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
  checkmark: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  label: {
    fontSize: 9,
    color: '#9CA3AF',
    marginTop: 3,
    textAlign: 'center',
    maxWidth: 60,
  },
  labelActive: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  labelUnlocked: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
});
