import { redirect } from "next/navigation";

export default function AdminPortalIndexPage() {
  redirect("/portal/admin/operations-overview");
}
