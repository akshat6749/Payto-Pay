import { createFileRoute } from "@tanstack/react-router";
import { BalanceCard } from "../components/BalanceCard";
import { PayoutForm } from "../components/PayoutForm";
import { TransactionTable } from "../components/TransactionTable";
import { useMerchants } from "../hooks/usePayoutData";
import { useState, useEffect, useRef } from "react";
import type { Merchant } from "../api/client";
import 'react';

export const Route = createFileRoute("/dashboard")({
    component: DashboardPage,
});

function DarkModeToggle() {
    const [isDark, setIsDark] = useState(() => {
        return document.documentElement.classList.contains('dark');
    });

    useEffect(() => {
        if (isDark) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [isDark]);

    return (
        <button
            onClick={() => setIsDark(!isDark)}
            className="text-muted-foreground hover:text-foreground transition-colors hidden sm:flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-primary/20 h-8 w-8 border border-transparent hover:border-border"
        >
            <iconify-icon icon={isDark ? "lucide:sun" : "lucide:moon"} className="text-xl"></iconify-icon>
        </button>
    );
}

function MerchantSwitcher({ merchants, merchantId, setMerchantId, isLoading }: { merchants: Merchant[], merchantId: string, setMerchantId: (id: string) => void, isLoading: boolean }) {
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

    const activeMerchant = merchants.find(m => m.id === merchantId);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                disabled={isLoading}
                className={`flex items-center gap-2 hover:bg-muted p-1 pr-3 transition-all duration-200 border outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${isOpen ? 'bg-muted border-border' : 'border-transparent hover:border-border'}`}
            >
                <img
                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${merchantId}&backgroundColor=f8fafc`}
                    alt="Merchant Avatar"
                    className="h-8 w-8 border border-border object-cover bg-card p-0.5 mix-blend-luminosity hover:mix-blend-normal transition-all"
                />
                <span className="text-sm font-semibold hidden md:block text-foreground select-none font-mono tracking-widest uppercase">
                    {isLoading ? 'Loading...' : activeMerchant?.name || 'Select Merchant'}
                </span>
                <iconify-icon
                    icon="lucide:chevron-down"
                    className={`text-muted-foreground text-sm hidden md:block transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                ></iconify-icon>
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-[280px] bg-card border border-border z-50 transform origin-top-right transition-all">
                    <div className="px-3 py-2.5 border-b border-border bg-muted flex items-center justify-between">
                        <p className="text-[10px] font-bold text-muted-foreground font-mono uppercase tracking-widest">Switch Account</p>
                        <span className="text-[9px] font-mono font-medium px-2 py-0.5 bg-background border border-border text-muted-foreground">{merchants.length} Found</span>
                    </div>
                    <div className="max-h-[320px] overflow-y-auto p-1.5 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                        {merchants.map((m) => (
                            <button
                                key={m.id}
                                onClick={() => {
                                    setMerchantId(m.id);
                                    setIsOpen(false);
                                }}
                                className={`w-full text-left px-3 py-2.5 text-[11px] font-mono uppercase tracking-widest flex items-center gap-3 transition-all duration-150 ${m.id === merchantId
                                    ? 'bg-primary/5 text-primary border border-primary/20'
                                    : 'text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent'
                                    }`}
                            >
                                <img
                                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${m.id}&backgroundColor=f8fafc`}
                                    className="h-7 w-7 border border-border bg-card p-0.5 mix-blend-luminosity"
                                    alt=""
                                />
                                <span className="truncate flex-1">{m.name}</span>
                                {m.id === merchantId && (
                                    <iconify-icon icon="lucide:check" className="text-primary text-base"></iconify-icon>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function DashboardPage() {
    const { data: merchants = [], isLoading: isLoadingMerchants } = useMerchants();
    const [merchantId, setMerchantId] = useState<string>("");

    useEffect(() => {
        if (merchants.length > 0 && !merchantId) {
            // Auto-select the first merchant found dynamically
            setMerchantId(merchants[0].id);
        }
    }, [merchants, merchantId]);

    return (
        <div className="min-h-screen bg-mosaic text-foreground font-sans selection:bg-primary/20 flex flex-col transition-colors duration-200">
            {/* Header */}
            <header className="sticky top-0 z-40 w-full border-b border-border bg-card/90">
                <div className="w-full flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center gap-4">
                        <div className="bg-primary text-primary-foreground p-1.5 flex items-center justify-center border border-primary/20">
                            <iconify-icon icon="lucide:box" className="text-xl block"></iconify-icon>
                        </div>
                        <span className="font-mono text-[10px] uppercase tracking-widest text-primary font-bold hidden sm:block">Playto Pay System</span>
                    </div>

                    <div className="flex items-center gap-4">
                        <DarkModeToggle />
                        <MerchantSwitcher merchants={merchants} merchantId={merchantId} setMerchantId={setMerchantId} isLoading={isLoadingMerchants} />
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-8 space-y-px">
                {/* Page Title */}
                <div className="border border-border bg-card p-6 flex flex-col items-start gap-2">
                    <div className="border-l-2 border-[#9EFFBF] pl-3">
                        <h1 className="font-display text-4xl tracking-tight text-primary uppercase">Console.Root</h1>
                    </div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">SYSTEM &gt; BALANCES &gt; CONFIG // Active Module</p>
                </div>

                {!merchantId ? (
                    <div className="p-12 text-center text-muted-foreground border border-border bg-card flex flex-col items-center justify-center transition-colors duration-200">
                        <iconify-icon icon="lucide:loader-2" className="animate-spin text-3xl mb-4"></iconify-icon>
                        <span className="font-mono text-xs uppercase tracking-widest">Awaiting Identity Vector...</span>
                    </div>
                ) : (
                    <>
                        {/* Grid Layout for Ledger & Action */}
                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-px bg-border border-x border-border">
                            <div className="lg:col-span-3 flex flex-col bg-background">
                                <BalanceCard merchantId={merchantId} />
                            </div>
                            <div className="lg:col-span-2 flex flex-col bg-background">
                                <PayoutForm merchantId={merchantId} />
                            </div>
                        </div>

                        {/* Bottom Section (The History) */}
                        <div className="border border-border bg-card text-card-foreground transition-colors duration-200">
                            <TransactionTable merchantId={merchantId} />
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}
