"use client";

import { usePathname } from "next/navigation";
import { Link } from "lucide-react";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarProvider
} from "@/components/ui/sidebar"
import { Home, LineChart, CreditCard, Users, Settings } from "lucide-react"

// Menu items.
const items = [
    { title: "Dashboard", url: "/dashboard", icon: Home },
    // Mock pages that aren't implemented yet, visual placeholder
    { title: "Transações", url: "#", icon: LineChart },
    { title: "Cartões", url: "#", icon: CreditCard },
    { title: "Equipe", url: "#", icon: Users },
]

export function AppSidebar() {
    const pathname = usePathname();

    return (
        <Sidebar variant="sidebar" collapsible="icon">
            <SidebarHeader className="pt-6 pb-2 px-4">
                {/* Mocking the dynamic rendering of visual aspect of Sidebar Header/Logo */}
                <h2 className="text-xl font-black text-primary tracking-widest uppercase">Laura</h2>
            </SidebarHeader>
            <SidebarContent>
                <SidebarGroup>
                    <SidebarMenu>
                        {items.map((item) => (
                            <SidebarMenuItem key={item.title}>
                                <SidebarMenuButton isActive={pathname === item.url} className={pathname === item.url ? "bg-primary/20 text-primary border-r-4 border-primary rounded-none" : ""}>
                                    <a href={item.url} className="flex items-center gap-2">
                                        <item.icon />
                                        <span>{item.title}</span>
                                    </a>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                </SidebarGroup>
            </SidebarContent>
            <SidebarFooter>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton isActive={pathname === "/settings"}>
                            <a href="/settings" className="flex items-center gap-2">
                                <Settings />
                                <span>Configurações & LGPD</span>
                            </a>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
        </Sidebar>
    )
}
