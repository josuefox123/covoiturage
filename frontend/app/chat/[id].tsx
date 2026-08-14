/**
 * ==============================================================
 * Fichier :
 * [id].tsx
 *
 * Description :
 * Composant ou logique de l'application Zemy.
 *
 * Projet :
 * Zemy
 * ==============================================================
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, FlatList, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator,
  Image, Linking, Modal
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { theme } from '../../src/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { WebSocketService, buildWsUrl, WSMessage } from '../../src/services/websocketService';
import { API_URL } from '../../src/services/api';
import { getMediaUrl } from '../../src/utils/media';

/**
 * Composant ChatScreen.
 *
 * Responsabilités :
 * - Affichage et gestion de l'état lié à ChatScreen.
 */
export default function ChatScreen() {
  const { id, show_proposal } = useLocalSearchParams<{ id: string; show_proposal?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, token, authFetch } = useAuth();

  const flatListRef = useRef<FlatList>(null);
  const wsRef = useRef<WebSocketService | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [conversation, setConversation] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [showWarning, setShowWarning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [sending, setSending] = useState(false);

  // Modale de proposition (Prise domicile / Dépose personnalisée)
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [proposalType, setProposalType] = useState<'none' | 'pickup' | 'dropoff'>('none');
  const [proposalPrice, setProposalPrice] = useState('');
  const [customAddress, setCustomAddress] = useState('');

  // Ouverture automatique de la modale après paiement
  useEffect(() => {
    if (show_proposal === 'true') {
      setShowProposalModal(true);
    }
  }, [show_proposal]);

  // Numéro de téléphone regex Bénin
  const PHONE_REGEX = /(\+229|00229)?\s?\d{2}\s?\d{2}\s?\d{2}\s?\d{2}/g;

  // ── Chargement initial des données (REST) ─────────────────────────────
  const fetchChatData = useCallback(async () => {
    try {
      setLoading(true);
      const convData = await authFetch(`/conversations/${id}/`);
      setConversation(convData);

      // Charger l'historique des messages via REST (une seule fois)
      const msgsData = await authFetch(`/messages/?conversation=${id}`);
      const msgsList = Array.isArray(msgsData) ? msgsData : (msgsData?.results || []);
      const sorted = [...msgsList].sort(
        (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      setMessages(sorted);

      // Marquer comme lus
      await authFetch(`/messages/${id}/mark-read/`, { method: 'POST' }).catch(() => {});
    } catch (error) {
      console.error('Erreur chargement conversation:', error);
    } finally {
      setLoading(false);
    }
  }, [id, authFetch]);

  // ── Connexion WebSocket ───────────────────────────────────────────────
  useEffect(() => {
    if (!id || !token) return;

    // Charger les données puis connecter le WebSocket
    fetchChatData().then(() => {
      const wsUrl = buildWsUrl(API_URL, id);
      const ws = new WebSocketService(wsUrl, token);
      wsRef.current = ws;

      ws.onOpen = () => {
        setWsConnected(true);
      };

      ws.onClose = () => {
        setWsConnected(false);
      };

      ws.onError = () => {
        setWsConnected(false);
        console.warn('[Chat] WebSocket erreur');
      };

      ws.onReconnecting = (attempt) => {
      };

      ws.onMessage = (msg: WSMessage) => {
        if (msg.type === 'message' && msg.message) {
          // Ajouter le nouveau message en temps réel
          setMessages(prev => {
            // Éviter les doublons (si le message existe déjà, ne pas l'ajouter)
            if (prev.some(m => m.id === msg.message!.id)) return prev;
            return [...prev, msg.message!];
          });
          // Scroller vers le bas
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
          // Marquer comme lu (on est dans la conversation)
          ws.sendReadReceipt();
        } else if (msg.type === 'typing') {
          if (msg.user_id !== user?.id) {
            setPartnerTyping(msg.is_typing ?? false);
            // Auto-effacer l'indicateur après 3 secondes
            if (msg.is_typing) {
              setTimeout(() => setPartnerTyping(false), 3000);
            }
          }
        } else if (msg.type === 'read') {
          // Mise à jour des indicateurs de lecture si nécessaire
        }
      };

      ws.connect();
    });

    return () => {
      // Nettoyage : déconnecter le WebSocket
      wsRef.current?.disconnect();
      wsRef.current = null;
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [id, token]);

  // ── Polling de repli (HTTP REST) si le WebSocket est déconnecté ─────────
  useEffect(() => {
    if (!id || wsConnected) return;

    const interval = setInterval(async () => {
      try {
        const msgsData = await authFetch(`/messages/?conversation=${id}`);
        const msgsList = Array.isArray(msgsData) ? msgsData : (msgsData?.results || []);
        const sorted = [...msgsList].sort(
          (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        
        setMessages(prev => {
          if (sorted.length !== prev.length || sorted.some((m, idx) => !prev[idx] || prev[idx].id !== m.id)) {
            // Marquer comme lus car l'utilisateur est actif sur l'écran
            authFetch(`/messages/${id}/mark-read/`, { method: 'POST' }).catch(() => {});
            // Scroller vers le bas si un nouveau message arrive
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
            return sorted;
          }
          return prev;
        });
      } catch (error) {
        console.error('[Chat] Erreur lors du polling de messages:', error);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [id, wsConnected, authFetch]);

  // ── Gestion de l'input ────────────────────────────────────────────────
  const handleInputChange = (text: string) => {
    setInputText(text);
    PHONE_REGEX.lastIndex = 0;
    setShowWarning(PHONE_REGEX.test(text));

    // Envoyer l'indicateur "en train d'écrire"
    if (wsRef.current?.isConnected) {
      wsRef.current.sendTyping(true);
      // Stopper l'indicateur après 2 secondes d'inactivité
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        wsRef.current?.sendTyping(false);
      }, 2000);
    }
  };

  // ── Envoi d'un message ────────────────────────────────────────────────
  const handleSend = async () => {
    if (!inputText.trim()) return;

    PHONE_REGEX.lastIndex = 0;
    if (PHONE_REGEX.test(inputText)) {
      setShowWarning(true);
      return;
    }

    const content = inputText.trim();
    setInputText('');
    setShowWarning(false);

    // Arrêter l'indicateur de frappe
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    wsRef.current?.sendTyping(false);

    if (wsRef.current?.isConnected) {
      // Envoi via WebSocket (temps réel)
      wsRef.current.sendMessage(content);
    } else {
      // Fallback REST si WebSocket déconnecté
      setSending(true);
      try {
        const newMsg = await authFetch('/messages/', {
          method: 'POST',
          body: JSON.stringify({ conversation: id, content }),
        });
        setMessages(prev => [...prev, newMsg]);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 300);
      } catch (error) {
        console.error('[Chat] Erreur envoi REST:', error);
        setInputText(content); // Restaurer le message en cas d'erreur
      } finally {
        setSending(false);
      }
    }
  };

  // Envoi d'une proposition spéciale (prise à domicile / dépose personnalisée)
  const sendSystemProposal = async (type: 'pickup' | 'dropoff', address: string, price: string) => {
    if (!address.trim()) {
      alert("Veuillez renseigner l'adresse.");
      return;
    }
    const additionalPrice = parseInt(price.replace(/\D/g, '')) || 0;
    if (additionalPrice <= 0) {
      alert("Veuillez proposer un montant valide.");
      return;
    }

    const typeLabel = type === 'pickup' 
      ? '🤝 [PROPOSITION DE PRISE À DOMICILE]' 
      : '🤝 [PROPOSITION DE DÉPOSE PERSONNALISÉE]';
    
    const formattedContent = `${typeLabel}\n📍 Adresse : ${address.trim()}\n💵 Supplément proposé : +${additionalPrice.toLocaleString()} FCFA`;

    if (wsRef.current?.isConnected) {
      // Envoi direct via WebSocket
      wsRef.current.sendMessage(formattedContent);
    } else {
      // Envoi via API REST si déconnecté
      setSending(true);
      try {
        const newMsg = await authFetch('/messages/', {
          method: 'POST',
          body: JSON.stringify({ conversation: id, content: formattedContent }),
        });
        setMessages(prev => [...prev, newMsg]);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 300);
      } catch (error) {
        console.error('[Chat] Erreur envoi proposition:', error);
        alert("Impossible d'envoyer la proposition. Veuillez réessayer.");
      } finally {
        setSending(false);
      }
    }
    
    // Fermer et réinitialiser
    setShowProposalModal(false);
    setProposalType('none');
    setProposalPrice('');
    setCustomAddress('');
  };

  // ── Rendu des messages ────────────────────────────────────────────────
  const isSystemMessage = (item: any) => item.content?.startsWith('Bienvenue dans votre espace') || item.content?.startsWith('🤝');

  const otherUser = conversation?.participant_1_details?.id === user?.id
    ? conversation?.participant_2_details
    : conversation?.participant_1_details;
  const partnerName = otherUser?.full_name || 'Utilisateur';
  const partnerInitials = partnerName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
  const rideInfo = conversation?.ride_details || null;
  const isPassenger = conversation?.ride_details?.driver !== user?.id && conversation?.ride_details?.driver_details?.id !== user?.id;

  const renderMessage = useCallback(({ item }: { item: any }) => {
    if (isSystemMessage(item)) {
      return (
        <View style={styles.systemMsgContainer}>
          <View style={styles.systemMsgBubble}>
            <Text style={styles.systemMsgText}>{item.content}</Text>
          </View>
        </View>
      );
    }

    const isMe = item.sender === user?.id || item.sender_details?.id === user?.id;
    const time = new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
      <View style={[styles.messageRow, isMe ? styles.myRow : styles.otherRow]}>
        {!isMe && (
          <View style={styles.avatarMini}>
            <Text style={styles.avatarMiniText}>{partnerInitials}</Text>
          </View>
        )}
        <View style={[styles.bubble, isMe ? styles.myBubble : styles.otherBubble]}>
          <Text style={[styles.messageText, isMe ? styles.myText : styles.otherText]}>{item.content}</Text>
          <View style={styles.messageMeta}>
            <Text style={[styles.timeText, isMe ? styles.myTime : styles.otherTime]}>{time}</Text>
            {isMe && item.is_read && (
              <Ionicons name="checkmark-done" size={12} color="rgba(255,255,255,0.8)" />
            )}
          </View>
        </View>
      </View>
    );
  }, [user, partnerInitials]);

  if (loading || !conversation) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }


  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>

        <View style={styles.headerUser}>
          <View style={{ position: 'relative' }}>
            {otherUser?.avatar ? (
              <Image source={{ uri: getMediaUrl(otherUser.avatar) }} style={styles.avatarMiniImage} />
            ) : (
              <View style={styles.avatarMini}>
                <Text style={styles.avatarMiniText}>{partnerInitials}</Text>
              </View>
            )}
            <View style={[
              styles.onlineMiniDot,
              { backgroundColor: otherUser?.is_online ? '#22C55E' : '#9CA3AF' }
            ]} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerName} numberOfLines={1}>{partnerName}</Text>
            {(conversation?.booking_details || rideInfo) && (
              <Text style={styles.rideInfoText} numberOfLines={1}>
                {conversation?.booking_details
                  ? `${conversation.booking_details.departure_location?.split(',')[0]} → ${conversation.booking_details.arrival_location?.split(',')[0]}`
                  : `${rideInfo.departure_location?.split(',')[0]} → ${rideInfo.arrival_location?.split(',')[0]}`}
                {` • ${otherUser?.is_online ? 'En ligne' : 'Hors ligne'}`}
              </Text>
            )}
          </View>
        </View>

        {otherUser?.phone && (
          <TouchableOpacity 
            style={[
              styles.callButton,
              ['cancelled', 'rejected', 'expired', 'payment_failed'].includes(conversation?.booking_details?.status) && styles.disabledCallButton
            ]} 
            onPress={() => {
              if (!['cancelled', 'rejected', 'expired', 'payment_failed'].includes(conversation?.booking_details?.status)) {
                Linking.openURL(`tel:${otherUser.phone}`);
              }
            }}
            disabled={['cancelled', 'rejected', 'expired', 'payment_failed'].includes(conversation?.booking_details?.status)}
            activeOpacity={0.7}
          >
            <Ionicons 
              name="call" 
              size={18} 
              color={
                ['cancelled', 'rejected', 'expired', 'payment_failed'].includes(conversation?.booking_details?.status)
                  ? '#94A3B8'
                  : theme.colors.primary
              } 
            />
          </TouchableOpacity>
        )}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
        style={{ flex: 1 }}
      >
        {/* Bannière anti-numéro */}
        {showWarning && (
          <View style={styles.warningBanner}>
            <Ionicons name="warning" size={18} color={theme.colors.warningDark} />
            <Text style={styles.warningText}>
              Sécurité : Ne partagez pas de numéro de téléphone. Ce message sera bloqué.
            </Text>
          </View>
        )}

        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Ionicons name="chatbubbles-outline" size={40} color={theme.colors.textMuted} />
              <Text style={styles.emptyChatText}>Aucun message pour l'instant.</Text>
              <Text style={styles.emptyChatSub}>Commencez la discussion !</Text>
            </View>
          }
          ListFooterComponent={
            partnerTyping ? (
              <View style={styles.typingContainer}>
                <View style={styles.avatarMini}>
                  <Text style={styles.avatarMiniText}>{partnerInitials}</Text>
                </View>
                <View style={styles.typingBubble}>
                  <Text style={styles.typingDots}>···</Text>
                </View>
              </View>
            ) : null
          }
        />

        {/* Blocage du chat et infos de remboursement si la réservation est annulée */}
        {['cancelled', 'rejected', 'expired', 'payment_failed'].includes(conversation?.booking_details?.status) ? (
          <View style={[styles.blockedContainer, { paddingBottom: Math.max(theme.spacing.md, insets.bottom) }]}>
            <View style={styles.blockedHeader}>
              <Ionicons name="lock-closed" size={18} color="#EF4444" />
              <Text style={styles.blockedTitle}>Discussion fermée</Text>
            </View>
            <Text style={styles.blockedText}>
              Cette discussion est bloquée car la réservation associée a été annulée ou a expiré.
            </Text>
            
            {isPassenger && (
              <View style={styles.refundContainer}>
                <Text style={styles.refundTitle}>ℹ️ Conditions & Demande de remboursement</Text>
                <Text style={styles.refundText}>
                  Si vous avez déjà payé en ligne pour ce trajet, vous pouvez demander son remboursement intégral. 
                  Rendez-vous dans votre historique de paiement pour soumettre votre demande qui sera confirmée par l'administrateur.
                </Text>
                <TouchableOpacity 
                  style={styles.refundBtn} 
                  onPress={() => router.push('/payment-history')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="card-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.refundBtnText}>Demander un remboursement</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : (
          /* Input Bar standard */
          <View style={[styles.inputContainer, { paddingBottom: Math.max(theme.spacing.md, insets.bottom) }]}>
            {isPassenger && (
              <TouchableOpacity
                style={styles.attachButton}
                onPress={() => setShowProposalModal(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="add-circle" size={26} color={theme.colors.primary} />
              </TouchableOpacity>
            )}
            <TextInput
              style={styles.textInput}
              placeholder="Écrivez votre message..."
              placeholderTextColor={theme.colors.textMuted}
              value={inputText}
              onChangeText={handleInputChange}
              multiline
            />
            <TouchableOpacity
              style={[styles.sendButton, (!inputText.trim() || sending) && styles.disabledSend]}
              onPress={handleSend}
              disabled={!inputText.trim() || sending}
              activeOpacity={0.8}
            >
              {sending ? (
                <ActivityIndicator size="small" color={theme.colors.white} />
              ) : (
                <Ionicons name="send" size={18} color={theme.colors.white} />
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Modal de proposition de trajet personnalisé (Prise domicile / Dépose personnalisée) */}
      <Modal
        visible={showProposalModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowProposalModal(false);
          setProposalType('none');
          setProposalPrice('');
          setCustomAddress('');
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {proposalType === 'none' 
                  ? 'Personnaliser mon trajet' 
                  : proposalType === 'pickup' 
                    ? 'Prise à domicile' 
                    : 'Dépose personnalisée'}
              </Text>
              <TouchableOpacity onPress={() => {
                setShowProposalModal(false);
                setProposalType('none');
                setProposalPrice('');
                setCustomAddress('');
              }}>
                <Ionicons name="close" size={24} color="#1F2937" />
              </TouchableOpacity>
            </View>

            {proposalType === 'none' ? (
              <View style={{ gap: 16, paddingVertical: 10 }}>
                <Text style={{ fontSize: 14, color: '#6B7280', marginBottom: 8, lineHeight: 20 }}>
                  Souhaitez-vous que le conducteur passe vous chercher chez vous ou vous déposer à une adresse précise ?
                </Text>

                <TouchableOpacity 
                  style={styles.proposalCard}
                  onPress={() => setProposalType('pickup')}
                  activeOpacity={0.7}
                >
                  <View style={styles.proposalCardIconBg}>
                    <Ionicons name="home" size={24} color={theme.colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.proposalCardTitle}>Prise à domicile</Text>
                    <Text style={styles.proposalCardDesc}>Proposer au conducteur de passer vous prendre chez vous</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.proposalCard}
                  onPress={() => setProposalType('dropoff')}
                  activeOpacity={0.7}
                >
                  <View style={[styles.proposalCardIconBg, { backgroundColor: '#FEE2E2' }]}>
                    <Ionicons name="location" size={24} color="#EF4444" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.proposalCardTitle}>Dépose personnalisée</Text>
                    <Text style={styles.proposalCardDesc}>Proposer au conducteur de vous déposer à une autre adresse</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.modalCancelBtn, { marginTop: 12 }]}
                  onPress={() => setShowProposalModal(false)}
                >
                  <Text style={styles.modalCancelBtnText}>Annuler</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ gap: 16, paddingVertical: 10 }}>
                {/* Back button */}
                <TouchableOpacity 
                  onPress={() => {
                    setProposalType('none');
                    setProposalPrice('');
                    setCustomAddress('');
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}
                >
                  <Ionicons name="arrow-back" size={16} color={theme.colors.primary} />
                  <Text style={{ fontSize: 13, color: theme.colors.primary, fontWeight: '600' }}>Retour aux choix</Text>
                </TouchableOpacity>

                <Text style={{ fontSize: 13, color: '#6B7280', lineHeight: 18 }}>
                  {proposalType === 'pickup'
                    ? "Saisissez l'adresse de votre domicile ou lieu de départ souhaité et proposez un dédommagement financier."
                    : "Saisissez l'adresse finale où vous souhaitez être déposé et proposez un dédommagement financier."}
                </Text>

                {/* Champ Adresse */}
                <View>
                  <Text style={styles.inputLabel}>Adresse exacte souhaitée</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder={proposalType === 'pickup' ? "Ex: Villa 14, quartier Houenoussou..." : "Ex: Devant le Supermarché Erevan..."}
                    placeholderTextColor="#9CA3AF"
                    value={customAddress}
                    onChangeText={setCustomAddress}
                  />
                </View>

                {/* Champ Prix */}
                <View>
                  <Text style={styles.inputLabel}>Supplément financier proposé (FCFA)</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Ex: 1500 FCFA"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                    value={proposalPrice}
                    onChangeText={(val) => setProposalPrice(val.replace(/\D/g, ''))}
                  />
                </View>

                <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                  <TouchableOpacity 
                    style={[styles.modalCancelBtn, { flex: 1 }]}
                    onPress={() => {
                      setProposalType('none');
                      setProposalPrice('');
                      setCustomAddress('');
                    }}
                  >
                    <Text style={styles.modalCancelBtnText}>Précédent</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.modalSubmitBtn, { flex: 2 }]}
                    onPress={() => sendSystemProposal(proposalType, customAddress, proposalPrice)}
                  >
                    <Text style={styles.modalSubmitBtnText}>Envoyer</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.card, borderBottomWidth: 1,
    borderBottomColor: theme.colors.border, ...theme.shadows.sm, gap: theme.spacing.sm
  },
  backButton: { width: 36, height: 36, justifyContent: 'center', alignItems: 'flex-start' },
  headerUser: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  headerName: { ...theme.typography.bodyLarge, fontWeight: '700', color: theme.colors.text },
  rideInfoText: { fontSize: 11, color: theme.colors.textMuted, marginTop: 1 },
  // WS indicator
  wsIndicator: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, borderWidth: 1,
  },
  wsConnected: { backgroundColor: '#f0fdf4', borderColor: '#86efac' },
  wsDisconnected: { backgroundColor: '#fef2f2', borderColor: '#fca5a5' },
  wsDot: { width: 6, height: 6, borderRadius: 3 },
  wsDotConnected: { backgroundColor: '#22c55e' },
  wsDotDisconnected: { backgroundColor: '#ef4444' },
  wsText: { fontSize: 10, fontWeight: '600' },
  wsTextConnected: { color: '#16a34a' },
  wsTextDisconnected: { color: '#dc2626' },
  // Warning
  warningBanner: {
    backgroundColor: theme.colors.warningLight, borderBottomWidth: 1,
    borderBottomColor: theme.colors.warning, flexDirection: 'row',
    alignItems: 'center', padding: theme.spacing.sm, gap: 6
  },
  warningText: { fontSize: 11, color: theme.colors.warningDark, fontWeight: '600', flex: 1 },
  // Messages
  messagesList: { padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: 16 },
  systemMsgContainer: { alignItems: 'center', marginVertical: theme.spacing.md },
  systemMsgBubble: {
    backgroundColor: theme.colors.primaryLight, borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md, maxWidth: '90%', borderWidth: 1,
    borderColor: theme.colors.primaryLight
  },
  systemMsgText: { fontSize: 13, color: theme.colors.primaryDark, lineHeight: 20, textAlign: 'left' },
  messageRow: {
    flexDirection: 'row', alignItems: 'flex-end',
    gap: theme.spacing.sm, maxWidth: '80%'
  },
  myRow: { alignSelf: 'flex-end' },
  otherRow: { alignSelf: 'flex-start' },
  avatarMini: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: theme.colors.secondaryLight,
    justifyContent: 'center', alignItems: 'center'
  },
  avatarMiniText: { color: theme.colors.secondaryDark, fontWeight: '700', fontSize: 12 },
  avatarMiniImage: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  onlineMiniDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22C55E', // success green
    borderWidth: 1.5,
    borderColor: theme.colors.card,
  },
  callButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  disabledCallButton: {
    backgroundColor: '#F1F5F9',
  },
  bubble: {
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10, ...theme.shadows.sm
  },
  myBubble: { backgroundColor: theme.colors.primary, borderBottomRightRadius: 2 },
  otherBubble: { backgroundColor: theme.colors.card, borderBottomLeftRadius: 2 },
  messageText: { ...theme.typography.bodyMedium },
  myText: { color: theme.colors.white },
  otherText: { color: theme.colors.text },
  messageMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 3, marginTop: 4 },
  timeText: { fontSize: 9 },
  myTime: { color: 'rgba(255, 255, 255, 0.7)' },
  otherTime: { color: theme.colors.textMuted },
  // Typing indicator
  typingContainer: {
    flexDirection: 'row', alignItems: 'flex-end',
    gap: theme.spacing.sm, paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.sm
  },
  typingBubble: {
    backgroundColor: theme.colors.card, borderRadius: theme.borderRadius.lg,
    paddingHorizontal: 16, paddingVertical: 12, borderBottomLeftRadius: 2,
    ...theme.shadows.sm
  },
  typingDots: { fontSize: 20, color: theme.colors.textMuted, letterSpacing: 2 },
  // Empty
  emptyChat: { alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 8 },
  emptyChatText: { ...theme.typography.bodyLarge, color: theme.colors.text, fontWeight: '600' },
  emptyChatSub: { ...theme.typography.bodyMedium, color: theme.colors.textMuted },
  // Input
  inputContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.colors.card, padding: theme.spacing.md,
    borderTopWidth: 1, borderTopColor: theme.colors.border, gap: theme.spacing.sm
  },
  textInput: {
    flex: 1, backgroundColor: theme.colors.background, borderWidth: 1,
    borderColor: theme.colors.border, borderRadius: theme.borderRadius.xl,
    paddingHorizontal: theme.spacing.md, paddingVertical: 10,
    maxHeight: 100, color: theme.colors.text, ...theme.typography.bodyMedium
  },
  sendButton: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center', alignItems: 'center', ...theme.shadows.sm
  },
  disabledSend: { backgroundColor: theme.colors.border, shadowOpacity: 0, elevation: 0 },
  // Styles pour la modale de proposition personnalisée
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    minHeight: 380,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  proposalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 16,
  },
  proposalCardIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  proposalCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  proposalCardDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0F172A',
  },
  modalCancelBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  modalSubmitBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#2F80ED',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSubmitBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  attachButton: {
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Styles pour l'affichage de chat bloqué et remboursement
  blockedContainer: {
    backgroundColor: '#FFF1F2',
    borderTopWidth: 1,
    borderTopColor: '#FEE2E2',
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  blockedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  blockedTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#EF4444',
  },
  blockedText: {
    fontSize: 13,
    color: '#991B1B',
    lineHeight: 18,
  },
  refundContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FFE4E6',
    marginTop: 8,
    gap: 8,
    ...theme.shadows.sm,
  },
  refundTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  refundText: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
  },
  refundBtn: {
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 4,
  },
  refundBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
