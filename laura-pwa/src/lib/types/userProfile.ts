// Types e constants do módulo de perfil de usuário.
//
// Vivem separados do actions/userProfile.ts porque um arquivo com
// "use server" no topo (Next 15/16) só pode exportar async functions —
// exportar type/const ali quebra a regra e gera runtime error
// "A 'use server' file can only export async functions".

export type UserSettings = {
    hideBalances: boolean;
    notifications: boolean;
    darkMode: boolean;
};

export const DEFAULT_SETTINGS: UserSettings = {
    hideBalances: false,
    notifications: true,
    darkMode: true,
};

export type UserProfile = {
    id: string;
    name: string;
    email: string;
    role: string; // "proprietário" | "administrador" | "membro" | "dependente"
    workspaceName: string;
    phoneNumber: string | null;
    emailVerified: boolean;
    settings: UserSettings;
};
