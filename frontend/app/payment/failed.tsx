import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

export default function PaymentFailedScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const message = params.message as string || 'Le paiement a échoué ou a été annulé.';

    return (
        <View style={styles.container}>
            <View style={styles.content}>
                <View style={styles.iconContainerError}>
                    <Feather name="alert-circle" size={60} color="#EF4444" />
                </View>
                <Text style={styles.title}>Paiement Échoué</Text>
                <Text style={styles.message}>{message}</Text>
                
                <TouchableOpacity style={styles.button} onPress={() => {
                    if (router.canGoBack()) {
                        router.back();
                    } else {
                        router.replace('/(tabs)/trips');
                    }
                }}>
                    <Text style={styles.buttonText}>Retourner à la réservation</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.outlineButton} onPress={() => router.replace('/(tabs)/')}>
                    <Text style={styles.outlineButtonText}>Retour à l'accueil</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', padding: 24 },
    content: { alignItems: 'center', width: '100%' },
    iconContainerError: { marginBottom: 24, backgroundColor: '#FEE2E2', padding: 20, borderRadius: 100 },
    title: { fontSize: 24, fontWeight: '700', color: '#1F2937', marginBottom: 12 },
    message: { fontSize: 16, color: '#6B7280', textAlign: 'center', marginBottom: 32, lineHeight: 24 },
    button: { backgroundColor: '#2F80ED', width: '100%', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 16 },
    buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
    outlineButton: { width: '100%', padding: 16, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
    outlineButtonText: { color: '#4B5563', fontSize: 16, fontWeight: '600' }
});
