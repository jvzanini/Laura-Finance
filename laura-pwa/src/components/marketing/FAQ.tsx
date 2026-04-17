"use client";

import { Accordion } from "@base-ui/react/accordion";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

type FaqItem = {
    question: string;
    answer: string;
};

const faqs: FaqItem[] = [
    {
        question: "Como funciona o trial de 7 dias?",
        answer:
            "Você cria a conta e ganha acesso completo por 7 dias, sem qualquer custo. Ao final, escolhe o plano ideal para a família — se preferir, pode encerrar antes, sem compromisso.",
    },
    {
        question: "Preciso cadastrar cartão de crédito para começar?",
        answer:
            "Não. O trial é liberado sem cartão. Você só adiciona uma forma de pagamento quando decidir continuar com um dos planos.",
    },
    {
        question: "Posso cancelar a qualquer momento?",
        answer:
            "Sim. O cancelamento é em um clique nas configurações da conta e tem efeito imediato, sem fidelidade nem multa.",
    },
    {
        question: "Meus dados financeiros ficam seguros?",
        answer:
            "Sim. Todos os dados são criptografados em trânsito e em repouso, e seguimos as melhores práticas de segurança da indústria para proteger suas informações.",
    },
    {
        question: "Posso compartilhar com minha família?",
        answer:
            "Sim. Laura suporta membros compartilhados — você convida quem quiser por e-mail, cada pessoa conversa pelo próprio WhatsApp e tudo se consolida na mesma conta. O plano VIP inclui até 6 membros; os demais têm limites menores.",
    },
    {
        question: "A Laura se conecta com meus bancos?",
        answer:
            "Sim. Com Open Finance, você conecta seus bancos principais e a Laura importa transações automaticamente, classificando tudo para você.",
    },
    {
        question: "Qual o suporte disponível?",
        answer:
            "Atendemos pelo próprio WhatsApp com resposta em horário comercial. Planos superiores têm prioridade no suporte para responder mais rápido.",
    },
    {
        question: "Está em conformidade com a LGPD?",
        answer:
            "Sim. Seguimos integralmente a LGPD: você tem controle total sobre seus dados, pode exportá-los ou solicitar exclusão a qualquer momento.",
    },
];

export function FAQ() {
    return (
        <section
            id="faq"
            aria-labelledby="faq-heading"
            className="relative py-20 sm:py-28"
        >
            <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
                <div className="text-center">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium uppercase tracking-wider text-violet-200 backdrop-blur-sm">
                        FAQ
                    </div>
                    <h2
                        id="faq-heading"
                        className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl"
                    >
                        Perguntas{" "}
                        <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-rose-300 bg-clip-text text-transparent">
                            frequentes
                        </span>
                    </h2>
                    <p className="mt-4 text-base text-zinc-300 sm:text-lg">
                        Respostas para as dúvidas mais comuns antes de começar.
                    </p>
                </div>

                <Accordion.Root
                    className="mt-12 flex flex-col gap-3"
                    defaultValue={[]}
                >
                    {faqs.map((item, i) => (
                        <Accordion.Item
                            key={i}
                            value={i}
                            className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm"
                        >
                            <Accordion.Header className="m-0">
                                <Accordion.Trigger
                                    className={cn(
                                        "group flex w-full min-h-12 items-center justify-between gap-4 px-5 py-4 text-left text-base font-medium text-white transition-colors",
                                        "hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60 focus-visible:ring-inset"
                                    )}
                                >
                                    <span>{item.question}</span>
                                    <ChevronDown
                                        aria-hidden
                                        className="size-5 shrink-0 text-zinc-400 transition-transform duration-200 group-data-[panel-open]:rotate-180"
                                    />
                                </Accordion.Trigger>
                            </Accordion.Header>
                            <Accordion.Panel
                                className={cn(
                                    "overflow-hidden text-sm text-zinc-300",
                                    "transition-[height] duration-250 ease-out",
                                    "h-[var(--accordion-panel-height)]",
                                    "data-[starting-style]:h-0 data-[ending-style]:h-0"
                                )}
                            >
                                <div className="px-5 pt-1 pb-5 leading-relaxed">
                                    {item.answer}
                                </div>
                            </Accordion.Panel>
                        </Accordion.Item>
                    ))}
                </Accordion.Root>
            </div>
        </section>
    );
}
