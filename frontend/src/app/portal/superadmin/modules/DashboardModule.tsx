"use client";

import { useEffect, useState } from "react";
import {
  Users,
  UserCog,
  Wallet,
  ShoppingCart,
  Package,
  Clock3,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatINR } from "@/lib/india";
import { getSuperAdminDashboardFromBackend, SuperAdminDashboardPayload } from "@/lib/api/superadmin";
import { ErpActor } from "@/lib/api/erp";

const CARDS: {
  key: keyof SuperAdminDashboardPayload["summary"];
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  money?: boolean;
}[] = [
  { key: "totalRevenue", label: "Total Revenue", icon: Wallet, money: true },
  { key: "totalOrders", label: "Orders", icon: ShoppingCart },
  { key: "totalCustomers", label: "Customers", icon: Users },
  { key: "totalAdmins", label: "Admins", icon: UserCog },
  { key: "pendingRequests", label: "Pending Requests", icon: Clock3 },
  { key: "lowStockProducts", label: "Low-stock Products", icon: Package },
];

export function DashboardModule({
  token,
  actor,
  onNavigate,
}: {
  token: string;
  actor: ErpActor;
  onNavigate: (key: string) => void;
}) {
  const [dashboard, setDashboard] = useState<SuperAdminDashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSuperAdminDashboardFromBackend(token)
      .then(setDashboard)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load dashboard"));
  }, [token]);

  const summary = dashboard?.summary;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-gradient-to-r from-primary/10 to-transparent p-5">
        <div className="flex items-center gap-2 text-primary">
          <ShieldCheck className="h-5 w-5" />
          <span className="text-sm font-semibold uppercase tracking-wide">Control Center</span>
        </div>
        <h2 className="mt-1 text-2xl font-bold">Welcome back, {actor.displayName || "Admin"}</h2>
        <p className="text-sm text-muted-foreground">
          You have {actor.isSuperadmin ? "full" : `${actor.permissions.length}`} permission
          {actor.isSuperadmin ? "" : "s"} across the ERP.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {CARDS.map((card) => {
          const Icon = card.icon;
          const value = summary ? summary[card.key] : undefined;
          return (
            <Card key={card.key}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.label}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {value === undefined
                    ? "—"
                    : card.money
                    ? formatINR(Number(value))
                    : Number(value).toLocaleString("en-IN")}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <QuickAction
          title="Manage People & Permissions"
          description="Assign roles, grant or deny individual permissions, review access requests."
          onClick={() => onNavigate("people")}
        />
        <QuickAction
          title="Governance & Roles"
          description="Edit role permission sets, create custom roles, review the audit trail."
          onClick={() => onNavigate("governance")}
        />
      </div>
    </div>
  );
}

function QuickAction({
  title,
  description,
  onClick,
}: {
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex items-start justify-between gap-4 rounded-xl border bg-background p-5 text-left transition-colors hover:border-primary/50 hover:bg-muted/40"
    >
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
    </button>
  );
}
