import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../src/context/AuthContext';
import { CustomAlert } from '../src/utils/CustomAlert';

const { width } = Dimensions.get('window');
const PRIMARY = '#2563EB';

type StepId = 'intro' | 'selfie' | 'id_front' | 'id_back' | 'submit';

interface Step {
  id: StepId;
  label: string;
  icon: string;
}

const STEPS: Step[] = [
  { id: 'intro',    label: 'Bienvenue',     icon: 'shield-checkmark' },
  { id: 'selfie',   label: 'Selfie',        icon: 'camera' },
  { id: 'id_front', label: 'CNI Recto',     icon: 'card' },
  { id: 'id_back',  label: 'CNI Verso',     icon: 'card' },
  { id: 'submit',   label: 'Confirmer',     icon: 'checkmark-done' },
];

export default function VerifyIdentityScreen() {
  const router = useRouter();
  const { authFetch, updateUser } = useAuth();

  const [currentStep, setCurrentStep] = useState<number>(0);
  const [selfieUri,   setSelfieUri]   = useState<string | null>(null);
  const [idFrontUri,  setIdFrontUri]  = useState<string | null>(null);
  const [idBackUri,   setIdBackUri]   = useState<string | null>(null);
  const [submitting,  setSubmitting]  = useState(false);
  const [submitted,   setSubmitted]   = useState(false);

  // Preview modal state
  const [previewUri, setPreviewUri]     = useState<string | null>(null);
  const [pendingSetter, setPendingSetter] = useState<((uri: string) => void) | null>(null);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const cardAnim     = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: ((currentStep + 1) / STEPS.length) * 100,
      duration: 400,
      useNativeDriver: false,
    }).start();
    // Card entrance
    cardAnim.setValue(0.92);
    Animated.spring(cardAnim, { toValue: 1, friction: 7, useNativeDriver: true }).start();
  }, [currentStep]);

  useEffect(() => {
    if (submitted) {
      Animated.spring(successScale, { toValue: 1, friction: 6, useNativeDriver: true }).start();
    }
  }, [submitted]);

  // ── Image picker helper ────────────────────────────────────────────────────
  const pickImage = async (
    source: 'camera' | 'gallery',
    setter: (uri: string) => void,
    isSelfie: boolean = false
  ) => {
    const { status: camStatus } = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (camStatus !== 'granted') {
      CustomAlert.alert('Permission refusée', `Vous devez autoriser l'accès à ${source === 'camera' ? 'la caméra' : 'vos photos'}.`);
      return;
    }

    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 0.85 })
      : await ImagePicker.launchImageLibraryAsync({ allowsEditing: false, quality: 0.85, mediaTypes: ['images'] });

    if (!result.canceled && result.assets[0]) {
      // Show preview modal before confirming
      setPreviewUri(result.assets[0].uri);
      setPendingSetter(() => setter);
    }
  };

  const confirmPhoto = () => {
    if (previewUri && pendingSetter) {
      pendingSetter(previewUri);
    }
    setPreviewUri(null);
    setPendingSetter(null);
  };

  const cancelPhoto = () => {
    setPreviewUri(null);
    setPendingSetter(null);
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!selfieUri || !idFrontUri || !idBackUri) {
      CustomAlert.alert('Erreur', 'Veuillez fournir toutes les photos requises.');
      return;
    }
    
    setSubmitting(true);
    try {
      const formData = new FormData();
      
      const appendImage = (name: string, uri: string) => {
        const filename = uri.split('/').pop() || `${name}.jpg`;
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';
        formData.append(name, {
          uri,
          name: filename,
          type
        } as any);
      };

      appendImage('selfie', selfieUri);
      appendImage('id_front', idFrontUri);
      appendImage('id_back', idBackUri);

      await authFetch('/auth/request-verification/', {
        method: 'POST',
        body: formData,
      });
      // Mettre à jour le statut localement → le modal disparaît immédiatement
      updateUser({ verification_status: 'pending' });
      setSubmitted(true);
    } catch (e: any) {
      CustomAlert.alert('Erreur', e?.message || 'Impossible d\'envoyer la demande.');
    } finally {
      setSubmitting(false);
    }
  };

  const goNext = () => {
    if (currentStep < STEPS.length - 1) setCurrentStep(s => s + 1);
  };
  const goPrev = () => {
    if (currentStep > 0) setCurrentStep(s => s - 1);
  };

  const canGoNext = () => {
    const step = STEPS[currentStep];
    if (step.id === 'selfie')   return !!selfieUri;
    if (step.id === 'id_front') return !!idFrontUri;
    if (step.id === 'id_back')  return !!idBackUri;
    return true;
  };

  // ── Success screen ────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#FFFFFF', '#F8FAFC']} style={StyleSheet.absoluteFillObject} />
        <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Animated.View style={[styles.successCard, { transform: [{ scale: successScale }] }]}>
            <View style={styles.successIconWrapper}>
               <Ionicons name="shield-checkmark" size={42} color={PRIMARY} />
            </View>
            <Text style={styles.successTitle}>Votre identité est en cours de vérification</Text>
            
            <View style={styles.statusBox}>
              <View style={styles.statusRow}>
                <Ionicons name="time-outline" size={24} color="#6B7280" />
                <View>
                  <Text style={styles.statusLabel}>Temps estimé :</Text>
                  <Text style={styles.statusValue}>24 à 48 heures</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity style={styles.successBtn} onPress={() => router.replace('/(tabs)/home')}>
              <Text style={styles.successBtnText}>Retour à l'accueil</Text>
            </TouchableOpacity>
          </Animated.View>
        </SafeAreaView>
      </View>
    );
  }

  const step = STEPS[currentStep];

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#FFFFFF', '#F8FAFC']} style={StyleSheet.absoluteFillObject} />

      {/* ── Glassmorphism Header (Fallback for Android compatibility) ────────────────────── */}
      <View style={styles.headerBlur}>
        <SafeAreaView edges={['top']} style={{ paddingBottom: 16 }}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color="#1F2937" />
            </TouchableOpacity>
            
            <View style={styles.docStatusWrapper}>
              <Text style={styles.docStatusTitle}>Documents fournis</Text>
              <View style={styles.docStatusRow}>
                <Text style={styles.docStatusItem}>
                  <Ionicons name={selfieUri ? "checkmark-circle" : "ellipse-outline"} size={14} color={selfieUri ? PRIMARY : "#9CA3AF"} /> Selfie
                </Text>
                <Text style={styles.docStatusItem}>
                  <Ionicons name={idFrontUri ? "checkmark-circle" : "ellipse-outline"} size={14} color={idFrontUri ? PRIMARY : "#9CA3AF"} /> Recto
                </Text>
                <Text style={styles.docStatusItem}>
                  <Ionicons name={idBackUri ? "checkmark-circle" : "ellipse-outline"} size={14} color={idBackUri ? PRIMARY : "#9CA3AF"} /> Verso
                </Text>
              </View>
            </View>
            
            <View style={{ width: 42 }} />
          </View>

          {/* Uber-style Progress */}
          <View style={styles.progressContainer}>
            <View style={styles.progressRow}>
              <Text style={styles.progressLabel}>Étape {currentStep + 1} sur {STEPS.length}</Text>
              <Text style={styles.progressPercent}>{Math.round(((currentStep + 1) * 100) / STEPS.length)}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <Animated.View
                style={[styles.progressFill, {
                  width: progressAnim.interpolate({
                    inputRange: [0, 100],
                    outputRange: ['0%', '100%'],
                  }),
                }]}
              />
            </View>
          </View>
        </SafeAreaView>
      </View>

      <SafeAreaView style={{ flex: 1 }} edges={['bottom', 'left', 'right']}>
        {/* ── Content card ─────────────────────────────────────────────── */}
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <Animated.View style={[styles.card, { transform: [{ scale: cardAnim }] }]}>

            {/* ═══ ÉTAPE 0 : Intro ═══ */}
            {step.id === 'intro' && (
              <View style={styles.stepContent}>
                <Image source={require('../assets/verify.png')} style={styles.introIllustration} resizeMode="contain" />
                <Text style={styles.stepTitle}>Vérifiez votre identité</Text>
                <Text style={styles.stepDesc}>
                  Pour la sécurité de notre communauté, nous avons besoin de vérifier votre identité avant que vous puissiez réserver des courses.
                </Text>
                <View style={styles.requirementList}>
                  {[
                    { text: 'Selfie clair et centré' },
                    { text: 'Pièce d\'identité valide' },
                    { text: 'Vérification rapide (24-48h)' },
                    { text: 'Données chiffrées & sécurisées' },
                  ].map((req, i) => (
                    <View key={i} style={styles.requirementRow}>
                      <Ionicons name="checkmark-circle" size={20} color={PRIMARY} />
                      <Text style={styles.requirementText}>{req.text}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* ═══ ÉTAPE 1 : Selfie ═══ */}
            {step.id === 'selfie' && (
              <View style={styles.stepContent}>
                <View style={styles.miniBadge}>
                  <Ionicons name={step.icon as any} size={20} color={PRIMARY} />
                </View>
                <Text style={styles.stepTitle}>Votre selfie</Text>
                <Text style={styles.stepDesc}>
                  Prenez une photo de votre visage. Assurez-vous que votre visage est bien visible et bien éclairé.
                </Text>
                <PhotoCapture
                  uri={selfieUri}
                  placeholder="Prendre un selfie"
                  placeholderIcon="person"
                  onCamera={() => pickImage('camera', setSelfieUri, true)}
                  onGallery={() => pickImage('gallery', setSelfieUri, true)}
                />
              </View>
            )}

            {/* ═══ ÉTAPE 2 : CNI Recto ═══ */}
            {step.id === 'id_front' && (
              <View style={styles.stepContent}>
                <View style={styles.miniBadge}>
                  <Ionicons name={step.icon as any} size={20} color={PRIMARY} />
                </View>
                <Text style={styles.stepTitle}>Document — Recto</Text>
                <Text style={styles.stepDesc}>
                  Photographiez le recto de votre Carte Nationale d'Identité ou de votre passeport.
                </Text>
                <PhotoCapture
                  uri={idFrontUri}
                  placeholder="Photographier le recto"
                  placeholderIcon="card"
                  onCamera={() => pickImage('camera', setIdFrontUri)}
                  onGallery={() => pickImage('gallery', setIdFrontUri)}
                />
              </View>
            )}

            {/* ═══ ÉTAPE 3 : CNI Verso ═══ */}
            {step.id === 'id_back' && (
              <View style={styles.stepContent}>
                <View style={styles.miniBadge}>
                  <Ionicons name={step.icon as any} size={20} color={PRIMARY} />
                </View>
                <Text style={styles.stepTitle}>Document — Verso</Text>
                <Text style={styles.stepDesc}>
                  Photographiez maintenant le verso (dos) de votre document d'identité.
                </Text>
                <PhotoCapture
                  uri={idBackUri}
                  placeholder="Photographier le verso"
                  placeholderIcon="card"
                  onCamera={() => pickImage('camera', setIdBackUri)}
                  onGallery={() => pickImage('gallery', setIdBackUri)}
                />
              </View>
            )}

            {/* ═══ ÉTAPE 4 : Récapitulatif ═══ */}
            {step.id === 'submit' && (
              <View style={styles.stepContent}>
                <View style={styles.miniBadge}>
                  <Ionicons name={step.icon as any} size={20} color={PRIMARY} />
                </View>
                <Text style={styles.stepTitle}>Tout est prêt !</Text>
                <Text style={styles.stepDesc}>
                  Vérifiez vos photos avant de soumettre.
                </Text>

                {/* Récap photos */}
                <View style={styles.recapGrid}>
                  <RecapThumb label="Selfie"     uri={selfieUri}  />
                  <RecapThumb label="CNI Recto"  uri={idFrontUri} />
                  <RecapThumb label="CNI Verso"  uri={idBackUri}  />
                </View>

                {/* Bouton submit */}
                <TouchableOpacity
                  style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
                  onPress={handleSubmit}
                  disabled={submitting}
                  activeOpacity={0.85}
                >
                  {submitting
                    ? <ActivityIndicator color="#FFFFFF" size="small" />
                    : <Text style={styles.submitBtnText}>Soumettre la vérification</Text>
                  }
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>
        </ScrollView>

        {/* ── Navigation buttons ───────────────────────────────────────── */}
        <View style={styles.navRow}>
          {currentStep > 0 ? (
            <TouchableOpacity style={styles.navBtnSecondary} onPress={goPrev}>
              <Text style={styles.navBtnSecondaryText}>Précédent</Text>
            </TouchableOpacity>
          ) : <View style={{ flex: 1 }} />}

          {step.id !== 'submit' && (
            <TouchableOpacity
              style={[styles.navBtnPrimary, !canGoNext() && styles.navBtnDisabled]}
              onPress={goNext}
              disabled={!canGoNext()}
              activeOpacity={0.85}
            >
              <Text style={styles.navBtnPrimaryText}>
                {step.id === 'intro' ? 'Continuer' : 'Suivant'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>

      {/* ── Photo Preview Modal ─────────────────────────────────────────── */}
      {previewUri && (
        <View style={styles.previewModal}>
          <View style={styles.previewOverlay}>
            <View style={styles.previewHeader}>
              <Text style={styles.previewTitle}>Vérifiez votre photo</Text>
              <Text style={styles.previewSubtitle}>La photo est-elle nette et bien cadrée ?</Text>
            </View>

            <Image
              source={{ uri: previewUri }}
              style={styles.previewImage}
              resizeMode="contain"
            />

            <View style={styles.previewActions}>
              <TouchableOpacity style={styles.previewRetakeBtn} onPress={cancelPhoto} activeOpacity={0.85}>
                <Ionicons name="refresh" size={20} color="#374151" />
                <Text style={styles.previewRetakeText}>Reprendre</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.previewConfirmBtn} onPress={confirmPhoto} activeOpacity={0.85}>
                <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                <Text style={styles.previewConfirmText}>Utiliser cette photo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function PhotoCapture({
  uri, placeholder, placeholderIcon, onCamera, onGallery,
}: {
  uri: string | null;
  placeholder: string;
  placeholderIcon: string;
  onCamera: () => void;
  onGallery: () => void;
}) {
  return (
    <View style={pcStyles.container}>
      {uri ? (
        <View style={pcStyles.preview}>
          <Image 
            source={{ uri }} 
            style={pcStyles.img} 
            resizeMode="cover"
          />
          <View style={pcStyles.overlay}>
            <TouchableOpacity style={pcStyles.retakeBtn} onPress={onCamera}>
              <Ionicons name="refresh" size={16} color="#FFFFFF" />
              <Text style={pcStyles.retakeText}>Reprendre</Text>
            </TouchableOpacity>
          </View>
          <View style={pcStyles.successBadge}>
            <Ionicons name="checkmark-circle" size={28} color="#10B981" />
          </View>
        </View>
      ) : (
        <View style={pcStyles.empty}>
          <Ionicons name={placeholderIcon as any} size={48} color="#E5E7EB" />
          <Text style={pcStyles.emptyText}>{placeholder}</Text>
        </View>
      )}
      <View style={pcStyles.btnRow}>
        <TouchableOpacity style={pcStyles.btn} onPress={onCamera} activeOpacity={0.85}>
          <Ionicons name="camera" size={18} color="#FFFFFF" />
          <Text style={pcStyles.btnText}>Caméra</Text>
        </TouchableOpacity>
        <TouchableOpacity style={pcStyles.btnOutline} onPress={onGallery} activeOpacity={0.85}>
          <Ionicons name="images" size={18} color="#1F2937" />
          <Text style={pcStyles.btnOutlineText}>Galerie</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function RecapThumb({ label, uri }: { label: string; uri: string | null }) {
  return (
    <View style={rtStyles.container}>
      {uri ? (
        <Image source={{ uri }} style={rtStyles.img} resizeMode="cover" />
      ) : (
        <View style={rtStyles.empty}>
          <Ionicons name="image-outline" size={24} color="#D1D5DB" />
        </View>
      )}
      <View style={[rtStyles.badge, uri ? rtStyles.badgeOk : rtStyles.badgeErr]}>
        <Ionicons name={uri ? 'checkmark' : 'close'} size={10} color="#FFFFFF" />
      </View>
      <Text style={rtStyles.label}>{label}</Text>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  headerBlur: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 10,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center',
  },
  docStatusWrapper: {
    alignItems: 'center',
  },
  docStatusTitle: {
    fontSize: 12, color: '#6B7280', fontWeight: '500', marginBottom: 4,
  },
  docStatusRow: {
    flexDirection: 'row', gap: 12,
  },
  docStatusItem: {
    fontSize: 12, color: '#1F2937', fontWeight: '600',
  },
  progressContainer: { paddingHorizontal: 20, marginTop: 24, marginBottom: 4 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressLabel: { fontSize: 13, color: '#6B7280', fontWeight: '600' },
  progressPercent: { fontSize: 13, color: PRIMARY, fontWeight: '700' },
  progressTrack: {
    height: 4, backgroundColor: '#F3F4F6', borderRadius: 2, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: PRIMARY, borderRadius: 2 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 16 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 20,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  stepContent: { alignItems: 'center' },
  introIllustration: {
    width: 220,
    height: 220,
    marginBottom: 16,
  },
  miniBadge: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 20,
  },
  stepTitle: { fontSize: 22, fontWeight: '800', color: '#111827', textAlign: 'center', marginBottom: 10 },
  stepDesc:  { fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  requirementList: { width: '100%', gap: 16, marginBottom: 20 },
  requirementRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  requirementText: { flex: 1, fontSize: 15, color: '#374151', fontWeight: '500' },
  submitBtn: { width: '100%', borderRadius: 16, backgroundColor: PRIMARY, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  recapGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 24,
    gap: 8,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  navBtnSecondary: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F3F4F6', borderRadius: 16, paddingVertical: 16,
  },
  navBtnSecondaryText: { fontSize: 15, color: '#4B5563', fontWeight: '700' },
  navBtnPrimary: { flex: 1, borderRadius: 16, backgroundColor: PRIMARY, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  navBtnDisabled: { backgroundColor: '#E5E7EB' },
  navBtnPrimaryText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  // Success screen
  successCard: {
    backgroundColor: '#FFFFFF', borderRadius: 32, padding: 32, alignItems: 'center', width: '100%',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.04, shadowRadius: 24, elevation: 6,
    borderWidth: 1, borderColor: '#F3F4F6',
  },
  successIconWrapper: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginBottom: 24,
  },
  successTitle: { fontSize: 24, fontWeight: '800', color: '#111827', textAlign: 'center', marginBottom: 24, lineHeight: 32 },
  statusBox: {
    width: '100%', backgroundColor: '#F9FAFB', borderRadius: 20, padding: 20, marginBottom: 32,
    borderWidth: 1, borderColor: '#F3F4F6',
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  statusLabel: { fontSize: 14, color: '#6B7280', fontWeight: '500', marginBottom: 4 },
  statusValue: { fontSize: 16, color: '#111827', fontWeight: '700' },
  successBtn: { width: '100%', borderRadius: 16, backgroundColor: '#F3F4F6', paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  successBtnText: { fontSize: 16, fontWeight: '700', color: '#374151' },
  // Photo Preview Modal
  previewModal: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    backgroundColor: '#000000',
  },
  previewOverlay: {
    flex: 1,
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
  },
  previewHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  previewTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  previewSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
  },
  previewImage: {
    flex: 1,
    width: '100%',
    borderRadius: 20,
  },
  previewActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  previewRetakeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  previewRetakeText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  previewConfirmBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563EB',
    borderRadius: 16,
    paddingVertical: 16,
  },
  previewConfirmText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});

const pcStyles = StyleSheet.create({
  container: { width: '100%', marginBottom: 12 },
  preview: {
    width: '100%',
    height: 220,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
    backgroundColor: '#F3F4F6',
  },
  img: {
    ...StyleSheet.absoluteFillObject,
    width: undefined,
    height: undefined,
  },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.2)', justifyContent: 'flex-end', padding: 12 },
  retakeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  retakeText: { fontSize: 13, color: '#FFFFFF', fontWeight: '600' },
  successBadge: { position: 'absolute', top: 12, right: 12 },
  empty: {
    width: '100%', height: 180, borderRadius: 20, borderWidth: 1.5, borderColor: '#E5E7EB',
    borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', gap: 12, marginBottom: 16,
    backgroundColor: '#F9FAFB',
  },
  emptyText: { fontSize: 14, color: '#9CA3AF', fontWeight: '600' },
  btnRow: { flexDirection: 'row', gap: 12 },
  btn: { flex: 1, borderRadius: 16, backgroundColor: PRIMARY, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  btnOutline: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14,
    borderRadius: 16, backgroundColor: '#F3F4F6',
  },
  btnOutlineText: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
});

const rtStyles = StyleSheet.create({
  container: { alignItems: 'center', gap: 6, flex: 1 },
  img: { width: '100%', aspectRatio: 1, borderRadius: 16 },
  empty: {
    width: '100%', aspectRatio: 1, borderRadius: 16, borderWidth: 1.5,
    borderColor: '#E5E7EB', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  badge: {
    position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11,
    justifyContent: 'center', alignItems: 'center',
  },
  badgeOk: { backgroundColor: '#2563EB' },
  badgeErr: { backgroundColor: '#E5E7EB' },
  label: { fontSize: 12, color: '#6B7280', fontWeight: '600' },
});
