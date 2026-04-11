import { fetchFinancialScoreAction } from "@/lib/actions/financialScore";
import { FinancialScore } from "./FinancialScore";

export async function FinancialScoreCard() {
    const factors = await fetchFinancialScoreAction();
    return <FinancialScore factors={factors} />;
}
