import { useState, useMemo, useEffect, useRef } from 'react';
import { usePayouts, useBankAccounts } from '../hooks/usePayoutData';
import { formatPaiseToINR } from '../utils/currency';
import { getBankNameFromIFSC } from '../utils/bank';
import 'react';

function StatusBadge({ status }: { status: string }) {
    if (status === 'PENDING') {
        return <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-widest font-bold border border-amber-500/30 text-amber-600 dark:text-[#F4D35E] bg-amber-500/10 dark:bg-[#F4D35E]/10">Sys.Pending</span>;
    }
    if (status === 'PROCESSING') {
        return <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-widest font-bold border border-orange-500/30 bg-orange-500/10 text-orange-600 dark:bg-[#FF8C69]/10 dark:text-[#FF8C69]">Proc_Wait</span>;
    }
    if (status === 'COMPLETED') {
        return <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-widest font-bold border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:bg-[#9EFFBF]/10 dark:text-[#9EFFBF]">Exec_OK</span>;
    }
    if (status === 'FAILED') {
        return <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-widest font-bold border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:bg-[#FF007F]/10 dark:text-[#FF007F]">Sig_Err</span>;
    }
    return <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-widest font-bold border border-border text-foreground bg-background">{status}</span>;
}

export function TransactionTable({ merchantId }: { merchantId: string }) {
    const { data: payouts = [], isLoading, isError } = usePayouts(merchantId);
    const { data: bankAccounts = [] } = useBankAccounts(merchantId);

    const [page, setPage] = useState(0);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const filterRef = useRef<HTMLDivElement>(null);
    const limit = 10;

    const getAccountDisplay = (bankId: string) => {
        const bank = bankAccounts.find(b => b.id === bankId);
        if (bank) {
            return {
                name: getBankNameFromIFSC(bank.ifsc),
                lastFour: bank.account_number.slice(-4)
            };
        }
        return {
            name: 'Bank Account',
            lastFour: bankId.substring(0, 4)
        };
    };

    const filteredPayouts = useMemo(() => {
        return payouts.filter(p => {
            if (statusFilter && p.status !== statusFilter) return false;

            if (startDate) {
                const pDate = new Date(p.created_at);
                const sDate = new Date(startDate);
                sDate.setHours(0, 0, 0, 0);
                if (pDate < sDate) return false;
            }
            if (endDate) {
                const pDate = new Date(p.created_at);
                const eDate = new Date(endDate);
                eDate.setHours(23, 59, 59, 999);
                if (pDate > eDate) return false;
            }
            return true;
        });
    }, [payouts, startDate, endDate, statusFilter]);

    const paginatedPayouts = useMemo(() => {
        return filteredPayouts.slice(page * limit, (page * limit) + limit);
    }, [filteredPayouts, page, limit]);

    // Reset pagination when filter changes
    useEffect(() => {
        setPage(0);
    }, [startDate, endDate, statusFilter]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
                setIsFilterOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleExportCSV = () => {
        if (filteredPayouts.length === 0) return;

        const headers = ["Date", "Reference ID", "Bank Account", "Amount (INR)", "Status"];
        const rows = filteredPayouts.map(p => {
            const acc = getAccountDisplay(p.bank_account_id);
            return [
                new Date(p.created_at).toISOString(),
                `PO-${typeof p.id === 'string' ? p.id.substring(0, 8).toUpperCase() : p.id}`,
                `${acc.name} ****${acc.lastFour}`,
                (p.amount_paise / 100).toFixed(2),
                p.status
            ];
        });

        const csvContent = [
            headers.join(","),
            ...rows.map(e => e.join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `payouts_export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="bg-card text-card-foreground transition-colors duration-200">
            <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border transition-colors duration-200 bg-background">
                <div className="border-l-2 border-primary pl-3">
                    <h3 className="text-[10px] uppercase font-mono tracking-widest text-primary">Vol. C / Execution Log</h3>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative" ref={filterRef}>
                        <button
                            onClick={() => setIsFilterOpen(!isFilterOpen)}
                            className={`inline-flex items-center justify-center font-mono text-[9px] uppercase tracking-widest transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary border h-8 px-3 ${(startDate || endDate || statusFilter) ? 'bg-primary border-primary text-primary-foreground' : 'border-border bg-card hover:bg-muted text-foreground'}`}
                        >
                            <iconify-icon icon="lucide:filter" className="mr-2 text-xs"></iconify-icon>
                            {startDate || endDate || statusFilter ? 'Filter Block [Active]' : 'Set Filter Block'}
                        </button>

                        {isFilterOpen && (
                            <div className="absolute right-0 mt-1 w-72 bg-card border border-border z-50 p-4 space-y-4 transform origin-top-right transition-all">
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-mono font-semibold text-muted-foreground uppercase tracking-widest">Sys_Status</label>
                                    <select
                                        className="w-full bg-background border border-border px-3 py-2 text-xs font-mono outline-none text-foreground cursor-pointer appearance-none"
                                        value={statusFilter}
                                        onChange={(e) => setStatusFilter(e.target.value)}
                                    >
                                        <option value="">[ * ] Root (All)</option>
                                        <option value="PENDING">PENDING</option>
                                        <option value="PROCESSING">PROCESSING</option>
                                        <option value="COMPLETED">COMPLETED</option>
                                        <option value="FAILED">FAILED</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-mono font-semibold text-muted-foreground uppercase tracking-widest">Time_Start</label>
                                    <input
                                        type="date"
                                        className="w-full bg-background border border-border px-3 py-2 text-xs font-mono outline-none text-foreground"
                                        value={startDate}
                                        onChange={e => setStartDate(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-mono font-semibold text-muted-foreground uppercase tracking-widest">Time_End</label>
                                    <input
                                        type="date"
                                        className="w-full bg-background border border-border px-3 py-2 text-xs font-mono outline-none text-foreground"
                                        value={endDate}
                                        onChange={e => setEndDate(e.target.value)}
                                    />
                                </div>
                                <div className="pt-2 border-t border-border flex items-center justify-between">
                                    <button
                                        onClick={() => { setStartDate(''); setEndDate(''); setStatusFilter(''); setIsFilterOpen(false); }}
                                        className="text-[9px] font-mono uppercase tracking-widest text-[#FF8C69] hover:text-foreground transition-colors"
                                    >
                                        [CLR.DUMP]
                                    </button>
                                    <button
                                        onClick={() => setIsFilterOpen(false)}
                                        className="inline-flex items-center justify-center font-mono text-[9px] uppercase tracking-widest border border-transparent bg-primary text-primary-foreground hover:bg-primary/90 h-8 px-3"
                                    >
                                        [EXEC]
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={handleExportCSV}
                        disabled={filteredPayouts.length === 0}
                        className="inline-flex items-center justify-center font-mono text-[9px] uppercase tracking-widest transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary border border-border bg-background hover:bg-muted disabled:opacity-50 text-foreground h-8 px-3"
                    >
                        <iconify-icon icon="lucide:download" className="mr-2 text-xs"></iconify-icon> Dump CSV
                    </button>
                </div>
            </div>

            <div className="w-full overflow-auto border-x-0 border-transparent bg-background">
                <table className="w-full text-sm border-0 border-transparent">
                    <thead className="[&_tr]:border-b">
                        <tr className="border-b border-border bg-muted">
                            <th className="h-10 px-6 text-center align-middle font-mono text-[9px] uppercase tracking-widest text-muted-foreground w-[150px]">Sys.Date</th>
                            <th className="h-10 px-6 text-center align-middle font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Ref.ID</th>
                            <th className="h-10 px-6 text-center align-middle font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Target Vector</th>
                            <th className="h-10 px-6 text-center align-middle font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Amt (INR)</th>
                            <th className="h-10 px-6 text-center align-middle font-mono text-[9px] uppercase tracking-widest text-muted-foreground w-[120px]">State</th>
                        </tr>
                    </thead>
                    <tbody className="[&_tr:last-child]:border-0 font-mono text-[10px]">
                        {isLoading ? (
                            <tr>
                                <td colSpan={5} className="p-12 text-center text-muted-foreground">
                                    <div className="flex justify-center items-center">
                                        <iconify-icon icon="lucide:loader-2" className="animate-spin text-2xl"></iconify-icon>
                                    </div>
                                </td>
                            </tr>
                        ) : isError ? (
                            <tr>
                                <td colSpan={5} className="p-12 text-center text-red-500 font-medium">
                                    Failed to load payouts. Retrying...
                                </td>
                            </tr>
                        ) : filteredPayouts.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="p-12 text-center text-muted-foreground">
                                    No payouts found matching your criteria.
                                </td>
                            </tr>
                        ) : (
                            paginatedPayouts.map((payout) => {
                                const bankInfo = getAccountDisplay(payout.bank_account_id);
                                return (
                                    <tr key={payout.id} className="border-b border-border transition-colors hover:bg-muted/30 group">
                                        <td className="px-6 py-4 text-center align-middle text-muted-foreground whitespace-nowrap">
                                            <span className="text-foreground">{new Date(payout.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}</span> <br />
                                            <span className="opacity-50">{new Date(payout.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                                        </td>
                                        <td className="px-6 py-4 text-center align-middle text-muted-foreground">
                                            PO-{typeof payout.id === 'string' ? payout.id.substring(0, 8).toUpperCase() : payout.id}
                                        </td>
                                        <td className="px-6 py-4 text-center align-middle">
                                            <div className="flex flex-col">
                                                <span className="text-foreground">{bankInfo.name}</span>
                                                <span className="opacity-50">**** {bankInfo.lastFour}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center align-middle tabular-nums text-foreground">
                                            {formatPaiseToINR(payout.amount_paise)}
                                        </td>
                                        <td className="px-6 py-4 text-center align-middle flex items-center justify-center">
                                            <StatusBadge status={payout.status} />
                                        </td>
                                    </tr>
                                )
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            {filteredPayouts.length > 0 && (
                <div className="p-4 border-t border-border flex items-center justify-between transition-colors duration-200 bg-background">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                        IDX: {(page * limit) + 1}-{Math.min((page * limit) + limit, filteredPayouts.length)} / {filteredPayouts.length}
                    </span>
                    <div className="flex items-center gap-1">
                        <button
                            disabled={page === 0}
                            onClick={() => setPage(p => p - 1)}
                            className="inline-flex items-center justify-center text-foreground font-mono transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 border border-border bg-card hover:bg-muted h-6 w-6 p-0"
                        >
                            <iconify-icon icon="lucide:chevron-left" className="text-xs"></iconify-icon>
                        </button>
                        <span className="font-mono text-[9px] px-2 text-muted-foreground">BLK.{(page + 1).toString().padStart(2, '0')}</span>
                        <button
                            disabled={(page * limit) + limit >= filteredPayouts.length}
                            onClick={() => setPage(p => p + 1)}
                            className="inline-flex items-center justify-center text-foreground font-mono transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 border border-border bg-card hover:bg-muted h-6 w-6 p-0"
                        >
                            <iconify-icon icon="lucide:chevron-right" className="text-xs"></iconify-icon>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
