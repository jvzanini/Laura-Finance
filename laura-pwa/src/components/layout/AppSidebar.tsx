"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
    LayoutDashboard,
    ArrowLeftRight,
    CreditCard,
    Users,
    BarChart3,
    Settings,
    Sparkles,
    MessageCircle,
    Receipt,
    LogOut,
    Target,
    TrendingUp,
    Tag,
    Plane,
    ChevronDown,
    FileText,
    History,
    ArrowDownUp,
} from "lucide-react";

type NavItem = {
    title: string;
    url: string;
    icon: React.ElementType;
    submenu?: { title: string; url: string; icon: React.ElementType }[];
};

const navMain: NavItem[] = [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Transações", url: "/transactions", icon: ArrowLeftRight },
    { title: "Cartões", url: "/cards", icon: CreditCard },
    {
        title: "Faturas", url: "/invoices", icon: Receipt,
        submenu: [
            { title: "Todas as Faturas", url: "/invoices", icon: FileText },
            { title: "Empurrar", url: "/invoices/push", icon: ArrowDownUp },
            { title: "Histórico", url: "/invoices/history", icon: History },
        ],
    },
    { title: "Membros", url: "/members", icon: Users },
    { title: "Objetivos", url: "/goals", icon: Target },
    { title: "Investimentos", url: "/investments", icon: TrendingUp },
    { title: "Categorias", url: "/categories", icon: Tag },
    { title: "Relatórios", url: "/reports", icon: BarChart3 },
];

export function AppSidebar() {
    const pathname = usePathname();
    const [openSubmenus, setOpenSubmenus] = useState<Record<string, boolean>>({
        Faturas: pathname.startsWith("/invoices"),
    });

    const toggleSubmenu = (title: string) => {
        setOpenSubmenus((prev) => ({ ...prev, [title]: !prev[title] }));
    };

    return (
        <Sidebar collapsible="icon" className="border-r border-sidebar-border">
            <SidebarHeader className="p-6">
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-primary-foreground font-black text-sm shrink-0 shadow-lg shadow-primary/20">
                        LF
                    </div>
                    <div className="flex flex-col group-data-[collapsible=icon]:hidden">
                        <span className="text-base font-bold tracking-tight">Laura Finance</span>
                        <span className="text-[11px] text-muted-foreground">Gestão Inteligente</span>
                    </div>
                </div>
            </SidebarHeader>

            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel className="text-[11px] uppercase tracking-widest text-muted-foreground/60 mb-1">
                        Navegação
                    </SidebarGroupLabel>
                    <SidebarMenu>
                        {navMain.map((item) => {
                            const isActive = item.submenu
                                ? pathname.startsWith(item.url)
                                : pathname === item.url;
                            const hasSubmenu = !!item.submenu;
                            const isSubOpen = openSubmenus[item.title] || false;

                            return (
                                <div key={item.title}>
                                    <SidebarMenuItem>
                                        <SidebarMenuButton
                                            isActive={isActive}
                                            tooltip={item.title}
                                            className={
                                                isActive
                                                    ? "bg-primary/15 text-primary font-semibold hover:bg-primary/20"
                                                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                                            }
                                        >
                                            {hasSubmenu ? (
                                                <button
                                                    onClick={() => toggleSubmenu(item.title)}
                                                    className="flex items-center gap-3 w-full"
                                                >
                                                    <item.icon className="h-4 w-4 shrink-0" />
                                                    <span className="flex-1 text-left">{item.title}</span>
                                                    <ChevronDown
                                                        className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${
                                                            isSubOpen ? "rotate-180" : ""
                                                        }`}
                                                    />
                                                </button>
                                            ) : (
                                                <a href={item.url} className="flex items-center gap-3 w-full">
                                                    <item.icon className="h-4 w-4 shrink-0" />
                                                    <span>{item.title}</span>
                                                </a>
                                            )}
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>

                                    {/* Submenu Items */}
                                    {hasSubmenu && isSubOpen && (
                                        <div className="ml-4 pl-3 border-l border-border/30 space-y-0.5 mt-0.5 mb-1 group-data-[collapsible=icon]:hidden animate-in fade-in slide-in-from-top-1 duration-200">
                                            {item.submenu?.map((sub) => {
                                                const subActive = pathname === sub.url;
                                                return (
                                                    <SidebarMenuItem key={sub.url}>
                                                        <SidebarMenuButton
                                                            isActive={subActive}
                                                            className={`h-8 ${
                                                                subActive
                                                                    ? "bg-primary/10 text-primary font-medium"
                                                                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                                                            }`}
                                                        >
                                                            <a href={sub.url} className="flex items-center gap-2.5 w-full text-[13px]">
                                                                <sub.icon className="h-3.5 w-3.5 shrink-0" />
                                                                <span>{sub.title}</span>
                                                            </a>
                                                        </SidebarMenuButton>
                                                    </SidebarMenuItem>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </SidebarMenu>
                </SidebarGroup>

                {/* Travel Mode Toggle */}
                <SidebarGroup className="group-data-[collapsible=icon]:hidden">
                    <SidebarGroupLabel className="text-[11px] uppercase tracking-widest text-muted-foreground/60 mb-1">
                        Modo Especial
                    </SidebarGroupLabel>
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border/30 bg-background/50">
                                <Plane className="h-4 w-4 text-sky-400" />
                                <div className="flex-1">
                                    <p className="text-xs font-medium">Modo Viagem</p>
                                    <p className="text-[10px] text-muted-foreground">Gastos interpretados como viagem</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" />
                                    <div className="w-9 h-5 rounded-full bg-muted peer-checked:bg-sky-500 transition-colors duration-200 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
                                </label>
                            </div>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarGroup>

                <SidebarGroup className="mt-auto">
                    <SidebarGroupLabel className="text-[11px] uppercase tracking-widest text-muted-foreground/60 mb-1">
                        Atalhos
                    </SidebarGroupLabel>
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarMenuButton tooltip="Falar com a Laura" className="text-muted-foreground hover:text-foreground hover:bg-accent">
                                <a href="https://wa.me/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 w-full">
                                    <MessageCircle className="h-4 w-4 shrink-0 text-emerald-500" />
                                    <span>Falar com Laura</span>
                                </a>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarGroup>
            </SidebarContent>

            <SidebarFooter className="p-3">
                <div className="group-data-[collapsible=icon]:hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-4 mb-3">
                    <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <span className="text-xs font-bold text-primary">PRO</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">
                        Desbloqueie limites ilimitados e IA avançada.
                    </p>
                    <a href="#upgrade" className="flex items-center justify-center w-full h-8 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-md shadow-primary/20">
                        Assinar Agora
                    </a>
                </div>

                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton isActive={pathname === "/settings"} tooltip="Configurações" className={pathname === "/settings" ? "bg-primary/15 text-primary font-semibold" : "text-muted-foreground hover:text-foreground"}>
                            <a href="/settings" className="flex items-center gap-3 w-full">
                                <Settings className="h-4 w-4 shrink-0" />
                                <span>Configurações</span>
                            </a>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton tooltip="Sair" className="text-muted-foreground hover:text-destructive">
                            <a href="/api/auth/logout" className="flex items-center gap-3 w-full">
                                <LogOut className="h-4 w-4 shrink-0" />
                                <span>Sair</span>
                            </a>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
        </Sidebar>
    );
}
