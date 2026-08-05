import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, ScrollView, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { usePayment } from '../../src/hooks/usePayment';
import { useAuth } from '../../src/context/AuthContext';
import { API_URL } from '../../src/services/api';
import { Feather, Ionicons } from '@expo/vector-icons';

export default function PaymentSuccessScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { authFetch } = useAuth();
    const { verifyPayment } = usePayment();
    
    const txRef = params.transaction_reference as string;
    const txId = params.transaction_id as string;
    const bookingId = params.booking_id as string;
    const amount = Number(params.amount) || 0;

    const [status, setStatus] = useState<'verifying' | 'success' | 'failed'>('verifying');
    const [message, setMessage] = useState('Vérification du paiement en cours auprès de FeexPay...');
    const [bookingDetails, setBookingDetails] = useState<any>(null);
    const [downloading, setDownloading] = useState(false);

    const handleDownloadReceipt = async () => {
        if (!bookingId) return;
        try {
            setDownloading(true);
            const FileSystem = require('expo-file-system');
            const Sharing = require('expo-sharing');
            const SecureStore = require('expo-secure-store');

            const isSharingAvailable = await Sharing.isAvailableAsync();
            if (!isSharingAvailable) {
                alert("Le partage de fichiers n'est pas disponible sur cet appareil.");
                return;
            }

            const storedToken = await SecureStore.getItemAsync('zemy_access_token');
            const receiptUrl = `${API_URL}/bookings/${bookingId}/receipt/`;
            const localUri = (((FileSystem as any).documentDirectory) ?? '') + `recu_paiement_${bookingId.substring(0, 8)}.pdf`;

            const downloadResult = await FileSystem.downloadAsync(receiptUrl, localUri, {
                headers: storedToken ? { Authorization: `Bearer ${storedToken}` } : {},
            });

            if (downloadResult.status === 200) {
                await Sharing.shareAsync(downloadResult.uri, {
                    mimeType: 'application/pdf',
                    dialogTitle: 'Reçu de paiement Zemy',
                    UTI: 'com.adobe.pdf',
                });
            } else {
                alert('Impossible de télécharger le reçu. Veuillez réessayer.');
            }
        } catch (e: any) {
            console.error('Erreur téléchargement reçu:', e);
            alert('Impossible de générer le reçu. Veuillez réessayer.');
        } finally {
            setDownloading(false);
        }
    };

    useEffect(() => {
        if (txRef) {
            handleVerify();
        } else if (bookingId) {
            handleLoadTicket();
        } else {
            setStatus('failed');
            setMessage('Référence de transaction manquante.');
        }
    }, [txRef, txId, bookingId]);

    const handleLoadTicket = async () => {
        try {
            const details = await authFetch(`/bookings/${bookingId}/`);
            const validStatuses = ['confirmed', 'active', 'started', 'completed'];
            if (details && (validStatuses.includes(details.status) || details.payment_status === 'paid')) {
                setBookingDetails(details);
                setStatus('success');
                setMessage('Votre ticket a été chargé.');
            } else {
                setStatus('failed');
                setMessage("Ce billet n'est pas disponible (réservation en attente de paiement ou annulée).");
            }
        } catch (error: any) {
            setStatus('failed');
            setMessage(error.message || 'Erreur lors de la récupération de votre billet.');
        }
    };

    const handleVerify = async () => {
        try {
            const response = await verifyPayment(txRef, txId);
            if (response && response.status === 'SUCCESS') {
                // Charger les détails de la réservation pour afficher le ticket complet
                const details = await authFetch(`/bookings/${bookingId}/`);
                setBookingDetails(details);
                setStatus('success');
                setMessage('Votre paiement a été validé avec succès !');
            } else {
                setStatus('failed');
                setMessage(response?.message || 'Le paiement n\'a pas pu être validé.');
            }
        } catch (error: any) {
            setStatus('failed');
            setMessage(error.message || 'Erreur lors de la validation du paiement.');
        }
    };

    if (status === 'verifying') {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#2F80ED" />
                <Text style={styles.verifyingTitle}>Validation en cours</Text>
                <Text style={styles.verifyingText}>{message}</Text>
            </View>
        );
    }

    if (status === 'failed') {
        return (
            <View style={styles.centerContainer}>
                <View style={styles.iconContainerError}>
                    <Feather name="x-circle" size={60} color="#EF4444" />
                </View>
                <Text style={styles.errorTitle}>Échec de la validation</Text>
                <Text style={styles.errorText}>{message}</Text>
                <TouchableOpacity 
                    style={styles.retryBtn} 
                    onPress={() => router.replace({
                        pathname: '/payment',
                        params: { booking_id: bookingId, amount: amount }
                    })}
                >
                    <Text style={styles.retryBtnText}>Réessayer le paiement</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.outlineBtn} onPress={() => router.replace('/(tabs)/')}>
                    <Text style={styles.outlineBtnText}>Retour à l'accueil</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const ride = bookingDetails?.ride_details || bookingDetails?.ride || {};
    const driver = ride.driver_details || {};
    const ticketNumber = `T-${bookingId?.substring(0, 8).toUpperCase() || 'ZEMY'}`;
    const formattedDate = ride.departure_date 
        ? new Date(ride.departure_date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
        : 'Date non précisée';

    // Données pour le QR Code du ticket
    const qrData = JSON.stringify({
        ticket: ticketNumber,
        booking: bookingId,
        passenger: bookingDetails?.passenger_details?.full_name || 'Passager Zemy',
        departure: ride.departure_location,
        arrival: ride.arrival_location,
        seats: bookingDetails?.seats_booked || 1,
        amount: amount
    });
    
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrData)}`;

    return (
        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
            <View style={styles.successHeader}>
                <View style={styles.iconContainerSuccess}>
                    <Feather name="check-circle" size={50} color="#10B981" />
                </View>
                <Text style={styles.successTitle}>Paiement Validé !</Text>
                <Text style={styles.successSubtitle}>Votre place a été réservée avec succès.</Text>
            </View>

            {/* Ticket Card */}
            <View style={styles.ticketCard}>
                <View style={styles.ticketHeader}>
                    <View>
                        <Text style={styles.ticketLabel}>TICKET DE VOYAGE</Text>
                        <Text style={styles.ticketNum}>{ticketNumber}</Text>
                    </View>
                    <Ionicons name="car-sport" size={32} color="#2F80ED" />
                </View>

                {/* Itinéraire */}
                <View style={styles.routeSection}>
                    <View style={styles.routeRow}>
                        <Ionicons name="ellipse-outline" size={16} color="#2F80ED" />
                        <Text style={styles.routeText}>{ride.departure_location}</Text>
                    </View>
                    <View style={styles.routeLine} />
                    <View style={styles.routeRow}>
                        <Ionicons name="location" size={16} color="#EF4444" />
                        <Text style={styles.routeText}>{ride.arrival_location}</Text>
                    </View>
                </View>

                <View style={styles.divider} />

                {/* Détails du voyage */}
                <View style={styles.detailsGrid}>
                    <View style={styles.detailsCol}>
                        <Text style={styles.detailsLabel}>Date & Heure</Text>
                        <Text style={styles.detailsVal}>{formattedDate}</Text>
                        <Text style={styles.detailsValSub}>{ride.departure_time?.substring(0, 5) || '--:--'}</Text>
                    </View>
                    <View style={styles.detailsCol}>
                        <Text style={styles.detailsLabel}>Places réservées</Text>
                        <Text style={styles.detailsVal}>{bookingDetails?.seats_booked || 1} place(s)</Text>
                    </View>
                </View>

                <View style={styles.detailsGrid}>
                    <View style={styles.detailsCol}>
                        <Text style={styles.detailsLabel}>Conducteur</Text>
                        <Text style={styles.detailsVal}>{driver.full_name || 'Inconnu'}</Text>
                        <Text style={styles.detailsValSub}>{driver.phone || ''}</Text>
                    </View>
                    <View style={styles.detailsCol}>
                        <Text style={styles.detailsLabel}>Montant total payé</Text>
                        <Text style={styles.detailsValAmount}>{amount} FCFA</Text>
                    </View>
                </View>

                <View style={styles.divider} />

                {/* QR Code Section */}
                <View style={styles.qrSection}>
                    <Image
                        source={{ uri: qrCodeUrl }}
                        style={styles.qrImage}
                        resizeMode="contain"
                    />
                    <Text style={styles.qrInstructions}>Présentez ce QR code au conducteur au moment du départ pour validation.</Text>
                </View>
            </View>

            <TouchableOpacity 
                style={styles.receiptBtn} 
                onPress={handleDownloadReceipt}
                disabled={downloading}
                activeOpacity={0.8}
            >
                {downloading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                    <>
                        <Ionicons name="document-text" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                        <Text style={styles.receiptBtnText}>Télécharger mon reçu PDF</Text>
                    </>
                )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.doneBtn} onPress={() => router.replace('/(tabs)/trips')}>
                <Text style={styles.doneBtnText}>Fermer et voir mes trajets</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    scrollContainer: { padding: 24, alignItems: 'center', backgroundColor: '#F9FAFB', minHeight: '100%', paddingTop: 64 },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 24 },
    verifyingTitle: { fontSize: 20, fontWeight: '700', color: '#1F2937', marginTop: 24, marginBottom: 8 },
    verifyingText: { fontSize: 14, color: '#6B7280', textAlign: 'center', paddingHorizontal: 16 },
    errorTitle: { fontSize: 22, fontWeight: '700', color: '#1F2937', marginBottom: 12 },
    errorText: { fontSize: 15, color: '#6B7280', textAlign: 'center', marginBottom: 32, lineHeight: 22 },
    iconContainerSuccess: { marginBottom: 16, backgroundColor: '#D1FAE5', padding: 16, borderRadius: 100 },
    iconContainerError: { marginBottom: 24, backgroundColor: '#FEE2E2', padding: 20, borderRadius: 100 },
    successHeader: { alignItems: 'center', marginBottom: 24 },
    successTitle: { fontSize: 24, fontWeight: '800', color: '#10B981', marginBottom: 6 },
    successSubtitle: { fontSize: 15, color: '#6B7280', textAlign: 'center' },
    ticketCard: {
        backgroundColor: '#FFFFFF',
        width: '100%',
        borderRadius: 24,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 4,
        marginBottom: 32,
        borderWidth: 1,
        borderColor: '#F3F4F6'
    },
    ticketHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
    ticketLabel: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 1.5 },
    ticketNum: { fontSize: 20, fontWeight: '800', color: '#1F2937', marginTop: 2 },
    routeSection: { marginVertical: 8 },
    routeRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
    routeText: { fontSize: 15, fontWeight: '600', color: '#374151', marginLeft: 12 },
    routeLine: { width: 1.5, height: 16, backgroundColor: '#D1D5DB', marginLeft: 7 },
    divider: { height: 1, backgroundColor: '#E5E7EB', borderStyle: 'dashed', marginVertical: 20 },
    detailsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 10 },
    detailsCol: { flex: 1 },
    detailsLabel: { fontSize: 11, fontWeight: '600', color: '#9CA3AF', marginBottom: 4 },
    detailsVal: { fontSize: 14, fontWeight: '700', color: '#1F2937' },
    detailsValSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    detailsValAmount: { fontSize: 16, fontWeight: '800', color: '#10B981' },
    qrSection: { alignItems: 'center', marginTop: 8 },
    qrImage: { width: 150, height: 150, backgroundColor: '#FFFFFF' },
    qrInstructions: { fontSize: 12, color: '#6B7280', textAlign: 'center', marginTop: 16, lineHeight: 18, paddingHorizontal: 8 },
    retryBtn: { backgroundColor: '#2F80ED', width: '100%', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
    retryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
    outlineBtn: { width: '100%', padding: 16, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
    outlineBtnText: { color: '#4B5563', fontSize: 16, fontWeight: '600' },
    receiptBtn: { backgroundColor: '#10B981', width: '100%', padding: 16, borderRadius: 16, alignItems: 'center', marginBottom: 12, flexDirection: 'row', justifyContent: 'center' },
    receiptBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', marginLeft: 8 },
    doneBtn: { backgroundColor: '#111827', width: '100%', padding: 16, borderRadius: 16, alignItems: 'center' },
    doneBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' }
});
