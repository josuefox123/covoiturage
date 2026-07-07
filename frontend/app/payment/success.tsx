import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { PaymentService } from '../../src/services/payment/payment.service';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';

export default function PaymentSuccessScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { authFetch } = useAuth();
    
    const transactionId = params.transaction_id as string;
    const bookingId = params.booking_id as string;
    const parcelId = params.parcel_id as string;
    const amount = Number(params.amount) || 0;

    const [status, setStatus] = useState<'verifying' | 'success' | 'failed'>('verifying');
    const [message, setMessage] = useState('Vérification du paiement en cours...');

    useEffect(() => {
        confirmPayment();
    }, []);

    const confirmPayment = async () => {
        try {
            const data = await PaymentService.confirmPayment(authFetch, {
                transaction_id: transactionId,
                reservation_id: bookingId,
                parcel_id: parcelId,
                montant: amount
            });
            
            setStatus('success');
            setMessage(data.message || 'Votre paiement a été validé avec succès !');
        } catch (error: any) {
            setStatus('failed');
            setMessage(error.error || 'Erreur lors de la validation du paiement.');
        }
    };

    return (
        <View style={styles.container}>
            {status === 'verifying' && (
                <View style={styles.content}>
                    <ActivityIndicator size="large" color="#2F80ED" />
                    <Text style={styles.title}>Vérification</Text>
                    <Text style={styles.message}>{message}</Text>
                </View>
            )}

            {status === 'success' && (
                <View style={styles.content}>
                    <View style={styles.iconContainerSuccess}>
                        <Feather name="check-circle" size={60} color="#10B981" />
                    </View>
                    <Text style={styles.title}>Paiement Réussi</Text>
                    <Text style={styles.message}>{message}</Text>
                    <TouchableOpacity style={styles.button} onPress={() => router.replace('/(tabs)/trips')}>
                        <Text style={styles.buttonText}>Voir mes trajets</Text>
                    </TouchableOpacity>
                </View>
            )}

            {status === 'failed' && (
                <View style={styles.content}>
                    <View style={styles.iconContainerError}>
                        <Feather name="x-circle" size={60} color="#EF4444" />
                    </View>
                    <Text style={styles.title}>Échec de la validation</Text>
                    <Text style={styles.message}>{message}</Text>
                    <TouchableOpacity style={styles.buttonError} onPress={() => router.back()}>
                        <Text style={styles.buttonText}>Réessayer</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', padding: 24 },
    content: { alignItems: 'center', width: '100%' },
    iconContainerSuccess: { marginBottom: 24, backgroundColor: '#D1FAE5', padding: 20, borderRadius: 100 },
    iconContainerError: { marginBottom: 24, backgroundColor: '#FEE2E2', padding: 20, borderRadius: 100 },
    title: { fontSize: 24, fontWeight: '700', color: '#1F2937', marginBottom: 12 },
    message: { fontSize: 16, color: '#6B7280', textAlign: 'center', marginBottom: 32, lineHeight: 24 },
    button: { backgroundColor: '#2F80ED', width: '100%', padding: 16, borderRadius: 12, alignItems: 'center' },
    buttonError: { backgroundColor: '#EF4444', width: '100%', padding: 16, borderRadius: 12, alignItems: 'center' },
    buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' }
});
