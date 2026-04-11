import { fetchUserProfileAction } from "@/lib/actions/userProfile";
import { SettingsView } from "./SettingsView";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
    const profile = await fetchUserProfileAction();
    if (!profile) {
        redirect("/login");
    }
    return <SettingsView profile={profile} />;
}
