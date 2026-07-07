import React, { useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useLocalSearchParams, useRouter } from 'expo-router';

export default function PaymentScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    
    const paymentUrl = params.url as string;
    const bookingId = params.booking_id as string;
    const parcelId = params.parcel_id as string;
    const amount = Number(params.amount) || 0;

    const [loading, setLoading] = useState(true);

    const onMessage = async (event: WebViewMessageEvent) => {
        try {
            const data = JSON.parse(event.nativeEvent.data);
            
            if (data.status === 'success') {
                const txId = data.transaction_id;
                
                router.replace({
                    pathname: '/payment/success',
                    params: { 
                        transaction_id: txId,
                        booking_id: bookingId,
                        parcel_id: parcelId,
                        amount: data.amount || amount
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

    return (
        <View style={styles.container}>
            <WebView
                source={{ uri: paymentUrl }}
                onMessage={onMessage}
                onLoadEnd={() => setLoading(false)}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                startInLoadingState={true}
                renderLoading={() => (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#2F80ED" />
                    </View>
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB'
    },
    loadingContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.8)'
    }
});
