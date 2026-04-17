import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { LandingPage } from "@/components/marketing/LandingPage";

export default async function IndexPage() {
    const session = await getSession();

    if (session) {
        redirect("/dashboard");
    }

    return <LandingPage />;
}
