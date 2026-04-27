import { useForm } from '@tanstack/react-form';
import { useBankAccounts, usePayoutMutation } from '../hooks/usePayoutData';
import { useEffect, useState, useRef } from 'react';
import { getBankNameFromIFSC } from '../utils/bank';
import 'react';

function BankSelector({ field, bankAccounts, isBanksLoading, isPending }: any) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const selectedBank = bankAccounts.find((b: any) => b.id === field.state.value);

    let displayLabel = 'Select a bank account';
    if (isBanksLoading) displayLabel = 'Loading bank accounts...';
    else if (bankAccounts.length === 0) displayLabel = 'No bank accounts found';
    else if (selectedBank) displayLabel = `${getBankNameFromIFSC(selectedBank.ifsc)} •••• ${selectedBank.account_number.slice(-4)}`;

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                disabled={isPending || isBanksLoading || bankAccounts.length === 0}
                className={`flex h-10 w-full items-center justify-between border bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50 transition-colors ${isOpen ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-foreground/30'}`}
            >
                <div className="flex items-center gap-2 truncate">
                    {selectedBank ? (
                        <div className="flex items-center gap-2 text-foreground">
                            <span className="truncate font-mono text-xs">{displayLabel}</span>
                        </div>
                    ) : (
                        <span className="truncate font-mono text-xs text-muted-foreground">{displayLabel}</span>
                    )}
                </div>
                <iconify-icon
                    icon="lucide:chevron-down"
                    className={`text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                ></iconify-icon>
            </button>

            {isOpen && (
                <div className="absolute left-0 right-0 mt-1 bg-card border border-border z-50 transform origin-top transition-all">
                    <div className="max-h-60 overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                        <button
                            type="button"
                            onClick={() => {
                                field.handleChange("");
                                setIsOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-[10px] font-mono uppercase tracking-widest transition-colors mb-1 ${!field.state.value ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted'
                                }`}
                        >
                            Clear Selection
                        </button>

                        {bankAccounts.map((bank: any) => (
                            <button
                                type="button"
                                key={bank.id}
                                onClick={() => {
                                    field.handleChange(bank.id);
                                    setIsOpen(false);
                                }}
                                className={`w-full text-left px-3 py-2.5 text-sm flex flex-col gap-1 transition-all duration-150 ${field.state.value === bank.id
                                    ? 'bg-primary/5 text-primary border border-primary/20'
                                    : 'text-foreground hover:bg-muted border border-transparent'
                                    }`}
                            >
                                <span className="font-mono text-xs font-bold flex items-center justify-between">
                                    {getBankNameFromIFSC(bank.ifsc)}
                                    {field.state.value === bank.id && (
                                        <iconify-icon icon="lucide:check" className="text-primary text-[10px]"></iconify-icon>
                                    )}
                                </span>
                                <span className={`text-[10px] font-mono tracking-widest ${field.state.value === bank.id ? 'text-primary/70' : 'text-muted-foreground'}`}>
                                    ACC: {bank.account_number.slice(-4)} | IFSC: {bank.ifsc}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export function PayoutForm({ merchantId }: { merchantId: string }) {
    const { mutateAsync, isPending, error } = usePayoutMutation(merchantId);
    const { data: bankAccounts = [], isLoading: isBanksLoading } = useBankAccounts(merchantId);

    const form = useForm({
        defaultValues: {
            amount_inr: '',
            bank_account_id: '',
        },
        onSubmit: async ({ value }) => {
            const amount_paise = Math.round(parseFloat(value.amount_inr.replace(/,/g, '')) * 100);
            const idempotencyKey = crypto.randomUUID();
            await mutateAsync({
                data: {
                    amount_paise,
                    bank_account_id: value.bank_account_id,
                },
                idempotencyKey,
            });
            form.reset();
        },
    });

    useEffect(() => {
        // Auto-select first bank account when loaded
        if (bankAccounts.length > 0 && !form.state.values.bank_account_id) {
            form.setFieldValue('bank_account_id', bankAccounts[0].id);
        }
    }, [bankAccounts, form]);

    return (
        <div className="border border-transparent bg-card text-card-foreground h-full flex flex-col transition-colors duration-200">
            <div className="p-8 space-y-6 flex-1 flex flex-col">
                <div className="border-b border-border pb-4">
                    <div className="border-l-2 border-primary pl-2">
                        <h3 className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground">Vol. B / Request Payout</h3>
                    </div>
                </div>

                {error && (
                    <div className="p-3 bg-red-500/10 text-red-500 border border-red-500/20 rounded-md text-sm font-medium break-all">
                        {error.message}
                    </div>
                )}

                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        form.handleSubmit();
                    }}
                    className="space-y-4 flex-1 flex flex-col"
                >
                    <div className="space-y-4 flex-1">
                        <form.Field
                            name="amount_inr"
                            validators={{
                                onChange: ({ value }) => {
                                    if (!value) return 'Amount is required';
                                    const val = Number(value.replace(/,/g, ''));
                                    if (isNaN(val) || val <= 0) return 'Valid amount required';
                                    return undefined;
                                },
                            }}
                            children={(field) => (
                                <div className="space-y-2">
                                    <label htmlFor={field.name} className="font-mono text-[10px] uppercase tracking-widest text-primary peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Amount (INR)</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <span className="text-muted-foreground font-mono text-xs">&#8377;</span>
                                        </div>
                                        <input
                                            id={field.name}
                                            name={field.name}
                                            value={field.state.value}
                                            onBlur={field.handleBlur}
                                            onChange={(e) => field.handleChange(e.target.value)}
                                            className="flex h-10 w-full border border-border bg-background px-3 py-2 pl-7 font-mono text-xs tabular-nums ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
                                            placeholder="0.00"
                                            disabled={isPending || !merchantId}
                                        />
                                    </div>
                                    {field.state.meta.errors ? (
                                        <p className="text-orange-600 dark:text-orange-400 text-[10px] font-mono tracking-widest uppercase mt-1">{field.state.meta.errors.join(', ')}</p>
                                    ) : null}
                                </div>
                            )}
                        />

                        <form.Field
                            name="bank_account_id"
                            validators={{
                                onChange: ({ value }) => !value ? 'Bank Account is required' : undefined,
                            }}
                            children={(field) => (
                                <div className="space-y-2">
                                    <label htmlFor={field.name} className="font-mono text-[10px] uppercase tracking-widest text-primary peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Payout Target</label>
                                    <BankSelector
                                        field={field}
                                        bankAccounts={bankAccounts}
                                        isBanksLoading={isBanksLoading}
                                        isPending={isPending}
                                    />
                                    {field.state.meta.errors ? (
                                        <p className="text-orange-600 dark:text-orange-400 text-[10px] font-mono tracking-widest uppercase mt-1">{field.state.meta.errors.join(', ')}</p>
                                    ) : null}
                                </div>
                            )}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isPending || !form.state.canSubmit || !merchantId || bankAccounts.length === 0}
                        className="inline-flex items-center justify-center text-[10px] font-mono uppercase tracking-widest ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:opacity-90 h-10 px-4 py-2 w-full mt-2"
                    >
                        {isPending ? (
                            <span className="flex items-center gap-2">
                                <iconify-icon icon="lucide:loader-2" className="animate-spin text-base"></iconify-icon>
                                Executing
                            </span>
                        ) : 'Submit Execution'}
                    </button>
                </form>
            </div>
        </div>
    );
}
