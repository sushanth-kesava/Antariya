"use client";

import { useState } from "react";
import { Loader2, Mail, Check } from "lucide-react";
import { subscribeToNewsletter } from "@/lib/api/newsletter";

/**
 * Storefront newsletter signup. Drop into the footer or any marketing surface.
 * Posts to the public /newsletter/subscribe endpoint.
 */
export function NewsletterSignup({ source = "footer" }: { source?: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(trimmed)) {
      setStatus("error");
      setMessage("Please enter a valid email.");
      return;
    }
    try {
      setStatus("loading");
      const res = await subscribeToNewsletter(trimmed, undefined, source);
      setStatus("done");
      setMessage(res.message);
      setEmail("");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Failed to subscribe.");
    }
  };

  if (status === "done") {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600">
        <Check className="h-4 w-4" />
        <span>{message}</span>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="w-full">
      <p className="mb-2 flex items-center gap-2 text-sm font-medium">
        <Mail className="h-4 w-4" /> Join our newsletter
      </p>
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="h-10 flex-1 rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="inline-flex h-10 items-center gap-1 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Subscribe"}
        </button>
      </div>
      {status === "error" && <p className="mt-1.5 text-xs text-destructive">{message}</p>}
    </form>
  );
}
