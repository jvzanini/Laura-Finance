import { fetchPhonesAction } from "@/lib/actions/phones";
import { MembersView, type Member } from "./MembersView";

export default async function MembersPage() {
    const res = await fetchPhonesAction();
    const members: Member[] =
        "phones" in res && res.phones
            ? res.phones.map((p: { id: string; name: string; phone_number: string; role: string }) => ({
                  id: p.id,
                  name: p.name,
                  phone_number: p.phone_number,
                  role: p.role,
              }))
            : [];

    return <MembersView members={members} />;
}
