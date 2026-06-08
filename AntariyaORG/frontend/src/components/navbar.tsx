"use client";

import Link from "next/link";
import { ShoppingCart, Search, User as UserIcon, Menu, Heart, Palette, ShoppingBag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { googleLogout } from "@react-oauth/google";
import { CART_UPDATED_EVENT, getCartItemCount } from "@/lib/cart";
import { clearAuthSession, getPortalPathForRole, normalizeAppRole, persistAuthSession } from "@/lib/auth-session";
import { getApiBaseUrl } from "@/lib/api/base-url";

type AuthUser = {
  role?: string;
  photoURL?: string | null;
  displayName?: string | null;
  email?: string | null;
};

const API_BASE_URL = getApiBaseUrl();

export function Navbar() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [cartCount, setCartCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const portalHref = user?.role ? getPortalPathForRole(user.role) : "/portal/customer";
  const logoHref = "/#hero";

  // Validate session against backend on mount.
  useEffect(() => {
    const loadUser = async () => {
      const token = localStorage.getItem("app_auth_token");

      if (!token) {
        clearAuthSession();
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
        });

        const data = await response.json();

        if (!response.ok || !data?.success || !data?.user) {
          clearAuthSession();
          setUser(null);
          setLoading(false);
          return;
        }

        const normalizedUser = {
          id: data.user.id,
          email: data.user.email,
          displayName: data.user.displayName,
          photoURL: data.user.photoURL || null,
          role: normalizeAppRole(data.user.role),
        };

        const sessionToken =
          typeof data.token === "string" && data.token.trim().length > 0 ? data.token : token;

        persistAuthSession(sessionToken, normalizedUser);
        setUser(normalizedUser);
      } catch {
        clearAuthSession();
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    void loadUser();
  }, []);

  useEffect(() => {
    const syncCartCount = () => {
      setCartCount(getCartItemCount());
    };

    syncCartCount();
    window.addEventListener(CART_UPDATED_EVENT, syncCartCount);
    window.addEventListener("storage", syncCartCount);

    return () => {
      window.removeEventListener(CART_UPDATED_EVENT, syncCartCount);
      window.removeEventListener("storage", syncCartCount);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const handleLogout = () => {
    googleLogout();
    setUser(null);
    clearAuthSession();
    setMobileOpen(false);
    router.replace("/");
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    setMobileSearchOpen(false);
    setMobileOpen(false);
    router.push(`/marketplace?search=${encodeURIComponent(q)}`);
    setSearchQuery("");
  };

  const navLinks = [
    { href: "/marketplace", label: "Marketplace", icon: null },
    { href: "/shop", label: "Shop", icon: <ShoppingBag className="h-4 w-4" /> },
    { href: "/customize", label: "Studio", icon: <Palette className="h-4 w-4" />, highlight: true },
  ];

  return (
    <>
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="w-full max-w-[1760px] mx-auto px-3 sm:px-4 lg:px-6 h-20 flex items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          <Link href={logoHref} className="flex items-center gap-2 group">
            <h1 className="font-theseasons text-5xl lg:text-5xl font-bold tracking-tight text-black leading-[1.1]">
              Antariya
            </h1> 
          </Link>
          
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Button
                key={link.href}
                variant="ghost"
                asChild
                className={`rounded-full px-5 font-bold ${link.highlight ? "text-primary hover:text-primary bg-primary/5 hover:bg-primary/10" : ""}`}
              >
                <Link href={link.href} className="flex items-center gap-2">
                  {link.icon}
                  {link.label}
                </Link>
              </Button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSearch} className="flex-1 max-w-md hidden lg:flex relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            className="pl-11 h-11 bg-muted/50 focus-visible:ring-primary border-none rounded-2xl" 
            placeholder="Search premium collections..." 
            ref={searchInputRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </form>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden rounded-full"
            onClick={() => setMobileSearchOpen((prev) => !prev)}
            aria-label="Toggle search"
          >
            <Search className="h-5 w-5" />
          </Button>
          
          <Button variant="ghost" size="icon" className="relative hidden sm:flex rounded-full">
            <Heart className="h-5 w-5" />
          </Button>

          <Link href="/cart">
            <Button variant="ghost" size="icon" className="relative rounded-full">
              <ShoppingCart className="h-5 w-5" />
              <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px] bg-secondary border-2 border-background" variant="default">
                {cartCount}
              </Badge>
            </Button>
          </Link>

          {!loading && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full overflow-hidden border p-0 h-10 w-10">
                  {user.photoURL ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon className="h-5 w-5" />
                  )}
                </Button>
              </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 rounded-2xl p-2 mt-2">
                <DropdownMenuLabel className="p-3">
                  <div className="flex flex-col">
                    <span className="font-bold text-lg">{user.displayName || "User"}</span>
                    <span className="text-xs font-normal text-muted-foreground">{user.email || "No email"}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                  <DropdownMenuItem asChild className="rounded-xl p-3 cursor-pointer">
                    <Link href={portalHref}>My Portal</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="rounded-xl p-3 cursor-pointer">
                  <Link href="/customize" className="text-primary font-bold">Build From Scratch</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive rounded-xl p-3 cursor-pointer font-bold">Logout</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : !loading ? (
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="sm" className="hidden sm:flex rounded-full px-6">
                <Link href="/login">Log In</Link>
              </Button>
              <Button asChild size="sm" className="rounded-full px-6 shadow-lg shadow-primary/20">
                <Link href="/signup">Sign Up</Link>
              </Button>
            </div>
          ) : (
            <div className="w-20 h-10 animate-pulse bg-muted rounded-full" />
          )}

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden rounded-full"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {mobileSearchOpen && (
        <div className="lg:hidden border-t px-4 py-3 bg-background">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                autoFocus
                className="pl-10 h-11 bg-muted/50 border-none rounded-2xl"
                placeholder="Search collections..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button type="submit" className="rounded-2xl h-11 px-5">Go</Button>
          </form>
        </div>
      )}
    </nav>

      {mobileOpen && (
        <div className="fixed inset-0 z-[100] md:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />

          <div className="absolute right-0 top-0 h-full w-80 max-w-[90vw] bg-background shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b">
              <span className="font-theseasons text-3xl font-bold">Antariya</span>
              <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setMobileOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            {user && (
              <div className="px-6 py-4 border-b bg-muted/30 flex items-center gap-3">
                {user.photoURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.photoURL} alt="Avatar" className="h-10 w-10 rounded-full object-cover border" />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <UserIcon className="h-5 w-5 text-primary" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-bold truncate">{user.displayName || "User"}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
              </div>
            )}

            <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-2xl font-semibold transition-colors ${link.highlight ? "text-primary bg-primary/5" : "hover:bg-muted"}`}
                >
                  {link.icon}
                  {link.label}
                </Link>
              ))}

              <div className="pt-4 border-t space-y-1">
                <Link
                  href="/cart"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl font-semibold hover:bg-muted transition-colors"
                >
                  <span className="flex items-center gap-3"><ShoppingCart className="h-4 w-4" /> Cart</span>
                  {cartCount > 0 && (
                    <Badge className="bg-secondary text-secondary-foreground rounded-full">{cartCount}</Badge>
                  )}
                </Link>
                {user ? (
                  <>
                    <Link
                      href={portalHref}
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 rounded-2xl font-semibold hover:bg-muted transition-colors"
                    >
                      <UserIcon className="h-4 w-4" /> My Portal
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-semibold text-destructive hover:bg-destructive/5 transition-colors text-left"
                    >
                      Logout
                    </button>
                  </>
                ) : (
                  <div className="px-4 py-2 flex flex-col gap-2">
                    <Button asChild className="rounded-2xl w-full">
                      <Link href="/login" onClick={() => setMobileOpen(false)}>Log In</Link>
                    </Button>
                    <Button asChild variant="outline" className="rounded-2xl w-full">
                      <Link href="/signup" onClick={() => setMobileOpen(false)}>Sign Up</Link>
                    </Button>
                  </div>
                )}
              </div>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
