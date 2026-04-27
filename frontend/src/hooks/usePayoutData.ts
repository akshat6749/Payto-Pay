import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchBankAccounts, fetchBalance, fetchMerchants, fetchPayouts, requestPayout, type PayoutRequest } from '../api/client';

export const useMerchants = () => {
    return useQuery({
        queryKey: ['merchants'],
        queryFn: fetchMerchants,
    });
};

export const useBankAccounts = (merchantId: string) => {
    return useQuery({
        queryKey: ['bank-accounts', merchantId],
        queryFn: () => fetchBankAccounts(merchantId),
        enabled: !!merchantId,
    });
};

export const useBalance = (merchantId: string) => {
    return useQuery({
        queryKey: ['balance', merchantId],
        queryFn: () => fetchBalance(merchantId),
        enabled: !!merchantId,
    });
};

export const usePayouts = (merchantId: string) => {
    return useQuery({
        queryKey: ['payouts', merchantId],
        queryFn: () => fetchPayouts(merchantId),
        refetchInterval: 3000,
        enabled: !!merchantId,
    });
};

export const usePayoutMutation = (merchantId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ data, idempotencyKey }: { data: PayoutRequest; idempotencyKey: string }) =>
            requestPayout(data, idempotencyKey, merchantId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['balance', merchantId] });
            queryClient.invalidateQueries({ queryKey: ['payouts', merchantId] });
        },
    });
};
