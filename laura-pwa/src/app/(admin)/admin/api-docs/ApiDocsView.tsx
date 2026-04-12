"use client";

import { useState } from "react";
import { Search, Copy, Check, ChevronDown, ChevronUp, Lock, ShieldAlert } from "lucide-react";

type Endpoint = {
    method: "GET" | "POST" | "PUT" | "DELETE";
    path: string;
    description: string;
    auth: "public" | "session" | "admin";
};

type Section = {
    name: string;
    endpoints: Endpoint[];
};

const METHOD_COLORS: Record<string, string> = {
    GET: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    POST: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    PUT: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    DELETE: "bg-red-500/15 text-red-400 border-red-500/30",
};

const SECTIONS: Section[] = [
    {
        name: "Health",
        endpoints: [
            { method: "GET", path: "/api/v1/health", description: "Status do serviço", auth: "public" },
        ],
    },
    {
        name: "Perfil & Sessão",
        endpoints: [
            { method: "GET", path: "/api/v1/me", description: "Dados do usuário autenticado", auth: "session" },
            { method: "PUT", path: "/api/v1/me/profile", description: "Atualizar nome e dados pessoais", auth: "session" },
            { method: "PUT", path: "/api/v1/me/settings", description: "Atualizar preferências do usuário", auth: "session" },
            { method: "PUT", path: "/api/v1/me/password", description: "Alterar senha", auth: "session" },
        ],
    },
    {
        name: "Categorias",
        endpoints: [
            { method: "GET", path: "/api/v1/categories", description: "Listar categorias do workspace", auth: "session" },
            { method: "POST", path: "/api/v1/categories", description: "Criar nova categoria", auth: "session" },
            { method: "POST", path: "/api/v1/categories/seed", description: "Popular categorias padrão (seed)", auth: "session" },
        ],
    },
    {
        name: "Cartões",
        endpoints: [
            { method: "GET", path: "/api/v1/cards", description: "Listar cartões do workspace", auth: "session" },
            { method: "POST", path: "/api/v1/cards", description: "Criar novo cartão", auth: "session" },
            { method: "DELETE", path: "/api/v1/cards/:id", description: "Excluir cartão", auth: "session" },
        ],
    },
    {
        name: "Transações",
        endpoints: [
            { method: "GET", path: "/api/v1/transactions", description: "Listar transações com filtros", auth: "session" },
            { method: "DELETE", path: "/api/v1/transactions/:id", description: "Excluir transação", auth: "session" },
            { method: "PUT", path: "/api/v1/transactions/:id/category", description: "Reclassificar categoria da transação", auth: "session" },
        ],
    },
    {
        name: "Objetivos",
        endpoints: [
            { method: "GET", path: "/api/v1/goals", description: "Listar metas financeiras", auth: "session" },
            { method: "POST", path: "/api/v1/goals", description: "Criar novo objetivo", auth: "session" },
        ],
    },
    {
        name: "Investimentos",
        endpoints: [
            { method: "GET", path: "/api/v1/investments", description: "Listar investimentos", auth: "session" },
            { method: "POST", path: "/api/v1/investments", description: "Registrar novo investimento", auth: "session" },
        ],
    },
    {
        name: "Faturas & Rolagem de Dívida",
        endpoints: [
            { method: "GET", path: "/api/v1/invoices", description: "Listar faturas do workspace", auth: "session" },
            { method: "POST", path: "/api/v1/invoices", description: "Criar fatura manual", auth: "session" },
            { method: "POST", path: "/api/v1/invoices/:id/pay", description: "Marcar fatura como paga", auth: "session" },
            { method: "GET", path: "/api/v1/debt-rollovers", description: "Listar rolagens de dívida", auth: "session" },
            { method: "POST", path: "/api/v1/debt-rollovers", description: "Registrar nova rolagem", auth: "session" },
        ],
    },
    {
        name: "Membros",
        endpoints: [
            { method: "GET", path: "/api/v1/members", description: "Listar membros do workspace", auth: "session" },
            { method: "POST", path: "/api/v1/members", description: "Convidar novo membro", auth: "session" },
            { method: "DELETE", path: "/api/v1/members/:id", description: "Remover membro", auth: "session" },
        ],
    },
    {
        name: "Score Financeiro",
        endpoints: [
            { method: "GET", path: "/api/v1/score/current", description: "Score atual do workspace", auth: "session" },
            { method: "GET", path: "/api/v1/score/history", description: "Histórico de snapshots do score", auth: "session" },
        ],
    },
    {
        name: "Operadoras",
        endpoints: [
            { method: "GET", path: "/api/v1/payment-processors", description: "Listar operadoras de pagamento", auth: "session" },
        ],
    },
    {
        name: "Relatórios",
        endpoints: [
            { method: "GET", path: "/api/v1/reports/dre", description: "Demonstrativo de Resultados (DRE)", auth: "session" },
            { method: "GET", path: "/api/v1/reports/categories", description: "Gastos por categoria", auth: "session" },
            { method: "GET", path: "/api/v1/reports/subcategories", description: "Gastos por subcategoria", auth: "session" },
            { method: "GET", path: "/api/v1/reports/cards", description: "Gastos por cartão", auth: "session" },
            { method: "GET", path: "/api/v1/reports/payment-methods", description: "Gastos por meio de pagamento", auth: "session" },
            { method: "GET", path: "/api/v1/reports/travel", description: "Relatório de viagens", auth: "session" },
            { method: "GET", path: "/api/v1/reports/comparative", description: "Comparativo mensal", auth: "session" },
            { method: "GET", path: "/api/v1/reports/trend", description: "Tendência de gastos", auth: "session" },
            { method: "GET", path: "/api/v1/reports/members", description: "Gastos por membro", auth: "session" },
        ],
    },
    {
        name: "Dashboard",
        endpoints: [
            { method: "GET", path: "/api/v1/dashboard/cashflow", description: "Fluxo de caixa do mês", auth: "session" },
            { method: "GET", path: "/api/v1/dashboard/upcoming-bills", description: "Contas a vencer", auth: "session" },
            { method: "GET", path: "/api/v1/dashboard/category-budgets", description: "Orçamento por categoria", auth: "session" },
        ],
    },
    {
        name: "Opções (Selects)",
        endpoints: [
            { method: "GET", path: "/api/v1/options/banks", description: "Bancos ativos para selects", auth: "session" },
            { method: "GET", path: "/api/v1/options/card-brands", description: "Bandeiras de cartão ativas", auth: "session" },
            { method: "GET", path: "/api/v1/options/brokers", description: "Corretoras ativas", auth: "session" },
            { method: "GET", path: "/api/v1/options/investment-types", description: "Tipos de investimento ativos", auth: "session" },
            { method: "GET", path: "/api/v1/options/goal-templates", description: "Templates de objetivos ativos", auth: "session" },
        ],
    },
    {
        name: "Admin — Overview",
        endpoints: [
            { method: "GET", path: "/api/v1/admin/overview", description: "Métricas gerais da plataforma", auth: "admin" },
        ],
    },
    {
        name: "Admin — Config Global",
        endpoints: [
            { method: "GET", path: "/api/v1/admin/config", description: "Listar todas as configurações", auth: "admin" },
            { method: "PUT", path: "/api/v1/admin/config/:key", description: "Atualizar configuração por chave", auth: "admin" },
        ],
    },
    {
        name: "Admin — Planos",
        endpoints: [
            { method: "GET", path: "/api/v1/admin/plans", description: "Listar planos de assinatura", auth: "admin" },
            { method: "PUT", path: "/api/v1/admin/plans/:slug", description: "Atualizar plano", auth: "admin" },
        ],
    },
    {
        name: "Admin — Operadoras",
        endpoints: [
            { method: "GET", path: "/api/v1/admin/processors", description: "Listar operadoras", auth: "admin" },
            { method: "POST", path: "/api/v1/admin/processors", description: "Criar operadora", auth: "admin" },
            { method: "PUT", path: "/api/v1/admin/processors/:id", description: "Atualizar operadora", auth: "admin" },
            { method: "DELETE", path: "/api/v1/admin/processors/:id", description: "Excluir operadora", auth: "admin" },
        ],
    },
    {
        name: "Admin — Category Templates",
        endpoints: [
            { method: "GET", path: "/api/v1/admin/category-templates", description: "Listar templates de categorias", auth: "admin" },
            { method: "POST", path: "/api/v1/admin/category-templates", description: "Criar template de categoria", auth: "admin" },
            { method: "PUT", path: "/api/v1/admin/category-templates/:id", description: "Atualizar template", auth: "admin" },
            { method: "DELETE", path: "/api/v1/admin/category-templates/:id", description: "Excluir template", auth: "admin" },
        ],
    },
    {
        name: "Admin — Options CRUD",
        endpoints: [
            { method: "GET", path: "/api/v1/admin/banks", description: "Listar bancos (todos)", auth: "admin" },
            { method: "POST", path: "/api/v1/admin/banks", description: "Criar banco", auth: "admin" },
            { method: "PUT", path: "/api/v1/admin/banks/:id", description: "Toggle ativo/inativo", auth: "admin" },
            { method: "DELETE", path: "/api/v1/admin/banks/:id", description: "Excluir banco", auth: "admin" },
            { method: "GET", path: "/api/v1/admin/card-brands", description: "Listar bandeiras", auth: "admin" },
            { method: "POST", path: "/api/v1/admin/card-brands", description: "Criar bandeira", auth: "admin" },
            { method: "PUT", path: "/api/v1/admin/card-brands/:id", description: "Toggle ativo/inativo", auth: "admin" },
            { method: "DELETE", path: "/api/v1/admin/card-brands/:id", description: "Excluir bandeira", auth: "admin" },
            { method: "GET", path: "/api/v1/admin/brokers", description: "Listar corretoras", auth: "admin" },
            { method: "POST", path: "/api/v1/admin/brokers", description: "Criar corretora", auth: "admin" },
            { method: "PUT", path: "/api/v1/admin/brokers/:id", description: "Toggle ativo/inativo", auth: "admin" },
            { method: "DELETE", path: "/api/v1/admin/brokers/:id", description: "Excluir corretora", auth: "admin" },
            { method: "GET", path: "/api/v1/admin/investment-types", description: "Listar tipos investimento", auth: "admin" },
            { method: "POST", path: "/api/v1/admin/investment-types", description: "Criar tipo investimento", auth: "admin" },
            { method: "PUT", path: "/api/v1/admin/investment-types/:id", description: "Toggle ativo/inativo", auth: "admin" },
            { method: "DELETE", path: "/api/v1/admin/investment-types/:id", description: "Excluir tipo", auth: "admin" },
            { method: "GET", path: "/api/v1/admin/goal-templates", description: "Listar templates objetivos", auth: "admin" },
            { method: "POST", path: "/api/v1/admin/goal-templates", description: "Criar template objetivo", auth: "admin" },
            { method: "PUT", path: "/api/v1/admin/goal-templates/:id", description: "Toggle ativo/inativo", auth: "admin" },
            { method: "DELETE", path: "/api/v1/admin/goal-templates/:id", description: "Excluir template", auth: "admin" },
        ],
    },
    {
        name: "Admin — Workspaces",
        endpoints: [
            { method: "GET", path: "/api/v1/admin/workspaces", description: "Listar todos os workspaces", auth: "admin" },
            { method: "PUT", path: "/api/v1/admin/workspaces/:id/suspend", description: "Suspender workspace", auth: "admin" },
            { method: "PUT", path: "/api/v1/admin/workspaces/:id/reactivate", description: "Reativar workspace", auth: "admin" },
        ],
    },
    {
        name: "Admin — Audit Log",
        endpoints: [
            { method: "GET", path: "/api/v1/admin/audit-log", description: "Listar log de auditoria", auth: "admin" },
        ],
    },
    {
        name: "Admin — WhatsApp",
        endpoints: [
            { method: "GET", path: "/api/v1/admin/whatsapp/instances", description: "Listar instâncias WhatsApp", auth: "admin" },
            { method: "POST", path: "/api/v1/admin/whatsapp/instances", description: "Criar nova instância", auth: "admin" },
            { method: "POST", path: "/api/v1/admin/whatsapp/instances/:id/connect", description: "Conectar instância", auth: "admin" },
            { method: "POST", path: "/api/v1/admin/whatsapp/instances/:id/disconnect", description: "Desconectar instância", auth: "admin" },
            { method: "GET", path: "/api/v1/admin/whatsapp/instances/:id/qr", description: "Obter QR code da instância", auth: "admin" },
            { method: "DELETE", path: "/api/v1/admin/whatsapp/instances/:id", description: "Excluir instância", auth: "admin" },
        ],
    },
];

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <button
            onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground opacity-0 group-hover/row:opacity-100 transition-opacity"
            title="Copiar path"
        >
            {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
        </button>
    );
}

