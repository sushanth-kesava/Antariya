"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  ShoppingCart,
  Package,
  ScanBarcode,
  ClipboardCheck,
  Headphones,
  Brain,
  Store,
  Tags,
  Wallet,
  ShieldCheck,
  Mail,
  Ticket,
  ScrollText,
  KeyRound,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { clearAuthSession } from "@/lib/auth-session";
import { ErpActor } from "@/lib/api/erp";
import { DashboardModule } from "./modules/DashboardModule";
import { GovernanceModule } from "./modules/GovernanceModule";
import { PeopleModule } from "./modules/PeopleModule";
import { HRModule } from "./modules/HRModule";
import { OrdersModule } from "./modules/OrdersModule";
import { InventoryModule } from "./modules/InventoryModule";
import { CatalogModule } from "./modules/CatalogModule";
import { FinanceModule } from "./modules/FinanceModule";
import { FinanceModuleV2 } from "./modules/FinanceModuleV2";
import { CommsModule } from "./modules/CommsModule";
import { CouponsModule } from "./modules/CouponsModule";
import { BarcodeModule } from "./modules/BarcodeModule";
import { QCModule } from "./modules/QCModule";
import { SupportModule } from "./modules/SupportModule";
import { ForecastModule } from "./modules/ForecastModule";
import { POSModule } from "./modules/POSModule";

type ErpUser = {
  id: string | null;
  email: string;
  displayName: string;
  photoURL: string | null;
  role: string;
};

type NavItem = {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Permission(s) that reveal this nav item. Empty = always visible. */
  anyOf?: string[];
};

const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "people", label: "HR / People", icon: Users, anyOf: ["hr.people.view", "hr.access_requests.view", "hr.permissions.override"] },
  { key: "orders", label: "Orders & Fulfillment", icon: ShoppingCart, anyOf: ["orders.view"] },
  { key: "pos", label: "Offline Store (POS)", icon: Store },
  { key: "inventory", label: "Inventory & Warehouses", icon: Package, anyOf: ["inventory.view"] },
  { key: "barcode", label: "Barcode & QR", icon: ScanBarcode, anyOf: ["inventory.view"] },
  { key: "qc", label: "Quality Control", icon: ClipboardCheck, anyOf: ["inventory.view"] },
  { key: "catalog", label: "Catalog / Products", icon: Tags, anyOf: ["catalog.view"] },
  { key: "finance", label: "Finance & Reports", icon: Wallet, anyOf: ["finance.view"] },
  { key: "comms", label: "Communications", icon: Mail, anyOf: ["comms.campaigns.view", "comms.templates.view", "comms.subscribers.view", "comms.logs.view"] },
  { key: "coupons", label: "Coupons & Offers", icon: Ticket },
  { key: "support", label: "Customer Support", icon: Headphones },
  { key: "forecast", label: "AI Forecasting", icon: Brain },
  { key: "governance", label: "Governance", icon: ShieldCheck, anyOf: ["governance.roles.view", "governance.audit.view", "governance.settings.manage"] },
];

export function ErpShell({
  token,
  user,
  actor,
}: {
  token: string;
  user: ErpUser;
  actor: ErpActor;
}) {
  const [active, setActive] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const permissionSet = useMemo(() => new Set(actor.permissions || []), [actor.permissions]);
  const has = (key: string) => permissionSet.has("*") || permissionSet.has(key);
  const canSee = (item: NavItem) => !item.anyOf || item.anyOf.some((p) => has(p));

  const visibleNav = NAV_ITEMS.filter(canSee);

  const handleLogout = () => {
    clearAuthSession();
    window.location.href = "/login";
  };

  const renderModule = () => {
    switch (active) {
      case "dashboard":
        return <DashboardModule token={token} actor={actor} onNavigate={setActive} />;
      case "governance":
        return <GovernanceModule token={token} has={has} />;
      case "people":
        return <HRModule token={token} has={has} />;
      case "orders":
        return <OrdersModule token={token} has={has} />;
      case "pos":
        return <POSModule token={token} has={has} />;
      case "inventory":
        return <InventoryModule token={token} has={has} />;
      case "barcode":
        return <BarcodeModule token={token} has={has} />;
      case "qc":
        return <QCModule token={token} has={has} />;
      case "catalog":
        return <CatalogModule token={token} has={has} />;
      case "finance":
        return <FinanceModuleV2 token={token} has={has} />;
      case "comms":
        return <CommsModule token={token} has={has} />;
      case "coupons":
        return <CouponsModule token={token} has={has} />;
      case "support":
        return <SupportModule token={token} has={has} />;
      case "forecast":
        return <ForecastModule token={token} has={has} />;
      default:
        return <DashboardModule token={token} actor={actor} onNavigate={setActive} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-muted/20">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 transform border-r bg-background transition-transform duration-200 md:static md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center gap-2 border-b px-5">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <div className="leading-tight">
            <p className="text-sm font-semibold">Antariya ERP</p>
            <p className="text-[11px] text-muted-foreground">Control Center</p>
          </div>
        </div>

        <nav className="flex flex-col gap-1 p-3">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.key;
            return (
              <button
                key={item.key}
                onClick={() => {
                  setActive(item.key);
                  setSidebarOpen(false);
                }}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto border-t p-3">
          <div className="mb-2 rounded-md bg-muted/50 px-3 py-2">
            <p className="truncate text-xs font-medium">{user.displayName}</p>
            <p className="truncate text-[11px] text-muted-foreground">{user.email}</p>
            <p className="mt-1 inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
              <KeyRound className="h-3 w-3" />
              {actor.isSuperadmin ? "Super Admin" : actor.roleKey || actor.role || "staff"}
            </p>
          </div>
          <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Backdrop for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur md:px-8">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setSidebarOpen((v) => !v)}
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <h1 className="text-lg font-semibold capitalize">
              {NAV_ITEMS.find((n) => n.key === active)?.label || "Dashboard"}
            </h1>
          </div>
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            View storefront →
          </Link>
        </header>

        <main className="flex-1 p-4 md:p-8">{renderModule()}</main>
      </div>
    </div>
  );
}
