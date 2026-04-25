"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LauraBrandMark } from "@/components/brand/LauraBrandMark";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
    SheetClose,
} from "@/components/ui/sheet";

const navLinks = [
    { href: "#pilar-assistente", label: "Pilares" },
    { href: "#planos", label: "Planos" },
    { href: "#depoimentos", label: "Depoimentos" },
    { href: "#faq", label: "FAQ" },
];

export function MarketingNavbar() {
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const onScroll = () => {
            setScrolled(window.scrollY > 50);
        };
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    return (
        <header
            className={cn(
                "sticky top-0 z-50 w-full border-b transition-all duration-200",
                scrolled
                    ? "border-white/10 bg-[#0A0A0F]/80 backdrop-blur-xl"
                    : "border-transparent bg-transparent"
            )}
        >
            <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
                <Link
                    href="/"
                    aria-label="Ir para a página inicial da Laura Finance"
                    className="flex min-h-11 items-center rounded-lg px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60"
                >
                    <LauraBrandMark variant="navbar" />
                </Link>

                <nav className="hidden items-center gap-1 md:flex">
                    {navLinks.map((link) => (
                        <a
                            key={link.href}
                            href={link.href}
                            className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-zinc-300 transition-colors hover:text-white"
                        >
                            {link.label}
                        </a>
                    ))}
                </nav>

                <div className="hidden items-center gap-2 md:flex">
                    <Link href="/login">
                        <Button
                            variant="outline"
                            className="min-h-11 border-violet-400/60 bg-transparent px-4 text-sm font-medium text-violet-100 transition hover:border-violet-300 hover:bg-violet-500/15 hover:text-white"
                        >
                            Entrar
                        </Button>
                    </Link>
                    <Link href="/register">
                        <Button className="min-h-11 bg-gradient-to-r from-violet-600 to-fuchsia-500 px-4 text-sm font-semibold text-white shadow-lg shadow-violet-600/30 hover:from-violet-500 hover:to-fuchsia-400">
                            Começar grátis
                        </Button>
                    </Link>
                </div>

                <Sheet>
                    <SheetTrigger
                        render={
                            <Button
                                variant="ghost"
                                size="icon-lg"
                                aria-label="Abrir menu de navegação"
                                className="h-11 w-11 md:hidden"
                            />
                        }
                    >
                        <Menu className="size-5" />
                    </SheetTrigger>
                    <SheetContent
                        side="right"
                        className="border-white/10 bg-[#0A0A0F]"
                    >
                        <SheetHeader>
                            <SheetTitle className="flex items-center">
                                <LauraBrandMark variant="navbar" />
                            </SheetTitle>
                        </SheetHeader>
                        <div className="flex flex-col gap-1 px-4">
                            {navLinks.map((link) => (
                                <SheetClose
                                    key={link.href}
                                    render={
                                        <a
                                            href={link.href}
                                            className="inline-flex min-h-11 items-center rounded-lg px-3 text-base font-medium text-zinc-200 transition-colors hover:bg-white/5 hover:text-white"
                                        >
                                            {link.label}
                                        </a>
                                    }
                                />
                            ))}
                        </div>
                        <div className="mt-4 flex flex-col gap-2 px-4">
                            <Link href="/login" className="w-full">
                                <Button
                                    variant="ghost"
                                    className="min-h-11 w-full justify-center text-zinc-200 hover:bg-white/5"
                                >
                                    Entrar
                                </Button>
                            </Link>
                            <Link href="/register" className="w-full">
                                <Button className="min-h-11 w-full justify-center bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white hover:from-violet-500 hover:to-fuchsia-400">
                                    Começar grátis
                                </Button>
                            </Link>
                        </div>
                    </SheetContent>
                </Sheet>
            </div>
        </header>
    );
}
