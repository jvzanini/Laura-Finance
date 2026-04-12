import { ApiDocsView } from "./ApiDocsView";
import { FileText } from "lucide-react";

export default function ApiDocsPage() {
    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Documentação da API</h1>
                    <p className="text-sm text-muted-foreground">Referência completa dos endpoints REST do laura-go</p>
                </div>
            </div>
            <ApiDocsView />
        </div>
    );
}
