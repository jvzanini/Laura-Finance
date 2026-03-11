"use client";

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
} from "lucide-react";

const navMain = [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Transações", url: "/dashboard", icon: ArrowLeftRight },
    { title: "Cartões", url: "/dashboard", icon: CreditCard },
    { title: "Equipe", url: "/dashboard", icon: Users },
    { title: "Relatórios", url: "/dashboard", icon: BarChart3 },
];

export function AppSidebar() {
    const pathname = usePathname();

    return (
        <Sidebar collapsible="icon" className="border-r border-sidebar-border">
            {/* Header / Logo */}
            <SidebarHeader className="p-6">
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-black text-sm">
                        LF
                    </div>
                    <div className="flex flex-col group-data-[collapsible=icon]:hidden">
                        <span className="text-base font-bold tracking-tight">Laura Finance</span>
                        <span className="text-[11px] text-muted-foreground">Gestão Inteligente</span>
                    </div>
                </div>
            </SidebarHeader>

            {/* Main Navigation */}
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel className="text-[11px] uppercase tracking-widest text-muted-foreground/60 mb-1">
                        Navegação
                    </SidebarGroupLabel>
                    <SidebarMenu>
                        {navMain.map((item) => {
                            const isActive = pathname === item.url && item.title === "Dashboard";
                            return (
                                <SidebarMenuItem key={item.title}>
                                    <SidebarMenuButton
                                        isActive={isActive}
                                        tooltip={item.title}
                                        className={
                                            isActive
                                                ? "bg-primary/15 text-primary font-semibold hover:bg-primary/20"
                                                : "text-muted-foreground hover:text-foreground hover:bg-accent"
                                        }
                                    >
                                        <a href={item.url} className="flex items-center gap-3 w-full">
                                            <item.icon className="h-4 w-4 shrink-0" />
                                            <span>{item.title}</span>
                                        </a>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            );
                        })}
                    </SidebarMenu>
                </SidebarGroup>

                {/* WhatsApp shortcut */}
                <SidebarGroup className="mt-auto">
                    <SidebarGroupLabel className="text-[11px] uppercase tracking-widest text-muted-foreground/60 mb-1">
                        Atalhos
                    </SidebarGroupLabel>
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarMenuButton
                                tooltip="Falar com a Laura"
                                className="text-muted-foreground hover:text-foreground hover:bg-accent"
                            >
                                <a
                                    href="https://wa.me/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-3 w-full"
                                >
                                    <MessageCircle className="h-4 w-4 shrink-0 text-emerald-500" />
                                    <span>Falar com Laura</span>
                                </a>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarGroup>
            </SidebarContent>

            {/* Footer */}
            <SidebarFooter className="p-3">
                {/* Upgrade CTA */}
                <div className="group-data-[collapsible=icon]:hidden rounded-xl border border-primary/20 bg-primary/5 p-4 mb-3">
                    <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <span className="text-xs font-bold text-primary">PRO</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">
                        Desbloqueie limites ilimitados e IA avançada.
                    </p>
                    <a
                        href="#upgrade"
                        className="flex items-center justify-center w-full h-8 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
                    >
                        Assinar Agora
                    </a>
                </div>

                {/* Settings */}
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            isActive={pathname === "/settings"}
                            tooltip="Configurações"
                            className={
                                pathname === "/settings"
                                    ? "bg-primary/15 text-primary font-semibold"
                                    : "text-muted-foreground hover:text-foreground"
                            }
                        >
                            <a href="/settings" className="flex items-center gap-3 w-full">
                                <Settings className="h-4 w-4 shrink-0" />
                                <span>Configurações</span>
                            </a>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
        </Sidebar>
    );
}
