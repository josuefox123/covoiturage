export interface InitiatePaymentResponse {
    id: string;
    transaction_reference: string;
    amount: number;
    status: string;
    payment_url: string;
}

export interface VerifyPaymentResponse {
    status: string;
    message: string;
    booking_status: string;
}

export const PaymentService = {
    initiatePayment: async (authFetch: any, bookingId: string): Promise<InitiatePaymentResponse> => {
        try {
            const response = await authFetch('/payments/initiate/', {
                method: 'POST',
                body: JSON.stringify({ booking_id: bookingId })
            });
            return response;
        } catch (error: any) {
            throw error;
        }
    },
    verifyPayment: async (
        authFetch: any, 
        transactionReference: string, 
        transactionId?: string
    ): Promise<VerifyPaymentResponse> => {
        try {
            const payload: any = { transaction_reference: transactionReference };
            if (transactionId) {
                payload.transaction_id = transactionId;
            }
            const response = await authFetch('/payments/verify/', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            return response;
        } catch (error: any) {
            throw error;
        }
    }
};
