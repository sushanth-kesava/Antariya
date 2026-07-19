"use client";

import { useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Package, ArrowRight } from "lucide-react";

export default function TrackOrder() {
  const [submitted, setSubmitted] = useState(false);
  const [searchType, setSearchType] = useState<"order-id" | "email">("order-id");
  const [value, setValue] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      setSubmitted(true);
      // Reset after showing message
      setTimeout(() => {
        setValue("");
        setSubmitted(false);
      }, 5000);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      
      <main className="flex-1 flex items-center justify-center px-4 py-20">
        <div className="w-full max-w-2xl">
          {!submitted ? (
            <div className="space-y-8">
              {/* Icon */}
              <div className="flex justify-center">
                <div className="w-24 h-24 bg-gradient-to-br from-primary/20 to-primary/5 rounded-3xl flex items-center justify-center border border-primary/30">
                  <Package className="h-12 w-12 text-primary" />
                </div>
              </div>

              {/* Header */}
              <div className="text-center space-y-4">
                <h1 className="text-4xl lg:text-5xl font-bold font-theseasons tracking-tight">
                  Track Your Order
                </h1>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Enter your Order ID or email address to track your shipment in real-time.
                </p>
              </div>

              {/* Form Card */}
              <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Toggle Search Type */}
                  <div className="flex gap-4 p-1 bg-muted rounded-full">
                    <button
                      type="button"
                      onClick={() => { setSearchType("order-id"); setValue(""); }}
                      className={`flex-1 py-2 px-4 rounded-full font-semibold transition-all ${
                        searchType === "order-id"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Order ID
                    </button>
                    <button
                      type="button"
                      onClick={() => { setSearchType("email"); setValue(""); }}
                      className={`flex-1 py-2 px-4 rounded-full font-semibold transition-all ${
                        searchType === "email"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Email
                    </button>
                  </div>

                  {/* Input Field */}
                  <div className="space-y-3">
                    <Label htmlFor="search" className="text-base font-semibold">
                      {searchType === "order-id" ? "Order ID" : "Email Address"}
                    </Label>
                    <Input
                      id="search"
                      type={searchType === "email" ? "email" : "text"}
                      placeholder={
                        searchType === "order-id"
                          ? "e.g., ANT-2026-001234"
                          : "e.g., your@email.com"
                      }
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      className="h-12 text-base rounded-xl border-border"
                    />
                  </div>

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full rounded-xl font-semibold h-12"
                    disabled={!value.trim()}
                  >
                    Track Order
                  </Button>
                </form>
              </div>

              {/* Info */}
              <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 space-y-3">
                <p className="text-sm font-semibold text-foreground">Don't have an order ID?</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Your order ID was sent to your email when you placed the order. Check your inbox or spam folder for the confirmation email.
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center space-y-8 animate-fade-in">
              <div className="flex justify-center">
                <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center">
                  <Package className="h-10 w-10 text-amber-600" />
                </div>
              </div>
              
              <div className="space-y-4">
                <h2 className="text-3xl font-bold font-theseasons">Detailed Tracking Coming</h2>
                <p className="text-lg text-muted-foreground">
                  To access comprehensive order tracking, order history, and manage your account, please log in to your customer portal.
                </p>
              </div>

              <div className="space-y-4">
                <p className="text-sm text-muted-foreground font-medium">Your portal provides:</p>
                <ul className="space-y-2 text-left max-w-md mx-auto text-sm text-muted-foreground">
                  <li className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-primary rounded-full" />
                    <span>Real-time shipment tracking</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-primary rounded-full" />
                    <span>Order history and invoices</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-primary rounded-full" />
                    <span>Saved wishlist items</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-primary rounded-full" />
                    <span>Support ticket management</span>
                  </li>
                </ul>
              </div>

              <Button asChild size="lg" className="rounded-full px-8 inline-flex gap-2">
                <Link href="/portal/customer">
                  Go to Customer Portal
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>

              <Button
                variant="outline"
                onClick={() => { setSubmitted(false); setValue(""); }}
                className="rounded-full px-6"
              >
                Search Another Order
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
