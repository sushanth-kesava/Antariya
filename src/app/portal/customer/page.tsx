import { Navbar } from "@/components/navbar";
import { CURRENT_USER } from "@/app/lib/mock-data";
import { personalizedProductRecommendations } from "@/ai/flows/personalized-product-recommendations-flow";
import CustomerDashboardClient from "./CustomerDashboardClient";

export default async function CustomerPortal() {
  // Simulate fetching personalized AI recommendations
  const recommendations = await personalizedProductRecommendations({
    userId: CURRENT_USER.id,
    browsingHistory: ["Floral patterns", "Zardosi design", "Silk threads"],
    pastPurchases: ["Machine needles", "10x10 Hoop"],
    currentQuery: "Premium embroidery designs for wedding garments"
  });

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col font-sans">
      <Navbar />
      <CustomerDashboardClient user={CURRENT_USER} recommendations={recommendations} />
    </div>
  );
}
