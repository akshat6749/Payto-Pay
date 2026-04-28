const rawApiUrl = import.meta.env.VITE_API_URL as string | undefined;
const normalizedApiUrl = rawApiUrl?.replace(/\/+$/, "");
export const API_BASE_URL = normalizedApiUrl
    ? (normalizedApiUrl.endsWith("/api/v1") ? normalizedApiUrl : `${normalizedApiUrl}/api/v1`)
    : "/api/v1";

export interface Merchant {
    id: string;
    name: string;
    created_at: string;
}

export interface BankAccount {
    id: string;
    merchant_id: string;
    account_number: string;
    ifsc: string;
    created_at: string;
}

export interface BalanceResponse {
    available_balance_paise: number;
}

export interface Payout {
    id: number | string;
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    amount_paise: number;
    created_at: string;
    bank_account_id: string;
}

export interface PayoutRequest {
    amount_paise: number;
    bank_account_id: string;
}

export const fetchMerchants = async (): Promise<Merchant[]> => {
    const res = await fetch(`${API_BASE_URL}/merchants/`);
    if (!res.ok) throw new Error('Failed to fetch merchants');
    return res.json();
};

export const fetchBankAccounts = async (merchantId: string): Promise<BankAccount[]> => {
    const res = await fetch(`${API_BASE_URL}/bank-accounts/`, {
        headers: { 'X-Merchant-Id': merchantId },
    });
    if (!res.ok) throw new Error('Failed to fetch bank accounts');
    return res.json();
};

export const fetchBalance = async (merchantId: string): Promise<BalanceResponse> => {
    const res = await fetch(`${API_BASE_URL}/merchants/balance/`, {
        headers: {
            'X-Merchant-Id': merchantId,
        },
    });
    if (!res.ok) throw new Error('Failed to fetch balance');
    return res.json();
};

export const fetchPayouts = async (merchantId: string): Promise<Payout[]> => {
    const res = await fetch(`${API_BASE_URL}/payouts/`, {
        headers: {
            'X-Merchant-Id': merchantId,
        },
    });
    if (!res.ok) throw new Error('Failed to fetch payouts');
    return res.json();
};

export const requestPayout = async (data: PayoutRequest, idempotencyKey: string, merchantId: string): Promise<Payout> => {
    const res = await fetch(`${API_BASE_URL}/payouts/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Merchant-Id': merchantId,
            'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        let errorMessage = 'Failed to request payout';
        try {
            const errorData = await res.json();
            if (errorData?.detail) errorMessage = errorData.detail;
            else if (errorData?.error) errorMessage = errorData.error;
        } catch {
            // Ignore JSON parse errors for fallback error message
        }
        throw new Error(errorMessage);
    }
    return res.json();
};
