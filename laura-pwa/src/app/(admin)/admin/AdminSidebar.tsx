"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
    LayoutDashboard,
    CreditCard,
    Brain,
    Tag,
    Target,
    Building2,
    BarChart3,
    MessageSquare,
    Users,
    Mail,
    Shield,
    ClipboardList,
    FileText,
    Settings,
    ArrowLeft,
    ShieldAlert,
    Landmark,
} from "lucide-react";

const sections = [
    {
        label: "Geral",
        items: [
            { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
            { title: "Workspaces", url: "/admin/workspaces", icon: Users },
            { title: "Audit Log", url: "/admin/audit-log", icon: ClipboardList },
        ],
    },
    {
        label: "Planos & IA",
        items: [
            { title: "Planos", url: "/admin/plans", icon: CreditCard },
            { title: "Config IA", url: "/admin/ai-config", icon: Brain },
        ],
    },
    {
        label: "Configuracoes",
        items: [
            { title: "Categorias e Subs", url: "/admin/categories", icon: Tag },
            { title: "Objetivos", url: "/admin/goal-templates", icon: Target },
            { title: "Financeiro", url: "/admin/financial-config", icon: Landmark },
            { title: "Operadoras", url: "/admin/processors", icon: Building2 },
            { title: "Score", url: "/admin/scoring", icon: BarChart3 },
        ],
    },
    {
        label: "Sistema",
        items: [
            { title: "WhatsApp", url: "/admin/whatsapp", icon: MessageSquare },
            { title: "Email", url: "/admin/email-config", icon: Mail },
            { title: "Seguranca", url: "/admin/security", icon: Shield },
            { title: "Sistema", url: "/admin/system", icon: Settings },
            { title: "API Docs", url: "/admin/api-docs", icon: FileText },
        ],
    },
];

export function AdminSidebar() {
    const pathname = usePathname();

    return (
        <aside className="w-64 shrink-0 border-r border-amber-500/20 bg-card/50 min-h-screen flex flex-col">
            {/* Header */}
            <div className="p-5 border-b border-border/50">
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 text-white font-black text-sm shadow-lg shadow-amber-500/20">
                        <ShieldAlert className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-amber-500">Super Admin</p>
                        <p className="text-[10px] text-muted-foreground">Laura Finance</p>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto p-3 space-y-5">
                {sections.map((section) => (
                    <div key={section.label}>
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-2 px-3">
                            {section.label}
                        </p>
                        <div className="space-y-0.5">
                            {section.items.map((item) => {
                                const isActive = item.url === "/admin"
                                    ? pathname === "/admin"
                                    : pathname.startsWith(item.url);
                                return (
                                    <Link
                                        key={item.url}
                                        href={item.url}
                                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                                            isActive
                                                ? "bg-amber-500/15 text-amber-500 font-semibold"
                                                : "text-muted-foreground hover:text-foreground hover:bg-accent"
                                        }`}
                                    >
                                        <item.icon className="h-4 w-4 shrink-0" />
                                        <span>{item.title}</span>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>

            {/* Footer */}
            <div className="p-3 border-t border-border/50">
                <Link
                    href="/dashboard"
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                    <ArrowLeft className="h-4 w-4 shrink-0" />
                    <span>Voltar ao Dashboard</span>
                </Link>
            </div>
        </aside>
    );
}