export function ApiDocsView() {
    const [search, setSearch] = useState("");
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

    const filtered = SECTIONS.map(section => ({
        ...section,
        endpoints: section.endpoints.filter(ep =>
            !search || ep.path.toLowerCase().includes(search.toLowerCase()) ||
            ep.description.toLowerCase().includes(search.toLowerCase()) ||
            ep.method.toLowerCase().includes(search.toLowerCase())
        ),
    })).filter(s => s.endpoints.length > 0);

    const totalEndpoints = SECTIONS.reduce((s, sec) => s + sec.endpoints.length, 0);

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={`Buscar entre ${totalEndpoints} endpoints...`}
                        className="w-full h-9 pl-9 pr-3 rounded-lg bg-background border border-border text-sm"
                    />
                </div>
                <div className="flex gap-2">
                    {(["GET", "POST", "PUT", "DELETE"] as const).map(m => (
                        <button
                            key={m}
                            onClick={() => setSearch(search === m ? "" : m)}
                            className={`px-2 py-1 rounded text-[10px] font-bold border ${search === m ? METHOD_COLORS[m] : "border-border/30 text-muted-foreground hover:border-border"}`}
                        >
                            {m}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-zinc-500" /> Público</span>
                <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> Sessão</span>
                <span className="flex items-center gap-1"><ShieldAlert className="h-3 w-3 text-amber-500" /> Super Admin</span>
            </div>

            {filtered.map((section) => {
                const isCollapsed = collapsed[section.name];
                return (
                    <div key={section.name} className="rounded-xl border border-border/50 bg-card overflow-hidden">
                        <button
                            onClick={() => setCollapsed(prev => ({ ...prev, [section.name]: !isCollapsed }))}
                            className="w-full p-3 flex items-center gap-2 hover:bg-accent/10 transition-colors text-left"
                        >
                            {isCollapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
                            <span className="text-sm font-semibold flex-1">{section.name}</span>
                            <span className="text-[10px] text-muted-foreground">{section.endpoints.length} endpoint{section.endpoints.length !== 1 ? "s" : ""}</span>
                        </button>
                        {!isCollapsed && (
                            <div className="border-t border-border/20 divide-y divide-border/10">
                                {section.endpoints.map((ep, i) => (
                                    <div key={i} className="flex items-center gap-3 px-4 py-2 hover:bg-accent/5 transition-colors group/row">
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border min-w-[52px] text-center ${METHOD_COLORS[ep.method]}`}>
                                            {ep.method}
                                        </span>
                                        <code className="text-xs font-mono text-foreground flex-1">{ep.path}</code>
                                        <CopyButton text={ep.path} />
                                        <span className="text-[11px] text-muted-foreground hidden md:block max-w-[250px] truncate">{ep.description}</span>
                                        {ep.auth === "admin" && <ShieldAlert className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                                        {ep.auth === "session" && <Lock className="h-3.5 w-3.5 text-zinc-500 shrink-0" />}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}

            {filtered.length === 0 && (
                <div className="rounded-xl border border-border/50 bg-card p-8 text-center text-sm text-muted-foreground">
                    Nenhum endpoint encontrado para &quot;{search}&quot;
                </div>
            )}
        </div>
    );
}
