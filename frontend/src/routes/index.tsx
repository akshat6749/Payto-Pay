import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/")({
    component: LandingPage,
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
            className="text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center outline-none focus-visible:ring-1 focus-visible:ring-primary h-8 w-8 border border-transparent hover:border-border"
        >
            <iconify-icon icon={isDark ? "lucide:sun" : "lucide:moon"} className="text-xl"></iconify-icon>
        </button>
    );
}

function NetworkTopologyGraphic() {
    return (
        <div className="relative w-full aspect-square border border-border flex items-center justify-center overflow-hidden bg-card">
            <svg viewBox="0 0 400 400" className="w-full h-full max-w-[450px]">
                {/* Central Node */}
                <circle cx="200" cy="200" r="16" fill="var(--primary-color)" />

                {/* Orbit Path */}
                <circle cx="200" cy="200" r="140" fill="none" stroke="var(--border-color)" strokeWidth="1" strokeDasharray="4 4" />

                {/* Connecting Lines & Orbiting Nodes */}
                <g className="origin-center animate-[spin_20s_linear_infinite]">
                    <line x1="200" y1="200" x2="200" y2="60" stroke="var(--border-color)" strokeWidth="1" className="opacity-50" />
                    <circle cx="200" cy="60" r="6" fill="var(--fg-color)" />

                    <line x1="200" y1="200" x2="78.7" y2="270" stroke="var(--border-color)" strokeWidth="1" className="opacity-50" />
                    <circle cx="78.7" cy="270" r="6" fill="var(--fg-color)" />

                    <line x1="200" y1="200" x2="321.3" y2="270" stroke="var(--border-color)" strokeWidth="1" className="opacity-50" />
                    <circle cx="321.3" cy="270" r="6" fill="var(--fg-color)" />
                </g>
            </svg>
            <div className="absolute inset-0 block mix-blend-luminosity hover:mix-blend-normal transition-all duration-500 opacity-90 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at center, transparent 30%, var(--bg-color) 70%)' }}></div>
        </div>
    );
}

function LandingPage() {
    return (
        <div className="min-h-screen bg-mosaic text-foreground selection:bg-primary/20 flex flex-col transition-colors duration-200">
            {/* Technical Navigation */}
            <header className="sticky top-0 z-40 w-full border-b border-border bg-card/90 backdrop-blur-sm">
                <div className="w-full h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center gap-4">
                        <div className="w-8 h-8 bg-primary flex items-center justify-center">
                            <iconify-icon icon="lucide:box" className="text-primary-foreground text-sm"></iconify-icon>
                        </div>
                        <span className="font-mono text-[10px] uppercase tracking-widest text-primary font-bold">Playto Pay System</span>
                    </div>

                    <div className="flex items-center gap-3">
                        <DarkModeToggle />
                        <Link to="/dashboard" className="px-6 py-2.5 flex items-center border border-border font-mono text-xs uppercase tracking-widest hover:bg-muted font-bold transition-colors">
                            Dashboard
                        </Link>
                    </div>
                </div>
            </header>

            <main className="flex-1 w-full flex flex-col justify-center">
                {/* Hero Section */}
                <section className="w-full px-4 sm:px-6 lg:px-8 py-12 lg:py-16 grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-12 items-center flex-1">
                    <div className="space-y-4">
                        <h1 className="font-display text-[clamp(3.5rem,5.5vw,5.5rem)] tracking-tighter leading-[0.9] text-primary">
                            STRUCTURAL PAYMENT INFRASTRUCTURE.
                        </h1>
                        <div className="pl-4 border-l border-border mt-6">
                            <p className="font-mono text-[clamp(0.75rem,1.5vw,0.875rem)] uppercase tracking-widest text-muted-foreground leading-relaxed max-w-xl">
                                The unified payment operations platform. Manage balances, automate payouts, and process refunds instantly through one rigorous structural interface.
                            </p>
                        </div>
                        <div className="pt-6">
                            <Link to="/dashboard" className="inline-flex items-center gap-3 px-8 py-5 bg-primary text-primary-foreground font-mono text-xs uppercase tracking-widest hover:opacity-90 transition-opacity">
                                Initialize Console <iconify-icon icon="lucide:arrow-right"></iconify-icon>
                            </Link>
                        </div>
                    </div>
                    <div className="p-6 border border-border bg-card mx-auto w-full max-w-[600px]">
                        <NetworkTopologyGraphic />
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="w-full border-t border-border bg-card">
                <div className="w-full px-4 sm:px-6 lg:px-8 py-6 flex flex-col md:flex-row items-center justify-between gap-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    <div>
                        Created by <span className="font-bold text-foreground">Akshat Jaiswal</span>
                    </div>
                    <div className="flex items-center gap-6">
                        <a href="https://www.linkedin.com/in/akshat-jaiswal-122a57257/" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors flex items-center gap-2">
                            <iconify-icon icon="mdi:linkedin" className="text-sm"></iconify-icon> LinkedIn
                        </a>
                        <a href="https://github.com/akshat6749" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors flex items-center gap-2">
                            <iconify-icon icon="mdi:github" className="text-sm"></iconify-icon> GitHub
                        </a>
                    </div>
                </div>
            </footer>
        </div>
    );
}
