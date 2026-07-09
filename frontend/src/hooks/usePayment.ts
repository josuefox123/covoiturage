import { useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { PaymentService, InitiatePaymentResponse, VerifyPaymentResponse } from '../services/payment/payment.service';

export const usePayment = () => {
    const { authFetch } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const initiatePayment = useCallback(async (bookingId: string): Promise<InitiatePaymentResponse | null> => {
        setLoading(true);
        setError(null);
        try {
            const payment = await PaymentService.initiatePayment(authFetch, bookingId);
            return payment;
        } catch (err: any) {
            const errMsg = err.error || err.message || "Erreur lors de l'initialisation du paiement.";
            setError(errMsg);
            return null;
        } finally {
            setLoading(false);
        }
    }, [authFetch]);

    const verifyPayment = useCallback(async (
        transactionReference: string, 
        transactionId?: string
    ): Promise<VerifyPaymentResponse | null> => {
        setLoading(true);
        setError(null);
        try {
            const response = await PaymentService.verifyPayment(authFetch, transactionReference, transactionId);
            return response;
        } catch (err: any) {
            const errMsg = err.error || err.message || "Erreur lors de la vérification du paiement.";
            setError(errMsg);
            return null;
        } finally {
            setLoading(false);
        }
    }, [authFetch]);

    return {
        initiatePayment,
        verifyPayment,
        loading,
        error
    };
};
