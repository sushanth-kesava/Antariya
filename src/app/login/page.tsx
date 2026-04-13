import { Suspense } from "react";
import CommonAuthPage from "@/components/auth/common-auth-page";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <CommonAuthPage mode="login" />
    </Suspense>
  );
}
