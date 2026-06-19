import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  PanResponder,
  Dimensions,
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../styles/theme';

const { width, height } = Dimensions.get('window');
const HEADER_HEIGHT = 50;
const WINDOW_WIDTH = width * 0.92;

interface DraggableWindowProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  initialHeight?: number;
}

export function DraggableWindow({
  visible,
  onClose,
  title,
  children,
  initialHeight = 420,
}: DraggableWindowProps) {
  const [isMinimized, setIsMinimized] = useState(false);

  // Position shared values
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;
  const windowHeightAnim = useRef(new Animated.Value(initialHeight)).current;

  // Reset position & state when opening
  useEffect(() => {
    if (visible) {
      pan.setValue({ x: 0, y: 0 });
      setIsMinimized(false);
      windowHeightAnim.setValue(initialHeight);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 6, tension: 100, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.92, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const toggleMinimize = () => {
    const newState = !isMinimized;
    setIsMinimized(newState);
    Animated.spring(windowHeightAnim, {
      toValue: newState ? HEADER_HEIGHT : initialHeight,
      friction: 7,
      tension: 80,
      useNativeDriver: false, // height can't use native driver
    }).start();
  };

  // PanResponder for drag (only enabled on header)
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        pan.setOffset({ x: (pan.x as any)._value, y: (pan.y as any)._value });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: () => {
        pan.flattenOffset();
      },
    })
  ).current;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {/* Overlay semi-transparent - tap to close */}
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        {/* Window - stop propagation so inner taps don't close */}
        <Animated.View
          style={[
            styles.window,
            {
              opacity,
              transform: [
                { translateX: pan.x },
                { translateY: pan.y },
                { scale },
              ],
              height: windowHeightAnim,
            },
          ]}
        >
          <TouchableOpacity activeOpacity={1} style={{ flex: 1 }}>
            {/* Header (draggable) */}
            <Animated.View {...panResponder.panHandlers} style={styles.header}>
              {/* Drag indicator */}
              <View style={styles.dragHandle} />
              <View style={styles.headerContent}>
                <Ionicons name="menu" size={18} color={theme.colors.textMuted} style={{ marginRight: 8 }} />
                <Text style={styles.title} numberOfLines={1}>{title}</Text>
              </View>
              <View style={styles.headerButtons}>
                <TouchableOpacity onPress={toggleMinimize} style={styles.windowBtn}>
                  <Ionicons
                    name={isMinimized ? 'chevron-down' : 'remove-outline'}
                    size={18}
                    color={theme.colors.textMuted}
                  />
                </TouchableOpacity>
                <TouchableOpacity onPress={onClose} style={[styles.windowBtn, styles.closeBtnStyle]}>
                  <Ionicons name="close" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </Animated.View>

            {/* Content */}
            {!isMinimized && (
              <View style={styles.content}>
                {children}
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  window: {
    width: WINDOW_WIDTH,
    backgroundColor: theme.colors.background,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 15,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  header: {
    height: HEADER_HEIGHT,
    backgroundColor: '#F7F8FA',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    flexDirection: 'column',
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 8,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: 6,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    bottom: 8,
    left: 14,
    right: 80,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
    flex: 1,
  },
  headerButtons: {
    position: 'absolute',
    bottom: 6,
    right: 10,
    flexDirection: 'row',
    gap: 6,
  },
  windowBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnStyle: {
    backgroundColor: 'rgba(239,68,68,0.12)',
  },
  content: {
    flex: 1,
    overflow: 'hidden',
  },
});
