"use client";

import { useEffect } from "react";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("[Global Error Boundary]", error);
    }, [error]);

    return (
        <html lang="pt-BR">
            <body style={{
                margin: 0,
                minHeight: "100vh",
                background: "#0A0A0F",
                color: "#FFFFFF",
                fontFamily: "system-ui, -apple-system, sans-serif",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "2rem",
            }}>
                <div style={{
                    maxWidth: "28rem",
                    width: "100%",
                    padding: "2rem",
                    borderRadius: "1rem",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    background: "#18181B",
                }}>
                    <h1 style={{ marginTop: 0, color: "#EF4444", fontSize: "1.25rem" }}>
                        Erro fatal na aplicação
                    </h1>
                    <p style={{ color: "#A1A1AA", fontSize: "0.875rem", marginBottom: "1.5rem" }}>
                        Alguma coisa quebrou antes mesmo do layout carregar. Se o problema
                        persistir, dá uma olhada no console do navegador pra mais detalhes.
                    </p>
                    {error.message && (
                        <pre style={{
                            background: "rgba(239, 68, 68, 0.1)",
                            color: "#EF4444",
                            padding: "0.75rem",
                            borderRadius: "0.375rem",
                            fontSize: "0.75rem",
                            overflow: "auto",
                            margin: "0 0 1rem 0",
                        }}>
                            {error.message}
                        </pre>
                    )}
                    <button
                        onClick={reset}
                        style={{
                            width: "100%",
                            padding: "0.625rem 1rem",
                            background: "#7C3AED",
                            color: "#FFFFFF",
                            border: "none",
                            borderRadius: "0.5rem",
                            cursor: "pointer",
                            fontWeight: 600,
                        }}
                    >
                        Tentar novamente
                    </button>
                </div>
            </body>
        </html>
    );
}
