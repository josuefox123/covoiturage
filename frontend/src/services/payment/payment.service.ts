import { ConfirmPaymentRequest, ConfirmPaymentResponse } from './payment.types';

export const PaymentService = {
    confirmPayment: async (authFetch: any, data: ConfirmPaymentRequest): Promise<ConfirmPaymentResponse> => {
        try {
            const response = await authFetch('/payments/confirm/', {
                method: 'POST',
                body: JSON.stringify(data)
            });
            return response;
        } catch (error: any) {
            throw error;
        }
    },
    syncPayments: async (authFetch: any) => {
        try {
            const response = await authFetch('/payments/sync_payments/', {
                method: 'POST'
            });
            return response;
        } catch (error: any) {
            throw new Error('Erreur lors de la synchronisation des paiements');
        }
    }
};
