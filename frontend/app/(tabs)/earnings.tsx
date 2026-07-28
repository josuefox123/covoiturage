/**
 * ==============================================================
 * Fichier :
 * earnings.tsx
 *
 * Description :
 * Onglet Revenus -- design fintech inspire banking UI.
 *
 * Projet :
 * Zemy
 * ==============================================================
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/context/AuthContext";

const { width } = Dimensions.get("window");

const PRIMARY = "#2563EB";
const PRIMARY_DARK = "#1D4ED8";
const ACCENT = "#FFAA00";
const BG_BLUE = "#D6E8FF";
const SUCCESS = "#10B981";

interface Payout {
  id: string;
  status: "pending" | "processing" | "paid" | "failed";
  phone_number: string;
  requested_at: string;
  paid_at: string | null;
}

interface EarningItem {
  ride_id: string;
  departure_location: string;
  arrival_location: string;
  departure_date: string;
  confirmed_passengers: number;
  amount_due: number;
  payout: Payout | null;
}

interface Summary {
  total_earned: number;
  total_claimable: number;
  total_paid_out: number;
}

const STATUS_CFG: Record<string, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  pending:    { label: "En attente", color: "#F59E0B", icon: "time-outline" },
  processing: { label: "En cours",   color: PRIMARY,   icon: "sync-outline" },
  paid:       { label: "Verse",      color: SUCCESS,   icon: "checkmark-circle" },
  failed:     { label: "Echoue",     color: "#EF4444", icon: "close-circle-outline" },
};

export default function EarningsScreen() {
  const { authFetch } = useAuth();
  const [earnings, setEarnings] = useState<EarningItem[]>([]);
  const [summary, setSummary] = useState<Summary>({ total_earned: 0, total_claimable: 0, total_paid_out: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"all" | "claimable" | "paid">("all");

  const [showModal, setShowModal] = useState(false);
  const [selectedRide, setSelectedRide] = useState<EarningItem | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [claiming, setClaiming] = useState(false);

  const fetchEarnings = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const data = await authFetch("/driver/earnings/");
      setEarnings(data.earnings || []);
      setSummary(data.summary || { total_earned: 0, total_claimable: 0, total_paid_out: 0 });
    } catch (e: any) {
      Alert.alert("Erreur", e?.message || "Impossible de charger vos revenus.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authFetch]);

  useEffect(() => { fetchEarnings(); }, [fetchEarnings]);

  const openClaimModal = (item: EarningItem) => {
    setSelectedRide(item);
    setPhoneNumber("");
    setShowModal(true);
  };

  const handleClaim = async () => {
    const phone = phoneNumber.replace(/\s/g, "");
    if (phone.length < 8) {
      Alert.alert("Numero invalide", "Veuillez entrer un numero Mobile Money valide.");
      return;
    }
    setClaiming(true);
    try {
      await authFetch("/driver/claim/", {
        method: "POST",
        body: JSON.stringify({ ride_id: selectedRide?.ride_id, phone_number: phone }),
      });
      setShowModal(false);
      Alert.alert(
        "Demande envoyee !",
        `Votre demande de ${selectedRide?.amount_due.toLocaleString("fr-FR")} FCFA sera traitee sous 24h.`,
        [{ text: "OK", onPress: () => fetchEarnings(true) }]
      );
    } catch (e: any) {
      Alert.alert("Erreur", e?.message || "Une erreur est survenue.");
    } finally {
      setClaiming(false);
    }
  };

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
    } catch { return d; }
  };

  const filteredEarnings = earnings.filter(item => {
    if (filter === "claimable") return !item.payout;
    if (filter === "paid") return item.payout?.status === "paid";
    return true;
  });

  const renderTransaction = ({ item }: { item: EarningItem }) => {
    const hasPayout = !!item.payout;
    const cfg = item.payout ? STATUS_CFG[item.payout.status] : null;
    const isClaimable = !hasPayout;

    return (
      <TouchableOpacity
        style={styles.txRow}
        activeOpacity={isClaimable ? 0.7 : 1}
        onPress={() => isClaimable && openClaimModal(item)}
      >
        {/* Icon carré */}
        <View style={[styles.txIcon, { backgroundColor: isClaimable ? "#EFF6FF" : (cfg ? cfg.color + "18" : "#F3F4F6") }]}>
          <Ionicons
            name={hasPayout ? (cfg?.icon ?? "card-outline") : "car-outline"}
            size={20}
            color={isClaimable ? PRIMARY : (cfg?.color ?? "#9CA3AF")}
          />
        </View>

        {/* Infos */}
        <View style={styles.txInfo}>
          <Text style={styles.txTitle} numberOfLines={1}>
            {item.departure_location} -- {item.arrival_location}
          </Text>
          <Text style={styles.txDate}>
            {formatDate(item.departure_date)}
            {hasPayout && cfg ? `  ·  ${cfg.label}` : "  ·  Appuyer pour reclamer"}
          </Text>
        </View>

        {/* Montant */}
        <View style={styles.txAmount}>
          <Text style={[styles.txAmountText, { color: hasPayout && item.payout?.status === "paid" ? SUCCESS : PRIMARY }]}>
            +{item.amount_due.toLocaleString("fr-FR")} F
          </Text>
          {isClaimable && (
            <View style={styles.claimDot} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>

      {/* ====== HEADER BLEU PASTEL ====== */}
      <View style={styles.heroSection}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <View style={styles.pills}>
            {(["all", "claimable", "paid"] as const).map(f => (
              <TouchableOpacity
                key={f}
                style={[styles.pill, filter === f && styles.pillActive]}
                onPress={() => setFilter(f)}
                activeOpacity={0.8}
              >
                <Text style={[styles.pillText, filter === f && styles.pillTextActive]}>
                  {f === "all" ? "Tous" : f === "claimable" ? "A reclamer" : "Verses"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.settingsBtn} onPress={() => fetchEarnings(true)} activeOpacity={0.7}>
            <Ionicons name="refresh" size={20} color={PRIMARY_DARK} />
          </TouchableOpacity>
        </View>

        {/* Solde */}
        <Text style={styles.balanceLabel}>Total gagné</Text>
        <Text style={styles.balanceValue}>
          {loading ? "---" : summary.total_earned.toLocaleString("fr-FR")} FCFA
        </Text>
      </View>

      {/* ====== CONTENU ====== */}
      <View style={styles.content}>
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={PRIMARY} />
            <Text style={styles.loadingText}>Chargement de vos revenus...</Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} refreshing={refreshing}
            onScrollBeginDrag={() => {}} contentContainerStyle={{ paddingBottom: 40 }}>

            {/* Carte transactions */}
            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.cardTitle}>Mes dernieres courses</Text>
                <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
              </View>

              {filteredEarnings.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Ionicons name="car-outline" size={36} color="#D1D5DB" />
                  <Text style={styles.emptyText}>Aucun trajet pour ce filtre.</Text>
                </View>
              ) : (
                filteredEarnings.map((item, i) => (
                  <View key={item.ride_id}>
                    {renderTransaction({ item })}
                    {i < filteredEarnings.length - 1 && <View style={styles.txSeparator} />}
                  </View>
                ))
              )}
            </View>

            {/* Carte statistiques */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Votre solde</Text>
              <View style={styles.statsRow}>
                <View style={styles.statsItem}>
                  <Text style={styles.statsLabel}>A reclamer</Text>
                  <Text style={[styles.statsValue, { color: ACCENT }]}>
                    {summary.total_claimable.toLocaleString("fr-FR")}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.arrowCircle}
                  onPress={() => {
                    const claimable = earnings.find(e => !e.payout);
                    if (claimable) openClaimModal(claimable);
                    else Alert.alert("Aucun trajet", "Aucune course a reclamer pour l instant.");
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="arrow-forward" size={20} color="white" />
                </TouchableOpacity>
                <View style={styles.statsItem}>
                  <Text style={styles.statsLabel}>Deja verse</Text>
                  <Text style={[styles.statsValue, { color: SUCCESS }]}>
                    {summary.total_paid_out.toLocaleString("fr-FR")}
                  </Text>
                </View>
              </View>
            </View>

          </ScrollView>
        )}
      </View>

      {/* ====== MODAL ====== */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setShowModal(false)} />
          <View style={styles.modalSheet}>

            {/* Handle */}
            <View style={styles.handle} />

            <Text style={styles.modalTitle}>Reclamer votre gain</Text>
            {selectedRide && (
              <Text style={styles.modalAmount}>
                {selectedRide.amount_due.toLocaleString("fr-FR")} FCFA
              </Text>
            )}
            {selectedRide && (
              <Text style={styles.modalRoute}>
                {selectedRide.departure_location} -- {selectedRide.arrival_location}
              </Text>
            )}

            <Text style={styles.inputLabel}>Numero Mobile Money</Text>
            <View style={styles.inputRow}>
              <Ionicons name="phone-portrait-outline" size={20} color="#9CA3AF" />
              <TextInput
                style={styles.input}
                placeholder="Ex: 22961000000"
                placeholderTextColor="#9CA3AF"
                keyboardType="phone-pad"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                maxLength={20}
              />
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="information-circle-outline" size={16} color={PRIMARY} />
              <Text style={styles.infoText}>Le virement sera effectue sous 24h ouvrables.</Text>
            </View>

            <TouchableOpacity
              style={[styles.sendBtn, (!phoneNumber.replace(/\s/g, "") || claiming) && { opacity: 0.5 }]}
              onPress={handleClaim}
              disabled={!phoneNumber.replace(/\s/g, "") || claiming}
              activeOpacity={0.8}
            >
              {claiming ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.sendBtnText}>Envoyer la demande</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowModal(false)}>
              <Text style={styles.cancelText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG_BLUE },

  // ---- HERO ----
  heroSection: {
    backgroundColor: BG_BLUE,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 32,
  },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 24 },
  pills: { flexDirection: "row", backgroundColor: "rgba(255,255,255,0.5)", borderRadius: 20, padding: 3, gap: 2 },
  pill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 17 },
  pillActive: { backgroundColor: PRIMARY_DARK },
  pillText: { fontSize: 13, fontWeight: "600", color: PRIMARY_DARK },
  pillTextActive: { color: "white" },
  settingsBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.6)",
    justifyContent: "center", alignItems: "center",
  },
  balanceLabel: { fontSize: 14, color: PRIMARY_DARK, fontWeight: "500", marginBottom: 4 },
  balanceValue: { fontSize: 36, fontWeight: "800", color: "#0F172A", letterSpacing: -1 },

  // ---- CONTENT ----
  content: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -8,
    paddingTop: 8,
  },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, paddingTop: 80 },
  loadingText: { color: "#6B7280", fontSize: 14 },

  // ---- CARD ----
  card: {
    backgroundColor: "white",
    borderRadius: 20,
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 18,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },

  // ---- TRANSACTIONS ----
  txRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  txIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  txInfo: { flex: 1 },
  txTitle: { fontSize: 14, fontWeight: "600", color: "#111827" },
  txDate: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },
  txAmount: { alignItems: "flex-end", gap: 4 },
  txAmountText: { fontSize: 15, fontWeight: "700" },
  claimDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: ACCENT },
  txSeparator: { height: 1, backgroundColor: "#F3F4F6", marginVertical: 2 },

  emptyBox: { alignItems: "center", paddingVertical: 24, gap: 8 },
  emptyText: { fontSize: 13, color: "#9CA3AF" },

  // ---- STATS ----
  statsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16 },
  statsItem: { alignItems: "center", flex: 1 },
  statsLabel: { fontSize: 12, color: "#9CA3AF", marginBottom: 4 },
  statsValue: { fontSize: 20, fontWeight: "800" },
  arrowCircle: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: PRIMARY,
    justifyContent: "center", alignItems: "center",
    shadowColor: PRIMARY,
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },

  // ---- MODAL ----
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: "white",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 36,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#E5E7EB", alignSelf: "center", marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: "800", color: "#111827", marginBottom: 6 },
  modalAmount: { fontSize: 32, fontWeight: "900", color: PRIMARY, marginBottom: 4 },
  modalRoute: { fontSize: 13, color: "#6B7280", marginBottom: 24 },
  inputLabel: { fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 8 },
  inputRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderWidth: 1.5, borderColor: "#E5E7EB",
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14,
    backgroundColor: "#F9FAFB", marginBottom: 12,
  },
  input: { flex: 1, fontSize: 16, color: "#111827", fontWeight: "500" },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 24 },
  infoText: { flex: 1, fontSize: 12, color: PRIMARY },
  sendBtn: {
    backgroundColor: PRIMARY, paddingVertical: 16, borderRadius: 14,
    alignItems: "center", justifyContent: "center", marginBottom: 10,
  },
  sendBtnText: { color: "white", fontWeight: "700", fontSize: 16 },
  cancelBtn: { alignItems: "center", paddingVertical: 10 },
  cancelText: { color: "#9CA3AF", fontSize: 14 },
});
