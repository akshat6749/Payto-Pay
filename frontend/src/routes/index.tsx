import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
    component: IndexPage,
});

function IndexPage() {
    return (
        <main className="flex flex-col items-center justify-center min-h-screen gap-4">
            <h1 className="text-4xl font-bold tracking-tight">
                Playto Pay
            </h1>
            <p className="text-gray-400 text-lg">
                Merchant Payout Dashboard — coming in Step 2
            </p>
        </main>
    );
}
