import { Resend } from "resend";
import { pool } from "@/lib/db";

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) console.warn("[email] RESEND_API_KEY não configurada — emails não serão enviados");
const resend = new Resend(apiKey || "re_placeholder");

type TemplateVars = Record<string, string>;

async function getSenderFrom(): Promise<string> {
    try {
        const res = await pool.query("SELECT value FROM system_config WHERE key = 'sender_email'");
        const emailRes = await pool.query("SELECT value FROM system_config WHERE key = 'sender_name'");
        const email = res.rows[0]?.value ? JSON.parse(res.rows[0].value) : "laura@suaempresa.com";
        const name = emailRes.rows[0]?.value ? JSON.parse(emailRes.rows[0].value) : "Laura Finance";
        return `${name} <${email}>`;
    } catch {
        return "Laura Finance <laura@suaempresa.com>";
    }
}

async function getActiveTemplate(type: string): Promise<{ subject: string; html_body: string } | null> {
    try {
        const result = await pool.query(
            "SELECT subject, html_body FROM email_templates WHERE type = $1 AND active = TRUE LIMIT 1",
            [type]
        );
        if (result.rowCount === 0) return null;
        return result.rows[0];
    } catch {
        return null;
    }
}

function applyVars(template: string, vars: TemplateVars): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

export async function sendReceiptEmail(to: string, planName: string, amount: string) {
    try {
        const tpl = await getActiveTemplate("comprovante_pagamento");
        const vars: TemplateVars = { planName, amount };
        const subject = tpl ? applyVars(tpl.subject, vars) : "Seu Comprovante Laura Finance";
        const html = tpl ? applyVars(tpl.html_body, vars) : `
        <div>
          <h1>Bem-vindo à Laura Finance PRO! 🎉</h1>
          <p>Seu pagamento para o plano <strong>${escapeHtml(planName)}</strong> foi aprovado com sucesso.</p>
          <p>Valor faturado: <strong>${escapeHtml(amount)}</strong></p>
          <hr />
          <p>Você já pode desfrutar dos limites ilimitados da sua Inteligência Artificial no WhatsApp.</p>
          <br/>
          <p>Atenciosamente, Equipe Laura</p>
        </div>`;

        const data = await resend.emails.send({
            from: await getSenderFrom(),
            to: [to],
            subject,
            html,
        });
        console.log("E-mail enviado via Resend", data);
        return data;
    } catch (error) {
        console.error("Erro ao enviar e-mail", error);
        return null;
    }
}

export async function sendVerifyEmailEmail(to: string, verifyUrl: string, userName: string) {
    try {
        const tpl = await getActiveTemplate("verificacao_email");
        const vars: TemplateVars = { userName, verifyUrl };
        const subject = tpl ? applyVars(tpl.subject, vars) : "Confirme seu e-mail — Laura Finance";
        const html = tpl ? applyVars(tpl.html_body, vars) : `
        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #0A0A0F; color: #F4F4F5;">
          <h2 style="color: #7C3AED; margin-top: 0;">Bem-vindo, ${escapeHtml(userName)}! 🎉</h2>
          <p>Obrigado por criar sua conta na Laura Finance! Só falta confirmar seu e-mail para liberar todos os recursos.</p>
          <div style="margin: 32px 0; text-align: center;">
            <a href="${verifyUrl}" style="display: inline-block; padding: 12px 32px; background: #10B981; color: #FFFFFF; text-decoration: none; border-radius: 8px; font-weight: 600;">Confirmar e-mail</a>
          </div>
          <p style="font-size: 12px; color: #A1A1AA;">O link é válido por <strong>24 horas</strong>. Se você não criou esta conta, ignore esta mensagem.</p>
          <hr style="border: none; border-top: 1px solid #27272A; margin: 24px 0;" />
          <p style="font-size: 11px; color: #71717A;">Link completo: <br/><code style="word-break: break-all;">${verifyUrl}</code></p>
        </div>`;

        const data = await resend.emails.send({
            from: await getSenderFrom(),
            to: [to],
            subject,
            html,
        });
        console.log("E-mail de verificação enviado via Resend", data);
        return data;
    } catch (error) {
        console.error("Erro ao enviar e-mail de verificação", error);
        return null;
    }
}

export async function sendPasswordResetEmail(to: string, resetUrl: string, userName: string) {
    try {
        const tpl = await getActiveTemplate("reset_senha");
        const vars: TemplateVars = { userName, resetUrl };
        const subject = tpl ? applyVars(tpl.subject, vars) : "Recuperação de senha — Laura Finance";
        const html = tpl ? applyVars(tpl.html_body, vars) : `
        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #0A0A0F; color: #F4F4F5;">
          <h2 style="color: #7C3AED; margin-top: 0;">Olá, ${escapeHtml(userName)}! 👋</h2>
          <p>Recebemos uma solicitação para redefinir a senha da sua conta Laura Finance.</p>
          <p>Clique no botão abaixo para criar uma nova senha. O link é válido por <strong>30 minutos</strong>.</p>
          <div style="margin: 32px 0; text-align: center;">
            <a href="${resetUrl}" style="display: inline-block; padding: 12px 32px; background: #7C3AED; color: #FFFFFF; text-decoration: none; border-radius: 8px; font-weight: 600;">Redefinir senha</a>
          </div>
          <p style="font-size: 12px; color: #A1A1AA;">Se você não pediu esse reset, ignore este e-mail — sua senha continua segura.</p>
        </div>`;

        const data = await resend.emails.send({
            from: await getSenderFrom(),
            to: [to],
            subject,
            html,
        });
        console.log("E-mail de reset de senha enviado via Resend", data);
        return data;
    } catch (error) {
        console.error("Erro ao enviar e-mail de reset", error);
        return null;
    }
}

export async function sendWelcomeEmail(to: string, tempPassword: string, role: string) {
    try {
        const tpl = await getActiveTemplate("convite_membro");
        const vars: TemplateVars = { email: to, tempPassword, role };
        const subject = tpl ? applyVars(tpl.subject, vars) : "Acesso Liberado: Laura Finance";
        const html = tpl ? applyVars(tpl.html_body, vars) : `
        <div>
          <h2>Você foi convidado! 🥳</h2>
          <p>Um acesso como <strong>${escapeHtml(role)}</strong> foi provisionado para você.</p>
          <p>Sua credencial de primeiro acesso é:</p>
          <p>Login: ${escapeHtml(to)}</p>
          <p>Senha Temporária: <strong>${escapeHtml(tempPassword)}</strong></p>
          <hr />
          <p>Por favor, troque sua senha ao logar no painel PWA da Laura.</p>
        </div>`;

        const data = await resend.emails.send({
            from: await getSenderFrom(),
            to: [to],
            subject,
            html,
        });
        console.log("E-mail de boas-vindas enviado via Resend", data);
        return data;
    } catch (error) {
        console.error("Erro ao enviar e-mail de boa vindas", error);
        return null;
    }
}
