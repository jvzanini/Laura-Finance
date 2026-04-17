import { Suspense } from "react";
import { SignupWizard } from "@/components/features/SignupWizard";

export const metadata = {
    title: "Criar conta — Laura Finance",
    description: "Crie sua conta Laura em 3 passos com verificação por e-mail e WhatsApp.",
};

export default function RegisterPage() {
    return (
        <Suspense fallback={null}>
            <SignupWizard />
        </Suspense>
    );
}
