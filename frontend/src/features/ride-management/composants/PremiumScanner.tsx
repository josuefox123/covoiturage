import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView } from 'expo-camera';
import { C } from './theme-gestion';

interface PremiumScannerProps {
  visible: boolean;
  onClose: () => void;
  scanned: boolean;
  onScan: (scanData: any) => void;
  permission: any;
  requestPermission: () => Promise<any>;
}

/**
 * Scanner de QR code plein écran avec ligne laser animée
 * pour la validation rapide des tickets des passagers.
 */
export function PremiumScanner({
  visible,
  onClose,
  scanned,
  onScan,
  permission,
  requestPermission
}: PremiumScannerProps) {
  const laserY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(laserY, { toValue: 220, duration: 1800, useNativeDriver: true }),
        Animated.timing(laserY, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ])
    ).start();
    return () => laserY.stopAnimation();
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#0A0A0F' }}>
        {/* En-tête */}
        <View style={styles.scanHdr}>
          <TouchableOpacity style={styles.scanCloseBtn} onPress={onClose} activeOpacity={0.8}>
            <Ionicons name="chevron-down" size={24} color={C.white} />
          </TouchableOpacity>
          <Text style={styles.scanTitle}>Scanner le ticket</Text>
          <View style={{ width: 44 }} />
        </View>

        {/* Zone Caméra */}
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          {!permission ? (
            <ActivityIndicator size="large" color={C.primary} />
          ) : !permission.granted ? (
            <View style={{ padding: 32, alignItems: 'center', gap: 20 }}>
              <Ionicons name="camera-outline" size={64} color="rgba(255,255,255,0.4)" />
              <Text style={{ color: C.white, fontSize: 16, textAlign: 'center', lineHeight: 24 }}>
                L'accès à la caméra est nécessaire pour scanner les tickets.
              </Text>
              <TouchableOpacity style={styles.scanPermBtn} onPress={requestPermission} activeOpacity={0.85}>
                <Text style={{ color: C.white, fontSize: 15, fontWeight: '700' }}>Autoriser la caméra</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <CameraView
                style={StyleSheet.absoluteFillObject}
                facing="back"
                onBarcodeScanned={scanned ? undefined : onScan}
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              />
              {/* Overlay sombre avec fenêtre centrale transparente */}
              <View style={styles.scanOverlay}>
                <View style={styles.scanOverlayTop} />
                <View style={{ flexDirection: 'row' }}>
                  <View style={styles.scanOverlaySide} />
                  {/* Cadre du scanner */}
                  <View style={styles.scanFrame}>
                    {/* Repères d'angles */}
                    {['tl', 'tr', 'bl', 'br'].map((pos) => (
                      <View
                        key={pos}
                        style={[
                          styles.scanCorner,
                          pos.includes('t') ? { top: 0 } : { bottom: 0 },
                          pos.includes('l') ? { left: 0 } : { right: 0 },
                          pos.includes('t') && pos.includes('l') ? { borderTopWidth: 3, borderLeftWidth: 3 } : {},
                          pos.includes('t') && pos.includes('r') ? { borderTopWidth: 3, borderRightWidth: 3 } : {},
                          pos.includes('b') && pos.includes('l') ? { borderBottomWidth: 3, borderLeftWidth: 3 } : {},
                          pos.includes('b') && pos.includes('r') ? { borderBottomWidth: 3, borderRightWidth: 3 } : {},
                        ]}
                      />
                    ))}
                    {/* Ligne laser animée */}
                    <Animated.View style={[styles.laserLine, { transform: [{ translateY: laserY }] }]} />
                  </View>
                  <View style={styles.scanOverlaySide} />
                </View>
                <View style={styles.scanOverlayBottom} />
              </View>
              <View style={styles.scanInstruction}>
                <Text style={styles.scanInstructionTxt}>Positionnez le QR Code dans le cadre</Text>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scanHdr: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, backgroundColor: 'rgba(0,0,0,0.6)' },
  scanCloseBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  scanTitle: { color: C.white, fontSize: 18, fontWeight: '700' },
  scanPermBtn: { backgroundColor: C.primary, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 16 },
  scanOverlay: { ...StyleSheet.absoluteFillObject },
  scanOverlayTop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  scanOverlaySide: { width: 40, backgroundColor: 'rgba(0,0,0,0.6)' },
  scanOverlayBottom: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  scanFrame: { width: 240, height: 240, position: 'relative', overflow: 'visible' },
  scanCorner: { position: 'absolute', width: 28, height: 28, borderColor: C.primary },
  laserLine: { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: C.primary, shadowColor: C.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 8, elevation: 10 },
  scanInstruction: { position: 'absolute', bottom: 48, left: 0, right: 0, alignItems: 'center' },
  scanInstructionTxt: { color: C.white, fontSize: 14, fontWeight: '600', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 24 }
});
