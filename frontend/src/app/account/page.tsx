import { Suspense } from "react";
import AccountProfile from "@/components/profile/account-profile";

export default function AccountPage() {
  return (
    <Suspense fallback={null}>
      <AccountProfile />
    </Suspense>
  );
}
