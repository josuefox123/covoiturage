import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getMediaUrl } from '../../../../../utils/media';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { theme } from '../../../../../styles/theme';
import { styles } from '../styles';
import { AppBottomSheet } from '../../../../../components/AppBottomSheet';
import { CustomAlert } from '../../../../../utils/CustomAlert';

interface PersonalInfoModalProps {
  visible: boolean;
  onClose: () => void;
  user: any;
  authFetch: any;
  updateUser: (data: any) => void;
}

export function PersonalInfoModal({
  visible,
  onClose,
  user,
  authFetch,
  updateUser,
}: PersonalInfoModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [editFullName, setEditFullName] = useState(user?.full_name || '');
  const [editPhone, setEditPhone] = useState(user?.phone || '');
  const [editEmail, setEditEmail] = useState(user?.email || '');
  const [emailError, setEmailError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(user?.avatar || null);

  useEffect(() => {
    if (visible && user) {
      setEditFullName(user.full_name || '');
      setEditPhone(user.phone || '');
      setEditEmail(user.email || '');
      setAvatarUri(user.avatar || null);
      setEmailError('');
      setPhoneError('');
    }
  }, [visible, user]);

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      CustomAlert.alert('Permission refusée', 'Vous devez autoriser l\'accès à votre caméra.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const handleEmailBlur = async () => {
    if (!editEmail) return;
    try {
      const data = await authFetch('/users/check_email/', {
        method: 'POST',
        body: JSON.stringify({ email: editEmail }),
      });
      if (data.exists && data.email !== user?.email) {
        setEmailError('Cet email est déjà utilisé');
      } else {
        setEmailError('');
      }
    } catch (e) {}
  };

  const handlePhoneBlur = async () => {
    if (!editPhone) return;
    try {
      const data = await authFetch('/users/check_phone/', {
        method: 'POST',
        body: JSON.stringify({ phone: editPhone }),
      });
      if (data.exists && data.phone !== user?.phone) {
        setPhoneError('Ce numéro est déjà utilisé');
      } else {
        setPhoneError('');
      }
    } catch (e) {}
  };

  const handleSave = async () => {
    if (!editFullName.trim()) {
      CustomAlert.alert('Erreur', 'Le nom complet est obligatoire.');
      return;
    }
    if (!editEmail.trim()) {
      CustomAlert.alert('Erreur', 'L\'email est obligatoire.');
      return;
    }
    if (emailError || phoneError) {
      CustomAlert.alert('Erreur', 'Corrigez les champs avant de sauvegarder.');
      return;
    }

    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append('full_name', editFullName.trim());
      formData.append('phone', editPhone);
      if (editEmail) formData.append('email', editEmail);

      if (avatarUri && avatarUri !== user?.avatar) {
        const filename = avatarUri.split('/').pop() || 'avatar.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';
        formData.append('avatar', {
          uri: avatarUri,
          name: filename,
          type,
        } as any);
      }

      await authFetch(`/users/${user.id}/`, {
        method: 'PATCH',
        body: formData,
      });

      updateUser({
        full_name: editFullName,
        email: editEmail,
        phone: editPhone,
        avatar: avatarUri,
      });

      CustomAlert.alert('Succès', 'Informations personnelles mises à jour !');
      onClose();
    } catch (e: any) {
      CustomAlert.alert('Erreur', e.message || 'Impossible de mettre à jour.');
    } finally {
      setIsSaving(false);
    }
  };

  const initials = editFullName
    ? editFullName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
    : '?';

  return (
    <AppBottomSheet
      visible={visible}
      onClose={onClose}
      snapPoints={['75%', '95%']}
    >
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>Informations personnelles</Text>
      </View>

      <View style={{ flex: 1 }}>
        <TouchableOpacity onPress={pickAvatar} style={styles.modernAvatarPicker} activeOpacity={0.8}>
          <View style={styles.avatarWrapper}>
            {avatarUri ? (
              <Image source={{ uri: getMediaUrl(avatarUri) }} style={styles.modernAvatar} resizeMode="cover" />
            ) : (
              <LinearGradient colors={[theme.colors.primaryLight, theme.colors.primary]} style={styles.modernAvatarPlaceholder}>
                <Ionicons name="person" size={40} color={theme.colors.white} />
                <Text style={styles.modernAvatarText}>{initials}</Text>
              </LinearGradient>
            )}
            <View style={styles.modernAvatarEditBadge}>
              <Ionicons name="camera" size={16} color={theme.colors.white} />
            </View>
          </View>
        </TouchableOpacity>

        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.textMuted, marginBottom: 6 }}>Nom complet</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="person-outline" size={18} color={theme.colors.primary} style={styles.inputIcon} />
            <TextInput
              style={styles.modalInputModern}
              placeholder="Votre nom complet"
              value={editFullName}
              onChangeText={setEditFullName}
              placeholderTextColor={theme.colors.textMuted}
            />
          </View>
        </View>

        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.textMuted, marginBottom: 6 }}>Numéro de téléphone</Text>
          <View style={[styles.inputWrapper, phoneError ? { borderColor: theme.colors.error } : null]}>
            <Ionicons name="call-outline" size={18} color={phoneError ? theme.colors.error : theme.colors.primary} style={styles.inputIcon} />
            <TextInput
              style={styles.modalInputModern}
              placeholder="Votre numéro de téléphone"
              value={editPhone}
              onChangeText={setEditPhone}
              onBlur={handlePhoneBlur}
              keyboardType="phone-pad"
              placeholderTextColor={theme.colors.textMuted}
            />
          </View>
          {phoneError ? <Text style={styles.errorText}>{phoneError}</Text> : null}
        </View>

        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.textMuted, marginBottom: 6 }}>Adresse email</Text>
          <View style={[styles.inputWrapper, emailError ? { borderColor: theme.colors.error } : null]}>
            <Ionicons name="mail-outline" size={18} color={emailError ? theme.colors.error : theme.colors.primary} style={styles.inputIcon} />
            <TextInput
              style={styles.modalInputModern}
              placeholder="Votre adresse email"
              value={editEmail}
              onChangeText={setEditEmail}
              onBlur={handleEmailBlur}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholderTextColor={theme.colors.textMuted}
            />
          </View>
          {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
        </View>

        <TouchableOpacity onPress={handleSave} disabled={isSaving} activeOpacity={0.8}>
          <LinearGradient colors={[theme.colors.primary, '#3B82F6']} style={styles.modalBtnGradient}>
            {isSaving ? (
              <ActivityIndicator color={theme.colors.white} />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color={theme.colors.white} />
                <Text style={styles.modalBtnSaveText}>Enregistrer</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </AppBottomSheet>
  );
}
