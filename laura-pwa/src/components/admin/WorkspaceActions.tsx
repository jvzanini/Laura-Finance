"use client";

import { useState, useTransition } from "react";
import { suspendWorkspaceAction, reactivateWorkspaceAction } from "@/lib/actions/adminConfig";
import { Ban, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";

export function SuspendButton({ workspaceId }: { workspaceId: string }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const handleSuspend = () => {
        const reason = prompt("Motivo da suspensao:");
        if (!reason) return;
        startTransition(async () => {
            await suspendWorkspaceAction(workspaceId, reason);
            router.refresh();
        });
    };

    return (
        <button
            onClick={handleSuspend}
            disabled={isPending}
            className="h-7 px-2 rounded-md text-[10px] font-medium bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors flex items-center gap-1 disabled:opacity-50"
            title="Suspender workspace"
        >
            <Ban className="h-3 w-3" />
            {isPending ? "..." : "Suspender"}
        </button>
    );
}

export function ReactivateButton({ workspaceId }: { workspaceId: string }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const handleReactivate = () => {
        if (!confirm("Reativar este workspace?")) return;
        startTransition(async () => {
            await reactivateWorkspaceAction(workspaceId);
            router.refresh();
        });
    };

    return (
        <button
            onClick={handleReactivate}
            disabled={isPending}
            className="h-7 px-2 rounded-md text-[10px] font-medium bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors flex items-center gap-1 disabled:opacity-50"
            title="Reativar workspace"
        >
            <RotateCcw className="h-3 w-3" />
            {isPending ? "..." : "Reativar"}
        </button>
    );
}
