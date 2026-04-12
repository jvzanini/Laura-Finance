"use server";

import { pool } from "@/lib/db";
import { getSession } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { callLauraGo } from "@/lib/apiClient";

type GoMemberItem = {
    id: string;
    name: string;
    phone_number: string;
    role: string;
};
type GoMembersResponse = { members: GoMemberItem[] | null };

export async function addPhoneAction(formData: FormData) {
    try {
        const session = await getSession();
        if (!session || !session.userId) {
            return { error: "Sem sessão ativa." };
        }

        const name = formData.get("name") as string;
        let phone_number = formData.get("phone_number") as string;
        const role = formData.get("role") as string;

        if (!name || !phone_number) {
            return { error: "Nome e Telefone são obrigatórios." };
        }

        // Normalização bruta do telefone (apenas números para bater com webhook e.164 formatação simples)
        phone_number = phone_number.replace(/\D/g, "");

        if (phone_number.length < 10) {
            return { error: "Número inválido. Insira código do país, DDD e telefone." };
        }

        // Validate number via the Laura-Go endpoint
        try {
            const validateRes = await fetch("http://127.0.0.1:8080/api/whatsapp/validate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone: phone_number })
            });

            if (!validateRes.ok) {
                const msg = await validateRes.json();
                return { error: msg.error || "Este número não possui WhatsApp associado ou foi digitado incorretamente." };
            }

            const data = await validateRes.json();
            if (data.jid) {
                phone_number = data.jid;
            }
        } catch (apiErr) {
            console.error("WhatsApp validation API failed:", apiErr);
            return { error: "Falha ao validar o número. A interface backend (Laura-Go) está offline ou inacessível." };
        }

        try {
            const goResp = await callLauraGo<{ id: string; success: boolean }>("/api/v1/members", {
                method: "POST",
                body: { name, phone_number, role: role || "membro" },
            });
            if (goResp) {
                revalidatePath("/dashboard");
                return { success: true };
            }
        } catch (goErr: any) {
            if (goErr?.status === 409) {
                return { error: "Este número já está em uso em um Workspace da Laura." };
            }
            console.warn("[phones:add] laura-go failed, fallback:", goErr);
        }

        const client = await pool.connect();
        try {
            const userRes = await client.query("SELECT workspace_id, role FROM users WHERE id = $1", [session.userId]);
            const { workspace_id, role: userRole } = userRes.rows[0];

            if (userRole !== "proprietário" && userRole !== "administrador") {
                return { error: "Sem privilégios suficientes para adicionar membros." };
            }

            const phoneExists = await client.query("SELECT id FROM phones WHERE phone_number = $1", [phone_number]);
            if (phoneExists.rowCount && phoneExists.rowCount > 0) {
                return { error: "Este número já está em uso em um Workspace da Laura." };
            }

            await client.query(
                `INSERT INTO phones (workspace_id, name, phone_number, role)
         VALUES ($1, $2, $3, $4)`,
                [workspace_id, name, phone_number, role || "membro"]
            );

        } finally {
            client.release();
        }

        revalidatePath("/dashboard");
        return { success: true };
    } catch (err) {
        console.error("DB Save Phone Error:", err);
        return { error: "Erro ao cadastrar autorização do número. " };
    }
}

export async function fetchPhonesAction() {
    try {
        const session = await getSession();
        if (!session || !session.userId) return { error: "Sem sessão." };

        try {
            const goResponse = await callLauraGo<GoMembersResponse>("/api/v1/members");
            if (goResponse) {
                return { phones: goResponse.members ?? [] };
            }
        } catch (err) {
            console.warn("[members] laura-go failed, fallback:", err);
        }

        const res = await pool.query(
            `SELECT p.id, p.name, p.phone_number, p.role 
             FROM phones p
             JOIN users u ON u.workspace_id = p.workspace_id
             WHERE u.id = $1
             ORDER BY p.created_at ASC`,
            [session.userId]
        );
        return { phones: res.rows };
    } catch (err) {
        console.error("Fetch phones error:", err);
        return { error: "Erro ao buscar membros." };
    }
}

export async function deletePhoneAction(id: string) {
    try {
        const session = await getSession();
        if (!session || !session.userId) return { error: "Acesso negado." };

        try {
            const goResp = await callLauraGo<{ success: boolean }>(`/api/v1/members/${id}`, {
                method: "DELETE",
            });
            if (goResp) {
                revalidatePath("/dashboard");
                return { success: true };
            }
        } catch (err) {
            console.warn("[phones:delete] laura-go failed, fallback:", err);
        }

        const client = await pool.connect();
        try {
            const userRes = await client.query("SELECT workspace_id, role FROM users WHERE id = $1", [session.userId]);
            const { workspace_id, role } = userRes.rows[0];

            if (role !== "proprietário" && role !== "administrador") {
                return { error: "Sem privilégios." };
            }

            await client.query("DELETE FROM phones WHERE id = $1 AND workspace_id = $2", [id, workspace_id]);
        } finally {
            client.release();
        }

        revalidatePath("/dashboard");
        return { success: true };
    } catch (err) {
        console.error("Delete phone error:", err);
        return { error: "Erro ao excluir." };
    }
}
