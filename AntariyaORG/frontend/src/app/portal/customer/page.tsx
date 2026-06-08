import { Navbar } from "@/components/navbar";
import CustomerDashboardClient from "./CustomerDashboardClient";

export default function CustomerPortal() {

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col font-sans">
      <Navbar />
      <CustomerDashboardClient />
    </div>
  );
}
