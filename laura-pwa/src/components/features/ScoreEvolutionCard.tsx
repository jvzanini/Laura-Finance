import { fetchScoreHistoryAction } from "@/lib/actions/scoreHistory";
import { ScoreEvolutionChart } from "./ScoreEvolutionChart";

export async function ScoreEvolutionCard() {
    const history = await fetchScoreHistoryAction(30);
    return <ScoreEvolutionChart history={history} />;
}
