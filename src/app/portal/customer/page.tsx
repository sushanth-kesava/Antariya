import { Navbar } from "@/components/navbar";
import { personalizedProductRecommendations } from "@/ai/flows/personalized-product-recommendations-flow";
import CustomerDashboardClient from "./CustomerDashboardClient";

export default async function CustomerPortal() {
  // Simulate fetching personalized AI recommendations
  const recommendations = await personalizedProductRecommendations({
    userId: "customer-portal",
    browsingHistory: ["Floral patterns", "Zardosi design", "Silk threads"],
    pastPurchases: ["Machine needles", "10x10 Hoop"],
    currentQuery: "Premium embroidery designs for wedding garments"
  });

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col font-sans">
      <Navbar />
      <CustomerDashboardClient recommendations={recommendations} />
    </div>
  );
}
