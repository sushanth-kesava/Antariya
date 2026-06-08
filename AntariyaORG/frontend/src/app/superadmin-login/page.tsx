"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SuperAdminLoginPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/login?role=superadmin&next=/portal/superadmin&force=1");
  }, [router]);

  return null;
}
