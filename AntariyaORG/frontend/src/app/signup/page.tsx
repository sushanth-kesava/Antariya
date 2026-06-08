import { Suspense } from "react";
import CommonAuthPage from "@/components/auth/common-auth-page";

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <CommonAuthPage mode="signup" />
    </Suspense>
  );
}
