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
import React, { useState, useCallback, useRef } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/context/AuthContext";

// ---------------------------------------------------------------
// Color Palette (Emerald Theme matching backend update)
// ---------------------------------------------------------------
const PRIMARY = "#10B981"; // Vert Zemy
const PRIMARY_DARK = "#059669";
const PRIMARY_LIGHT = "#D1FAE5";
const ACCENT = "#F59E0B";
const SUCCESS = "#10B981";
const DANGER = "#EF4444";
const BLUE = "#3B82F6";
const BACKGROUND = "#F0FDF4";
const CARD = "#FFFFFF";
const TEXT = "#111827";
const MUTED = "#6B7280";
const BORDER = "#E5E7EB";

const OPERATORS = [
  { key: "mtn", label: "MTN Mobile Money", color: "#F59E0B" },
  { key: "moov", label: "Moov Money", color: "#3B82F6" },
  { key: "celtiis", label: "Celtiis Cash", color: "#8B5CF6" },
];

interface PayoutItem {
  payout_id: string;
  reference: string | null;
  amount: number;
  status: "pending" | "processing" | "paid" | "failed" | "cancelled";
  operator: string;
  phone_number: string;
  requested_at: string | null;
  paid_at: string | null;
}

interface RideEarning {
  ride_id: string;
  departure_location: string;
  arrival_location: string;
  departure_date: string;
  bookings_count: number;
  gross_amount: number;
  driver_amount: number;
  zemy_commission: number;
  payment_status: string;
  payouts: PayoutItem[];
}

interface Summary {
  gross_amount: number;
  zemy_commission: number;
  driver_amount: number;
  already_paid: number;
  in_processing: number;
  available_balance: number;
}

const STATUS_CFG: Record<string, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  pending:    { label: "En attente", color: ACCENT,   icon: "hourglass-outline" },
  processing: { label: "En cours",   color: BLUE,     icon: "sync-outline" },
  paid:       { label: "Versé",      color: SUCCESS,  icon: "checkmark-circle" },
  failed:     { label: "Échoué",     color: DANGER,   icon: "close-circle-outline" },
  cancelled:  { label: "Annulé",     color: MUTED,    icon: "ban-outline" },
};

