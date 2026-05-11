"use client";

import { Suspense } from "react";
import MarketplaceContent from "@/app/marketplace/MarketplaceContent";

function MarketplaceLoading() {
  return (
    <div className="w-full h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  );
}

export default function Marketplace() {
  return (
    <Suspense fallback={<MarketplaceLoading />}>
      <MarketplaceContent />
    </Suspense>
  );
}
