"use client";

import { useState, useRef, useEffect } from "react";
import { Settings, LogOut, User, ChevronDown } from "lucide-react";
import { fetchUserProfileAction } from "@/lib/actions/userProfile";

export function UserProfileDropdown() {
    const [isOpen, setIsOpen] = useState(false);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [initials, setInitials] = useState("");
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

    useEffect(() => {
        (async () => {
            const profile = await fetchUserProfileAction();
            if (profile) {
                setName(profile.name);
                setEmail(profile.email);
                setInitials(profile.name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase());
            }
        })();
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2.5 p-1.5 pr-3 rounded-full bg-card border border-border/50 hover:border-primary/40 hover:bg-accent transition-all duration-200 group"
            >
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground font-bold text-xs shadow-md group-hover:shadow-primary/30 transition-shadow duration-300">
                    {initials || "??"}
                </div>
                <span className="text-sm font-medium text-foreground hidden sm:inline-block">
                    {name || "Carregando..."}
                </span>
                <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 hidden sm:block ${isOpen ? "rotate-180" : ""}`} />
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-border/50 bg-card/95 backdrop-blur-xl shadow-2xl shadow-black/20 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-4 border-b border-border/30 bg-gradient-to-br from-primary/5 to-transparent">
                        <div className="flex items-center gap-3">
                            <div className="h-11 w-11 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground font-bold text-sm shadow-lg shadow-primary/20">
                                {initials || "??"}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold truncate">{name}</p>
                                <p className="text-xs text-muted-foreground truncate">{email}</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-1.5">
                        <a href="/settings" className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-foreground hover:bg-accent transition-colors" onClick={() => setIsOpen(false)}>
                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                <User className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                                <p className="font-medium text-sm">Meu Perfil</p>
                                <p className="text-[11px] text-muted-foreground">Configuracoes pessoais</p>
                            </div>
                        </a>
                        <a href="/settings" className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-foreground hover:bg-accent transition-colors" onClick={() => setIsOpen(false)}>
                            <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center">
                                <Settings className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div>
                                <p className="font-medium text-sm">Configuracoes</p>
                                <p className="text-[11px] text-muted-foreground">Preferencias e seguranca</p>
                            </div>
                        </a>
                    </div>

                    <div className="p-1.5 border-t border-border/30">
                        <a href="/api/auth/logout" className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors">
                            <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                                <LogOut className="h-4 w-4 text-destructive" />
                            </div>
                            <div>
                                <p className="font-medium text-sm">Sair</p>
                                <p className="text-[11px] text-muted-foreground">Encerrar sessao</p>
                            </div>
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
}
