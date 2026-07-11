import { Suspense } from "react";
import CompleteProfileForm from "@/components/profile/complete-profile-form";

export default function CompleteProfilePage() {
  return (
    <Suspense fallback={null}>
      <CompleteProfileForm />
    </Suspense>
  );
}
