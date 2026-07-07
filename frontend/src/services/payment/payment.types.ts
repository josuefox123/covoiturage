export interface ConfirmPaymentRequest {
    reservation_id?: string;
    parcel_id?: string;
    transaction_id: string;
    montant?: number;
    payment_method?: string;
}

export interface ConfirmPaymentResponse {
    status: string;
    message?: string;
    error?: string;
    already_processed?: boolean;
}
