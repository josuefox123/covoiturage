import React, { useEffect, useState } from 'react';
// Force reload cache Metro
import { View, StyleSheet, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { usePayment } from '../../src/hooks/usePayment';
import { useAuth } from '../../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

import { rideSessionManager } from '../../src/features/ride-session/manager/RideSessionManager';

export default function PaymentScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { initiatePayment, loading, error } = usePayment();
    const { authFetch } = useAuth();
    
    // Preference: Active RideSession booking ID over route params
    const activeSession = rideSessionManager.getCurrentSession();
    const bookingId = activeSession?.payment?.bookingId || (params.booking_id as string);
    const amount = activeSession?.payment?.amountPaidOnline || Number(params.amount) || 0;

    const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
    const [txRef, setTxRef] = useState<string | null>(null);

    useEffect(() => {
        if (bookingId) {
            handleInitiate();
        }
    }, [bookingId]);

    const handleInitiate = async () => {
        const response = await initiatePayment(bookingId);
        if (response && response.payment_url) {
            setPaymentUrl(response.payment_url);
            setTxRef(response.transaction_reference);
        }
    };

    const resetBookingStatus = async () => {
        if (!bookingId) return;
        try {
            await authFetch(`/bookings/${bookingId}/cancel/`, {
                method: 'POST'
            });
        } catch (e) {
            console.error('Failed to cancel booking:', e);
        }
    };

    const handleNavigationStateChange = async (navState: any) => {
        const url = navState.url;
        const lowerUrl = url.toLowerCase();
        
        // Détecter la réussite par URL
        if (
            lowerUrl.includes('status=success') || 
            lowerUrl.includes('status=approved') || 
            lowerUrl.includes('payment_complete') || 
            lowerUrl.includes('/payment/success')
        ) {
            let txId = '';
            try {
                const queryStr = url.split('?')[1];
                if (queryStr) {
                    const pairs = queryStr.split('&');
                    for (const pair of pairs) {
                        const [key, val] = pair.split('=');
                        if (key === 'transaction_id' || key === 'reference') {
                            txId = decodeURIComponent(val);
                        }
                    }
                }
            } catch (err) {}
            
            router.replace({
                pathname: '/payment/success',
                params: { 
                    transaction_reference: txRef || '',
                    transaction_id: txId,
                    booking_id: bookingId,
                    amount: amount
                }
            });
        } 
        // Détecter si on retombe sur le dashboard après le paiement
        else if (
            (url.includes('zemy.erika-app.com') || url.includes('127.0.0.1.nip.io') || url.includes('localhost')) && 
            !url.includes('/payments/checkout/')
        ) {
            let txId = '';
            try {
                const queryStr = url.split('?')[1];
                if (queryStr) {
                    const pairs = queryStr.split('&');
                    for (const pair of pairs) {
                        const [key, val] = pair.split('=');
                        if (key === 'transaction_id' || key === 'reference') {
                            txId = decodeURIComponent(val);
                        }
                    }
                }
            } catch (err) {}

            router.replace({
                pathname: '/payment/success',
                params: { 
                    transaction_reference: txRef || '',
                    transaction_id: txId || 'redirect_success',
                    booking_id: bookingId,
                    amount: amount
                }
            });
        }
        // Détecter l'échec par URL
        else if (
            lowerUrl.includes('status=failed') || 
            lowerUrl.includes('status=error') || 
            lowerUrl.includes('/payment/failed')
        ) {
            let msg = 'Le paiement a échoué.';
            try {
                const queryStr = url.split('?')[1];
                if (queryStr) {
                    const pairs = queryStr.split('&');
                    for (const pair of pairs) {
                        const [key, val] = pair.split('=');
                        if (key === 'message' || key === 'error') {
                            msg = decodeURIComponent(val);
                        }
                    }
                }
            } catch (err) {}
            
            await resetBookingStatus();
            router.replace({
                pathname: '/payment/failed',
                params: { message: msg }
            });
        }
    };

    const onMessage = async (event: WebViewMessageEvent) => {
        try {
            const data = JSON.parse(event.nativeEvent.data);
            
            if (data.status === 'success') {
                router.replace({
                    pathname: '/payment/success',
                    params: { 
                        transaction_reference: txRef || '',
                        transaction_id: data.transaction_id,
                        booking_id: bookingId,
                        amount: amount
                    }
                });
            } else if (data.status === 'failed') {
                await resetBookingStatus();
                router.replace({
                    pathname: '/payment/failed',
                    params: { message: data.message }
                });
            }
        } catch (e) {
            console.error('Error parsing WebView message', e);
        }
    };

    if (loading || !paymentUrl) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2F80ED" />
                <Text style={styles.loadingText}>Initialisation du paiement sécurisé...</Text>
                <Text style={styles.loadingSubtext}>Connexion sécurisée en cours</Text>
                {error && (
                    <View style={styles.errorBox}>
                        <Text style={styles.errorText}>{error}</Text>
                        <TouchableOpacity style={styles.retryBtn} onPress={handleInitiate}>
                            <Text style={styles.retryText}>Réessayer</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={async () => {
                    await resetBookingStatus();
                    if (router.canGoBack()) {
                        router.back();
                    } else {
                        router.replace('/(tabs)/trips');
                    }
                }}>
                    <Ionicons name="close" size={24} color="#0F172A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Paiement Zemy</Text>
                <View style={{ width: 40 }} />
            </View>
            <WebView
                source={{ uri: paymentUrl }}
                onMessage={onMessage}
                onNavigationStateChange={handleNavigationStateChange}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                startInLoadingState={true}
                cacheEnabled={false}
                incognito={true}
                renderLoading={() => (
                    <View style={styles.webViewLoading}>
                        <ActivityIndicator size="large" color="#2F80ED" />
                    </View>
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 48,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        backgroundColor: '#FFFFFF',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 3
    },
    backBtn: { padding: 8 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A', letterSpacing: -0.3 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 24 },
    loadingText: { marginTop: 20, fontSize: 16, color: '#0F172A', fontWeight: '600', textAlign: 'center' },
    loadingSubtext: { marginTop: 6, fontSize: 13, color: '#64748B', fontWeight: '400', textAlign: 'center' },
    webViewLoading: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' },
    errorBox: { marginTop: 24, alignItems: 'center', width: '100%' },
    errorText: { color: '#EF4444', textAlign: 'center', marginBottom: 16, fontSize: 14, fontWeight: '500' },
    retryBtn: { backgroundColor: '#2F80ED', paddingVertical: 14, paddingHorizontal: 28, borderRadius: 12, shadowColor: '#2F80ED', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
    retryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 }
});
