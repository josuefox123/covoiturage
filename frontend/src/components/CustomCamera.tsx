import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Image,
  Dimensions,
  Platform,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');
const PRIMARY = '#2563EB';

export interface CustomCameraProps {
  onClose: () => void;
  onPictureTaken: (uri: string) => void;
  initialFacing?: CameraType;
  title?: string;
  instruction?: string;
  mask?: 'circle' | 'rectangle' | 'none';
}

export default function CustomCamera({
  onClose,
  onPictureTaken,
  initialFacing = 'back',
  title = 'Appareil photo',
  instruction = 'Cadrez votre document',
  mask = 'none',
}: CustomCameraProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>(initialFacing);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permissionContainer}>
        <Ionicons name="camera-outline" size={64} color="#9CA3AF" />
        <Text style={styles.permissionTitle}>Accès à la caméra</Text>
        <Text style={styles.permissionText}>
          Nous avons besoin de votre autorisation pour utiliser l'appareil photo.
        </Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
          <Text style={styles.permissionBtnText}>Autoriser</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
          <Text style={styles.cancelBtnText}>Annuler</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const toggleCameraFacing = () => {
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
  };

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          // Removed base64 for performance
        });
        if (photo) {
          setPreviewUri(photo.uri);
        }
      } catch (e) {
        console.log('Error taking picture:', e);
      }
    }
  };

  const handleRetake = () => {
    setPreviewUri(null);
  };

  const handleConfirm = () => {
    if (previewUri) {
      onPictureTaken(previewUri);
    }
  };

  if (previewUri) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Aperçu</Text>
        </View>
        <View style={styles.previewContainer}>
          <Image source={{ uri: previewUri }} style={styles.previewImage} resizeMode="contain" />
        </View>
        <View style={styles.previewActions}>
          <TouchableOpacity style={styles.retakeBtn} onPress={handleRetake}>
            <Ionicons name="refresh" size={20} color="#1F2937" />
            <Text style={styles.retakeBtnText}>Reprendre</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
            <Ionicons name="checkmark" size={20} color="#FFFFFF" />
            <Text style={styles.confirmBtnText}>Valider</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.iconBtn}>
          <Ionicons name="close" size={28} color="#FFFFFF" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>{title}</Text>
          {instruction && <Text style={styles.headerSub}>{instruction}</Text>}
        </View>
        <TouchableOpacity onPress={toggleCameraFacing} style={styles.iconBtn}>
          <Ionicons name="camera-reverse" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFillObject}
          facing={facing}
          mode="picture"
        />
        
        {/* Masques visuels de guidage */}
        {mask === 'circle' && (
          <View style={styles.maskContainer}>
            <View style={styles.circleMask} />
          </View>
        )}
        {mask === 'rectangle' && (
          <View style={styles.maskContainer}>
            <View style={styles.rectangleMask} />
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.captureOuterBtn} onPress={takePicture}>
          <View style={styles.captureInnerBtn} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 20,
    marginBottom: 10,
    color: '#1F2937',
  },
  permissionText: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 30,
  },
  permissionBtn: {
    backgroundColor: PRIMARY,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  permissionBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelBtn: {
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#000000',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerSub: {
    color: '#D1D5DB',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 2,
  },
  iconBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 22,
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 24,
    marginHorizontal: 10,
  },
  maskContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  circleMask: {
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: (width * 0.8) / 2,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 5,
  },
  rectangleMask: {
    width: width * 0.9,
    height: (width * 0.9) * (3 / 4),
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 5,
  },
  footer: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  captureOuterBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureInnerBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 24,
    backgroundColor: '#000000',
    gap: 16,
  },
  retakeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderRadius: 16,
  },
  retakeBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  confirmBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: PRIMARY,
    paddingVertical: 16,
    borderRadius: 16,
  },
  confirmBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
