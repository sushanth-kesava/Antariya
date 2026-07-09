"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, AlertTriangle, ShoppingBag, Package } from "lucide-react";
import { formatINR } from "@/lib/india";

type TransactionStatus = "success" | "failed" | "cancelled";

function normalizeStatus(value: string | null): TransactionStatus {
  if (value === "success" || value === "failed" || value === "cancelled") {
    return value;
  }
  // Any unknown / missing status is treated as a failure so users are never
  // shown a misleading success screen.
  return "failed";
}

function OrderStatusContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const status = normalizeStatus(searchParams.get("status"));
  const paymentId = searchParams.get("paymentId") || "";
  const orderId = searchParams.get("orderId") || "";
  const amountRaw = searchParams.get("amount");
  const amount = amountRaw && Number.isFinite(Number(amountRaw)) ? Number(amountRaw) : null;
  const reason = searchParams.get("reason") || "";

  const config = {
    success: {
      icon: CheckCircle2,
      iconClass: "text-green-600",
      ringClass: "bg-green-100",
      title: "Payment Successful",
      message: "Thank you for your order! Your payment has been received and your order is confirmed.",
    },
    failed: {
      icon: XCircle,
      iconClass: "text-red-600",
      ringClass: "bg-red-100",
      title: "Payment Failed",
      message: reason || "We couldn't process your payment. No amount has been charged. Please try again.",
    },
    cancelled: {
      icon: AlertTriangle,
      iconClass: "text-amber-600",
      ringClass: "bg-amber-100",
      title: "Payment Cancelled",
      message: "You cancelled the payment before it completed. Your order has not been placed.",
    },
  }[status];

  const Icon = config.icon;
  const showDetails = status === "success" && (paymentId || orderId || amount !== null);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl border shadow-xl p-8 text-center">
          <div className={`w-20 h-20 ${config.ringClass} rounded-full flex items-center justify-center mx-auto mb-6`}>
            <Icon className={`w-11 h-11 ${config.iconClass}`} />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">{config.title}</h1>
          <p className="text-gray-500 mb-6">{config.message}</p>

          {showDetails && (
            <div className="text-left bg-gray-50 rounded-2xl border p-4 mb-6 space-y-3">
              {amount !== null && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Amount Paid</span>
                  <span className="font-semibold text-gray-900">{formatINR(amount)}</span>
                </div>
              )}
              {paymentId && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Payment ID</span>
                  <span className="font-mono text-gray-900 break-all text-right ml-4">{paymentId}</span>
                </div>
              )}
              {orderId && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Order Ref</span>
                  <span className="font-mono text-gray-900 break-all text-right ml-4">{orderId}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-3">
            {status === "success" && (
              <Button asChild size="lg" className="w-full rounded-full">
                <Link href="/portal/customer">
                  <Package className="w-4 h-4 mr-2" />
                  View My Orders
                </Link>
              </Button>
            )}

            {(status === "failed" || status === "cancelled") && (
              <Button size="lg" className="w-full rounded-full" onClick={() => router.push("/cart")}>
                {status === "cancelled" ? "Back to Cart" : "Try Again"}
              </Button>
            )}

            <Button asChild variant="outline" size="lg" className="w-full rounded-full">
              <Link href="/">
                <ShoppingBag className="w-4 h-4 mr-2" />
                Continue Shopping
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OrderStatusPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex flex-col">
          <Navbar />
          <div className="flex-1 flex items-center justify-center p-4">
            <p className="text-gray-500">Loading your order status…</p>
          </div>
        </div>
      }
    >
      <OrderStatusContent />
    </Suspense>
  );
}
