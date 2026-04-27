import { useBalance, usePayouts } from '../hooks/usePayoutData';
import { formatPaiseToINR } from '../utils/currency';
import 'react';

export function BalanceCard({ merchantId }: { merchantId: string }) {
    const { data, isLoading, isError } = useBalance(merchantId);
    const { data: payouts = [] } = usePayouts(merchantId);

    const heldFundsPaise = payouts
        .filter(p => p.status === 'PROCESSING')
        .reduce((sum, p) => sum + p.amount_paise, 0);

    return (
        <div className="border border-transparent bg-card text-card-foreground flex flex-col h-full transition-colors duration-200">
            <div className="p-8 flex-1 flex flex-col justify-between">
                <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-border pb-4">
                        <div className="border-l-2 border-amber-500 pl-2">
                            <h3 className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Vol. A / Available Balance</h3>
                        </div>
                        <iconify-icon icon="lucide:wallet" className="text-muted-foreground text-sm"></iconify-icon>
                    </div>
                    <div className="flex items-baseline gap-2 pt-4">
                        {isLoading ? (
                            <div className="h-12 w-48 bg-muted animate-pulse border border-border" />
                        ) : isError ? (
                            <div className="text-destructive font-mono text-[10px] uppercase tracking-widest border border-destructive p-2">SYS_ERR: BAL_LOAD_FAIL</div>
                        ) : (
                            <span className="text-5xl font-display font-medium tracking-tight text-foreground">
                                {formatPaiseToINR(data?.available_balance_paise || 0)}
                            </span>
                        )}
                    </div>
                </div>

                <div className="mt-12 pt-4 border-t border-border flex items-center justify-between bg-background p-4 border-b">
                    <div className="flex items-center gap-3">
                        <span className="flex h-2 w-2 bg-amber-500"></span>
                        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Held Vector</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="font-mono text-[12px] font-bold tracking-widest text-amber-600 dark:text-amber-400">{formatPaiseToINR(heldFundsPaise)}</span>
                        <button className="text-muted-foreground hover:text-foreground transition-colors outline-none h-4 w-4 border border-border flex items-center justify-center hover:bg-muted" title="Funds held in Processing state">
                            <iconify-icon icon="lucide:info" className="text-[10px]"></iconify-icon>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
