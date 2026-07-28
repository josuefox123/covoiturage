import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { usePayment } from '../../src/hooks/usePayment';
import { Ionicons } from '@expo/vector-icons';

export default function PaymentScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { initiatePayment, loading, error } = usePayment();
    
    const bookingId = params.booking_id as string;
    const amount = Number(params.amount) || 0;

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

    const handleNavigationStateChange = (navState: any) => {
        const url = navState.url;
        console.log('WebView URL changed:', url);
        
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
            
            router.replace({
                pathname: '/payment/failed',
                params: { message: msg }
            });
        }
    };

    const onMessage = (event: WebViewMessageEvent) => {
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
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                    <Ionicons name="close" size={24} color="#1F2937" />
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
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 48,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        backgroundColor: '#FFFFFF'
    },
    backBtn: { padding: 8 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 24 },
    loadingText: { marginTop: 16, fontSize: 16, color: '#4B5563', fontWeight: '500' },
    webViewLoading: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' },
    errorBox: { marginTop: 24, alignItems: 'center', width: '100%' },
    errorText: { color: '#EF4444', textAlign: 'center', marginBottom: 16, fontSize: 14 },
    retryBtn: { backgroundColor: '#2F80ED', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
    retryText: { color: '#FFFFFF', fontWeight: '600' }
});
