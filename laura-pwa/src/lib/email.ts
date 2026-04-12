import { Resend } from "resend";
import { pool } from "@/lib/db";

const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) console.warn("[email] RESEND_API_KEY não configurada — emails não serão enviados");
const resend = new Resend(apiKey || "re_placeholder");

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

export async function sendReceiptEmail(to: string, planName: string, amount: string) {
    try {
        const data = await resend.emails.send({
            from: await getSenderFrom(),
            to: [to],
            subject: "Seu Comprovante Laura Finance",
            html: `
        <div>
          <h1>Bem-vindo à Laura Finance PRO! 🎉</h1>
          <p>Seu pagamento para o plano <strong>${planName}</strong> foi aprovado com sucesso.</p>
          <p>Valor faturado: <strong>${amount}</strong></p>
          <hr />
          <p>Você já pode desfrutar dos limites ilimitados da sua Inteligência Artificial no WhatsApp.</p>
          <br/>
          <p>Atenciosamente, Equipe Laura</p>
        </div>
      `,
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
        const data = await resend.emails.send({
            from: await getSenderFrom(),
            to: [to],
            subject: "Confirme seu e-mail — Laura Finance",
            html: `
        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #0A0A0F; color: #F4F4F5;">
          <h2 style="color: #7C3AED; margin-top: 0;">Bem-vindo, ${userName}! 🎉</h2>
          <p>Obrigado por criar sua conta na Laura Finance! Só falta confirmar seu e-mail para liberar todos os recursos.</p>
          <div style="margin: 32px 0; text-align: center;">
            <a href="${verifyUrl}"
               style="display: inline-block; padding: 12px 32px; background: #10B981; color: #FFFFFF; text-decoration: none; border-radius: 8px; font-weight: 600;">
              Confirmar e-mail
            </a>
          </div>
          <p style="font-size: 12px; color: #A1A1AA;">
            O link é válido por <strong>24 horas</strong>. Se você não criou esta conta, ignore esta mensagem.
          </p>
          <hr style="border: none; border-top: 1px solid #27272A; margin: 24px 0;" />
          <p style="font-size: 11px; color: #71717A;">
            Link completo: <br/>
            <code style="word-break: break-all;">${verifyUrl}</code>
          </p>
        </div>
      `,
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
        const data = await resend.emails.send({
            from: await getSenderFrom(),
            to: [to],
            subject: "Recuperação de senha — Laura Finance",
            html: `
        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #0A0A0F; color: #F4F4F5;">
          <h2 style="color: #7C3AED; margin-top: 0;">Olá, ${userName}! 👋</h2>
          <p>Recebemos uma solicitação para redefinir a senha da sua conta Laura Finance.</p>
          <p>Clique no botão abaixo para criar uma nova senha. O link é válido por <strong>30 minutos</strong>.</p>
          <div style="margin: 32px 0; text-align: center;">
            <a href="${resetUrl}"
               style="display: inline-block; padding: 12px 32px; background: #7C3AED; color: #FFFFFF; text-decoration: none; border-radius: 8px; font-weight: 600;">
              Redefinir senha
            </a>
          </div>
          <p style="font-size: 12px; color: #A1A1AA;">
            Se você não pediu esse reset, ignore este e-mail — sua senha continua segura.
            O link só funciona se aberto nos próximos 30 minutos a partir do envio.
          </p>
          <hr style="border: none; border-top: 1px solid #27272A; margin: 24px 0;" />
          <p style="font-size: 11px; color: #71717A;">
            Link completo (caso o botão não funcione): <br/>
            <code style="word-break: break-all;">${resetUrl}</code>
          </p>
        </div>
      `,
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
        const data = await resend.emails.send({
            from: await getSenderFrom(),
            to: [to],
            subject: "Acesso Liberado: Laura Finance",
            html: `
        <div>
          <h2>Você foi convidado! 🥳</h2>
          <p>Um acesso como <strong>${role}</strong> foi provisionado para você.</p>
          <p>Sua credencial de primeiro acesso é:</p>
          <p>Login: ${to}</p>
          <p>Senha Temporária: <strong>${tempPassword}</strong></p>
          <hr />
          <p>Por favor, troque sua senha ao logar no painel PWA da Laura.</p>
        </div>
      `,
        });
        console.log("E-mail de boas-vindas enviado via Resend", data);
        return data;
    } catch (error) {
        console.error("Erro ao enviar e-mail de boa vindas", error);
        return null;
    }
}