export default function EarningsScreen() {
  const { authFetch } = useAuth();
  
  // Data States
  const [history, setHistory] = useState<RideEarning[]>([]);
  const [summary, setSummary] = useState<Summary>({
    gross_amount: 0,
    zemy_commission: 0,
    driver_amount: 0,
    already_paid: 0,
    in_processing: 0,
    available_balance: 0,
  });
  const [payoutAutoEnabled, setPayoutAutoEnabled] = useState(false);

  // UX States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"all" | "available" | "paid">("all");

  // Modal Withdrawal States
  const [showModal, setShowModal] = useState(false);
  const [withdrawStep, setWithdrawStep] = useState<"form" | "confirm" | "loading" | "success">("form");
  const [amount, setAmount] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [operator, setOperator] = useState<"mtn" | "moov" | "celtiis">("mtn");
  const [error, setError] = useState("");
  const [payoutResult, setPayoutResult] = useState<any>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // ---------------------------------------------------------------
  // API Fetch
  // ---------------------------------------------------------------
  const fetchEarnings = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const data = await authFetch("/driver/earnings/");
      setHistory(data.history || []);
      setSummary(data.summary || {
        gross_amount: 0,
        zemy_commission: 0,
        driver_amount: 0,
        already_paid: 0,
        in_processing: 0,
        available_balance: 0,
      });
      setPayoutAutoEnabled(!!data.payout_automatic_enabled);
    } catch (e: any) {
      Alert.alert("Erreur", e?.message || "Impossible de charger vos gains.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authFetch]);

  useFocusEffect(
    useCallback(() => {
      fetchEarnings();
    }, [fetchEarnings])
  );

  // ---------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------
  const handleOpenWithdraw = () => {
    setError("");
    setAmount("");
    setPhoneNumber("");
    setOperator("mtn");
    setWithdrawStep("form");
    setPayoutResult(null);
    setShowModal(true);
  };

  const handleContinueWithdraw = () => {
    setError("");
    const amtNum = parseInt(amount.replace(/\s/g, ""), 10);
    if (!amount || isNaN(amtNum) || amtNum <= 0) {
      setError("Veuillez entrer un montant valide.");
      return;
    }
    if (amtNum > summary.available_balance) {
      setError(`Le montant dépasse votre solde disponible (${summary.available_balance.toLocaleString("fr-FR")} FCFA).`);
      return;
    }
    if (!phoneNumber || phoneNumber.trim().length < 8) {
      setError("Veuillez entrer un numéro Mobile Money valide.");
      return;
    }
    setWithdrawStep("confirm");
  };

  const handleConfirmWithdraw = async () => {
    setWithdrawStep("loading");
    try {
      const amtNum = parseInt(amount.replace(/\s/g, ""), 10);
      const res = await authFetch("/driver/claim/", {
        method: "POST",
        body: JSON.stringify({
          amount: amtNum,
          phone_number: phoneNumber.trim(),
          operator,
        }),
      });
      setPayoutResult(res);
      setWithdrawStep("success");
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    } catch (e: any) {
      setWithdrawStep("form");
      setError(e.message || "Une erreur est survenue. Veuillez réessayer.");
    }
  };

  const handleSuccessFinished = () => {
    setShowModal(false);
    fetchEarnings(true);
  };

  // Helper Formats
  const formatAmount = (amt: number) => amt.toLocaleString("fr-FR") + " FCFA";
  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
    } catch {
      return dateStr;
    }
  };

  // Filters
  const filteredHistory = history.filter(item => {
    if (filter === "available") return item.payment_status === "available" || item.payment_status === "escrow";
    if (filter === "paid") return item.payouts.some(p => p.status === "paid");
    return true;
  });

  const amtNum = parseInt(amount.replace(/\s/g, ""), 10) || 0;
  const selectedOp = OPERATORS.find(o => o.key === operator)!;

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>

      {/* ====== HEADER BANQUE / FINTECH ====== */}
      <View style={styles.heroSection}>
        <View style={styles.topBar}>
          <View style={styles.pills}>
            {(["all", "available", "paid"] as const).map(f => (
              <TouchableOpacity
                key={f}
                style={[styles.pill, filter === f && styles.pillActive]}
                onPress={() => setFilter(f)}
                activeOpacity={0.8}
              >
                <Text style={[styles.pillText, filter === f && styles.pillTextActive]}>
                  {f === "all" ? "Tous" : f === "available" ? "Dispos" : "Versés"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.refreshBtn} onPress={() => fetchEarnings(true)} activeOpacity={0.7}>
            <Ionicons name="refresh" size={20} color={PRIMARY_DARK} />
          </TouchableOpacity>
        </View>

        {/* Solde principal disponible */}
        <Text style={styles.balanceLabel}>Solde disponible</Text>
        <Text style={styles.balanceValue}>
          {loading ? "---" : formatAmount(summary.available_balance)}
        </Text>

        {/* Bouton de retrait */}
        <TouchableOpacity
          style={[styles.withdrawTrigger, summary.available_balance <= 0 && styles.withdrawTriggerDisabled]}
          onPress={() => summary.available_balance > 0 && handleOpenWithdraw()}
          disabled={summary.available_balance <= 0}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-up-circle" size={20} color={summary.available_balance > 0 ? PRIMARY : MUTED} />
          <Text style={[styles.withdrawTriggerText, summary.available_balance <= 0 && { color: MUTED }]}>
            {summary.available_balance > 0 ? "Retirer mes gains" : "Aucun gain disponible"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ====== CONTENU ====== */}
      <View style={styles.content}>
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={PRIMARY} />
            <Text style={styles.loadingText}>Chargement de vos revenus...</Text>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}
          >
            {/* Stat Cards Row */}
            <View style={styles.statsRow}>
              <View style={[styles.statCard, { backgroundColor: "#FFFBEB" }]}>
                <Ionicons name="time-outline" size={16} color={ACCENT} />
                <Text style={styles.statVal}>{formatAmount(summary.in_processing)}</Text>
                <Text style={styles.statLabel}>En attente</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: PRIMARY_LIGHT }]}>
                <Ionicons name="checkmark-done-outline" size={16} color={PRIMARY} />
                <Text style={styles.statVal}>{formatAmount(summary.already_paid)}</Text>
                <Text style={styles.statLabel}>Déjà versé</Text>
              </View>
            </View>

            {/* Liste historique des trajets */}
            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.cardTitle}>Mes trajets complétés</Text>
                <Ionicons name="car-sport-outline" size={18} color={MUTED} />
              </View>

              {filteredHistory.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Ionicons name="receipt-outline" size={36} color={BORDER} />
                  <Text style={styles.emptyText}>Aucun trajet pour ce filtre.</Text>
                </View>
              ) : (
                filteredHistory.map((item, i) => {
                  const hasPayouts = item.payouts && item.payouts.length > 0;
                  const firstPayout = hasPayouts ? item.payouts[0] : null;
                  const cfg = firstPayout ? STATUS_CFG[firstPayout.status] : null;

                  return (
                    <View key={item.ride_id}>
                      <View style={styles.txRow}>
                        <View style={styles.txIcon}>
                          <Ionicons
                            name={firstPayout ? (cfg?.icon ?? "card-outline") : "car-outline"}
                            size={20}
                            color={firstPayout ? (cfg?.color ?? MUTED) : PRIMARY}
                          />
                        </View>
                        <View style={styles.txInfo}>
                          <Text style={styles.txTitle} numberOfLines={1}>
                            {item.departure_location} → {item.arrival_location}
                          </Text>
                          <Text style={styles.txDate}>
                            {formatDate(item.departure_date)}
                            {firstPayout && cfg ? `  ·  ${cfg.label}` : "  ·  Gains disponibles"}
                          </Text>
                        </View>
                        <View style={styles.txAmount}>
                          <Text style={styles.txAmountText}>
                            +{formatAmount(item.driver_amount)}
                          </Text>
                        </View>
                      </View>
                      {i < filteredHistory.length - 1 && <View style={styles.txSeparator} />}
                    </View>
                  );
                })
              )}
            </View>
          </ScrollView>
        )}
      </View>

      {/* ====== MODAL DE RETRAIT PARTIEL/TOTAL ====== */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setShowModal(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.handle} />

            {/* STEP 1: FORMULAIRE */}
            {withdrawStep === "form" && (
              <>
                <Text style={styles.modalTitle}>Demander un versement</Text>
                <Text style={styles.modalSubtitle}>Solde disponible : {formatAmount(summary.available_balance)}</Text>

                {/* Input Montant */}
                <Text style={styles.inputLabel}>Montant à retirer (FCFA)</Text>
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.input}
                    placeholder="Ex: 5000"
                    placeholderTextColor={MUTED}
                    keyboardType="numeric"
                    value={amount}
                    onChangeText={setAmount}
                  />
                  <TouchableOpacity style={styles.maxBtn} onPress={() => setAmount(String(summary.available_balance))}>
                    <Text style={styles.maxBtnText}>MAX</Text>
                  </TouchableOpacity>
                </View>

                {/* Input Téléphone */}
                <Text style={styles.inputLabel}>Numéro de téléphone Mobile Money</Text>
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.input}
                    placeholder="Ex: 97000000"
                    placeholderTextColor={MUTED}
                    keyboardType="phone-pad"
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                  />
                </View>

                {/* Sélection Opérateur */}
                <Text style={styles.inputLabel}>Opérateur Mobile Money</Text>
                <View style={styles.operatorRow}>
                  {OPERATORS.map(op => (
                    <TouchableOpacity
                      key={op.key}
                      style={[
                        styles.operatorBtn,
                        operator === op.key && { borderColor: op.color, backgroundColor: op.color + "15" }
                      ]}
                      onPress={() => setOperator(op.key as any)}
                    >
                      <Text style={[styles.operatorBtnText, operator === op.key && { color: op.color, fontWeight: "700" }]}>
                        {op.key.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {error ? (
                  <View style={styles.errorBox}>
                    <Ionicons name="alert-circle-outline" size={16} color={DANGER} />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}

                <TouchableOpacity style={styles.sendBtn} onPress={handleContinueWithdraw}>
                  <Text style={styles.sendBtnText}>Continuer</Text>
                </TouchableOpacity>
              </>
            )}

            {/* STEP 2: CONFIRMATION */}
            {withdrawStep === "confirm" && (
              <>
                <Text style={styles.modalTitle}>Confirmer le retrait</Text>
                <View style={styles.confirmBox}>
                  <Text style={styles.confirmLabel}>Montant demandé</Text>
                  <Text style={styles.confirmVal}>{formatAmount(amtNum)}</Text>

                  <View style={styles.confirmRow}>
                    <Text style={styles.confirmRowLabel}>Numéro destinataire</Text>
                    <Text style={styles.confirmRowValue}>{phoneNumber}</Text>
                  </View>
                  <View style={styles.confirmRow}>
                    <Text style={styles.confirmRowLabel}>Opérateur</Text>
                    <Text style={styles.confirmRowValue}>{selectedOp.label}</Text>
                  </View>
                  <View style={styles.confirmRow}>
                    <Text style={styles.confirmRowLabel}>Solde restant après retrait</Text>
                    <Text style={styles.confirmRowValue}>{formatAmount(summary.available_balance - amtNum)}</Text>
                  </View>
                </View>

                <TouchableOpacity style={styles.sendBtn} onPress={handleConfirmWithdraw}>
                  <Text style={styles.sendBtnText}>Confirmer le versement</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.cancelBtn} onPress={() => setWithdrawStep("form")}>
                  <Text style={styles.cancelText}>Retour</Text>
                </TouchableOpacity>
              </>
            )}

            {/* STEP 3: CHARGEMENT */}
            {withdrawStep === "loading" && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={PRIMARY} />
                <Text style={styles.loadingText}>Traitement en cours...</Text>
              </View>
            )}

            {/* STEP 4: SUCCESS */}
            {withdrawStep === "success" && payoutResult && (
              <Animated.View style={[styles.successContainer, { opacity: fadeAnim }]}>
                <Ionicons name="checkmark-circle" size={60} color={PRIMARY} />
                <Text style={styles.successTitle}>Demande enregistrée !</Text>
                <Text style={styles.successDesc}>
                  Votre demande de versement de {formatAmount(payoutResult.amount)} a bien été prise en compte sous la référence {payoutResult.payout_reference}.
                </Text>
                <TouchableOpacity style={styles.sendBtn} onPress={handleSuccessFinished}>
                  <Text style={styles.sendBtnText}>Terminer</Text>
                </TouchableOpacity>
              </Animated.View>
            )}

          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BACKGROUND },

  // ---- HERO ----
  heroSection: {
    backgroundColor: BACKGROUND,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 24,
  },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  pills: { flexDirection: "row", backgroundColor: "rgba(255,255,255,0.6)", borderRadius: 20, padding: 3, gap: 2 },
  pill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 17 },
  pillActive: { backgroundColor: PRIMARY_DARK },
  pillText: { fontSize: 13, fontWeight: "600", color: PRIMARY_DARK },
  pillTextActive: { color: "white" },
  refreshBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.7)",
    justifyContent: "center", alignItems: "center",
  },
  balanceLabel: { fontSize: 13, color: PRIMARY_DARK, fontWeight: "500", marginBottom: 4 },
  balanceValue: { fontSize: 34, fontWeight: "800", color: TEXT, letterSpacing: -0.5, marginBottom: 16 },
  withdrawTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "white",
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: PRIMARY_LIGHT,
  },
  withdrawTriggerDisabled: {
    backgroundColor: "rgba(255,255,255,0.5)",
    borderColor: BORDER,
  },
  withdrawTriggerText: {
    fontSize: 14,
    fontWeight: "700",
    color: PRIMARY,
  },

  // ---- CONTENT ----
  content: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -8,
    paddingTop: 8,
  },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, paddingTop: 80 },
  loadingText: { color: MUTED, fontSize: 14 },

  // ---- STATS ROW ----
  statsRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    gap: 10,
    marginTop: 16,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    gap: 4,
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    elevation: 1,
  },
  statVal: {
    fontSize: 14,
    fontWeight: "700",
    color: TEXT,
  },
  statLabel: {
    fontSize: 11,
    color: MUTED,
  },

  // ---- CARD ----
  card: {
    backgroundColor: "white",
    borderRadius: 20,
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 18,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: TEXT },

  // ---- TRANSACTIONS ----
  txRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  txIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center", backgroundColor: "#F3F4F6" },
  txInfo: { flex: 1 },
  txTitle: { fontSize: 13, fontWeight: "600", color: TEXT },
  txDate: { fontSize: 11, color: MUTED, marginTop: 2 },
  txAmount: { alignItems: "flex-end", gap: 4 },
  txAmountText: { fontSize: 14, fontWeight: "700", color: PRIMARY },
  txSeparator: { height: 1, backgroundColor: "#F3F4F6", marginVertical: 2 },

  emptyBox: { alignItems: "center", paddingVertical: 24, gap: 8 },
  emptyText: { fontSize: 13, color: MUTED },

  // ---- MODAL SHEET ----
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
  modalTitle: { fontSize: 18, fontWeight: "800", color: TEXT, marginBottom: 4 },
  modalSubtitle: { fontSize: 13, color: MUTED, marginBottom: 20 },
  inputLabel: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6, marginTop: 10 },
  inputRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderWidth: 1.5, borderColor: BORDER,
    borderRadius: 12, paddingHorizontal: 12,
    backgroundColor: "#F9FAFB", marginBottom: 10,
  },
  input: { flex: 1, paddingVertical: 12, fontSize: 15, color: TEXT, fontWeight: "600" },
  maxBtn: {
    backgroundColor: PRIMARY_LIGHT,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  maxBtnText: {
    color: PRIMARY_DARK,
    fontWeight: "800",
    fontSize: 11,
  },
  operatorRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  operatorBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#F9FAFB",
  },
  operatorBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: MUTED,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEE2E2",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 12,
    color: DANGER,
    flex: 1,
  },
  sendBtn: {
    backgroundColor: PRIMARY, paddingVertical: 14, borderRadius: 12,
    alignItems: "center", justifyContent: "center", marginTop: 8,
  },
  sendBtnText: { color: "white", fontWeight: "700", fontSize: 15 },
  cancelBtn: { alignItems: "center", paddingVertical: 10, marginTop: 4 },
  cancelText: { color: MUTED, fontSize: 13 },

  // ---- CONFIRM BOX ----
  confirmBox: {
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  confirmLabel: {
    fontSize: 12,
    color: MUTED,
    marginBottom: 2,
  },
  confirmVal: {
    fontSize: 24,
    fontWeight: "800",
    color: PRIMARY_DARK,
    marginBottom: 14,
  },
  confirmRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#ECEFF1",
  },
  confirmRowLabel: {
    fontSize: 12,
    color: MUTED,
  },
  confirmRowValue: {
    fontSize: 12,
    fontWeight: "600",
    color: TEXT,
  },

  // ---- LOADING / SUCCESS ----
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 12,
  },
  successContainer: {
    alignItems: "center",
    paddingVertical: 20,
    gap: 12,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: TEXT,
  },
  successDesc: {
    fontSize: 13,
    color: MUTED,
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 10,
    marginBottom: 12,
  },
});

