"use client";

import Link from "next/link";
import { ShoppingCart, Search, User as UserIcon, Menu, Heart, X, Home, Grid3X3, ShoppingBag } from "lucide-react";
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
import { useRouter, usePathname } from "next/navigation";
import { googleLogout } from "@react-oauth/google";
import { CART_UPDATED_EVENT, getCartItemCount } from "@/lib/cart";
import { clearAuthSession, getPortalPathForRole } from "@/lib/auth-session";
import { useAuth } from "@/context/AuthContext";
import { ProfileSidebar } from "@/components/profile-sidebar";

type NavbarProps = {
  /**
   * Keep the navbar in normal document flow until it reaches the viewport top.
   * This lets a page place a banner above it without the navbar overlapping it.
   */
  sticky?: boolean;
};

export function Navbar({ sticky = false }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, setUser } = useAuth();
  const [cartCount, setCartCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const portalHref = user?.role ? getPortalPathForRole(user.role) : "/portal/customer";
  const logoHref = "/";
  const isTransparent = false;

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

  useEffect(() => {
    const openProfile = () => setProfileOpen(true);
    window.addEventListener("antariya-open-profile", openProfile);
    return () => window.removeEventListener("antariya-open-profile", openProfile);
  }, []);

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
    { href: "/shop", label: "Shop" },
    { href: "/marketplace?sort=newest", label: "New Arrivals" },
    { href: "/marketplace?sort=bestsellers", label: "Best Sellers" },
    { href: "/marketplace", label: "Collections" },
    { href: "/about", label: "About" },
  ];

  return (
    <>
      {/* DESKTOP + TABLET NAV */}
      <nav
        className={`${sticky ? "sticky" : "fixed"} top-0 left-0 right-0 z-50 bg-background border-b border-border/60 shadow-[0_1px_10px_rgba(0,0,0,0.06)] transition-all duration-300 ${
          isTransparent
            ? "bg-transparent border-b border-transparent"
            : ""
        }`}
      >
        <div className="w-full max-w-[1760px] mx-auto px-4 sm:px-6 lg:px-8 h-16 lg:h-[72px] flex items-center justify-between">
          {/* Left: Logo + Nav Links */}
          <div className="flex items-center gap-8 lg:gap-10">
            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden rounded-full"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className={`h-5 w-5 ${isTransparent ? "text-white" : ""}`} />
            </Button>

            {/* Logo */}
            <Link href={logoHref} className="flex items-center">
              <h1 className={`font-theseasons text-3xl lg:text-[2.2rem] font-bold tracking-tight leading-[1.1] transition-colors ${
                isTransparent ? "text-white" : "text-foreground"
              }`}>
                Antariya
              </h1>
            </Link>

            {/* Desktop Nav Links */}
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-4 py-2 text-[13px] font-medium tracking-wide uppercase transition-colors rounded-full hover:bg-white/10 ${
                    isTransparent
                      ? "text-white/80 hover:text-white"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Right: Search, Wishlist, Account, Cart */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Desktop Search */}
            <form onSubmit={handleSearch} className="hidden lg:flex relative">
              <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 ${
                isTransparent ? "text-white/50" : "text-muted-foreground"
              }`} />
              <Input
                className={`pl-10 h-10 w-48 xl:w-56 border-none rounded-full text-sm ${
                  isTransparent
                    ? "bg-white/10 text-white placeholder:text-white/40 focus-visible:ring-white/30"
                    : "bg-muted/40 focus-visible:ring-primary"
                }`}
                placeholder="Search..."
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </form>

            {/* Mobile Search Toggle */}
            <Button
              variant="ghost"
              size="icon"
              className={`lg:hidden rounded-full ${isTransparent ? "text-white hover:bg-white/10" : ""}`}
              onClick={() => setMobileSearchOpen((prev) => !prev)}
              aria-label="Search"
            >
              <Search className="h-5 w-5" />
            </Button>

            {/* Wishlist — hidden on mobile (available in bottom nav) */}
            <Link href="/wishlist" aria-label="Wishlist" className="hidden sm:flex">
              <Button
                variant="ghost"
                size="icon"
                className={`rounded-full ${isTransparent ? "text-white hover:bg-white/10" : ""}`}
                aria-label="Wishlist"
              >
                <Heart className="h-5 w-5" />
              </Button>
            </Link>

            {/* Account */}
            {!loading && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`rounded-full overflow-hidden border p-0 h-9 w-9 shrink-0 hidden sm:flex ${
                      isTransparent ? "border-white/20" : "border-border/50"
                    }`}
                  >
                    {user.photoURL ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={user.photoURL}
                        alt="Avatar"
                        className="w-9 h-9 rounded-full object-cover"
                        onError={() => setUser(user ? { ...user, photoURL: null } : null)}
                      />
                    ) : (
                      <UserIcon className={`h-4 w-4 ${isTransparent ? "text-white" : ""}`} />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60 rounded-2xl p-2 mt-2">
                  <DropdownMenuLabel className="p-3">
                    <div className="flex flex-col">
                      <span className="font-bold">{user.displayName || "User"}</span>
                      <span className="text-xs font-normal text-muted-foreground">{user.email || "No email"}</span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild className="rounded-xl p-3 cursor-pointer">
                    <Link href="/account">My Profile</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="rounded-xl p-3 cursor-pointer"
                    onSelect={(e) => { e.preventDefault(); setProfileOpen(true); }}
                  >
                    Quick View
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="rounded-xl p-3 cursor-pointer">
                    <Link href={portalHref}>My Portal</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="rounded-xl p-3 cursor-pointer">
                    <Link href="/customize" className="text-primary font-bold">Custom Studio</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive rounded-xl p-3 cursor-pointer font-bold">
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : !loading ? (
              <Button
                asChild
                variant="ghost"
                size="icon"
                className={`rounded-full hidden sm:flex ${isTransparent ? "text-white hover:bg-white/10" : ""}`}
              >
                <Link href="/login" aria-label="Account">
                  <UserIcon className="h-5 w-5" />
                </Link>
              </Button>
            ) : null}

            {/* Cart */}
            <Link href="/cart">
              <Button
                variant="ghost"
                size="icon"
                className={`relative rounded-full ${isTransparent ? "text-white hover:bg-white/10" : ""}`}
              >
                <ShoppingCart className="h-5 w-5" />
                {cartCount > 0 && (
                  <Badge className="absolute -top-0.5 -right-0.5 h-4 w-4 flex items-center justify-center p-0 text-[9px] bg-primary border-2 border-background" variant="default">
                    {cartCount}
                  </Badge>
                )}
              </Button>
            </Link>
          </div>
        </div>

        {/* Mobile Search Dropdown */}
        {mobileSearchOpen && (
          <div className={`lg:hidden border-t px-4 py-3 ${isTransparent ? "bg-black/80 backdrop-blur-md border-white/10" : "bg-background border-border/40"}`}>
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  autoFocus
                  className="pl-10 h-11 bg-muted/40 border-none rounded-full"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button type="submit" className="rounded-full h-11 px-5">Go</Button>
            </form>
          </div>
        )}
      </nav>

      {/* MOBILE SLIDE-OUT MENU */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[100] md:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />

          <div className="absolute left-0 top-0 h-full w-80 max-w-[85vw] bg-background shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b">
              <span className="font-theseasons text-2xl font-bold">Antariya</span>
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
                  <p className="font-bold truncate text-sm">{user.displayName || "User"}</p>
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
                  className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold uppercase tracking-wide hover:bg-muted transition-colors"
                >
                  {link.label}
                </Link>
              ))}

              <div className="pt-4 border-t space-y-1">
                <Link
                  href="/customize"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold text-primary hover:bg-primary/5 transition-colors"
                >
                  Custom Studio
                </Link>
                {user ? (
                  <>
                    <Link
                      href={portalHref}
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold hover:bg-muted transition-colors"
                    >
                      My Portal
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold text-destructive hover:bg-destructive/5 transition-colors text-left"
                    >
                      Logout
                    </button>
                  </>
                ) : (
                  <div className="px-4 py-3 flex flex-col gap-2">
                    <Button asChild className="rounded-full w-full">
                      <Link href="/login" onClick={() => setMobileOpen(false)}>Log In</Link>
                    </Button>
                    <Button asChild variant="outline" className="rounded-full w-full">
                      <Link href="/signup" onClick={() => setMobileOpen(false)}>Sign Up</Link>
                    </Button>
                  </div>
                )}
              </div>
            </nav>
          </div>
        </div>
      )}

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background/95 backdrop-blur-md border-t border-border/40 safe-area-bottom">
        <div className="flex items-center justify-around h-14">
          <Link href="/" className={`flex flex-col items-center gap-0.5 px-3 py-1 ${pathname === "/" ? "text-primary" : "text-muted-foreground"}`}>
            <Home className="h-5 w-5" />
            <span className="text-[10px] font-medium">Home</span>
          </Link>
          <Link href="/shop" className={`flex flex-col items-center gap-0.5 px-3 py-1 ${pathname === "/shop" ? "text-primary" : "text-muted-foreground"}`}>
            <ShoppingBag className="h-5 w-5" />
            <span className="text-[10px] font-medium">Shop</span>
          </Link>
          <Link href="/marketplace" className={`flex flex-col items-center gap-0.5 px-3 py-1 ${pathname === "/marketplace" ? "text-primary" : "text-muted-foreground"}`}>
            <Grid3X3 className="h-5 w-5" />
            <span className="text-[10px] font-medium">Categories</span>
          </Link>
          <Link href="/wishlist" className={`flex flex-col items-center gap-0.5 px-3 py-1 ${pathname === "/wishlist" ? "text-primary" : "text-muted-foreground"}`}>
            <Heart className="h-5 w-5" />
            <span className="text-[10px] font-medium">Wishlist</span>
          </Link>
          <Link href={user ? "/account" : "/login"} className={`flex flex-col items-center gap-0.5 px-3 py-1 ${pathname === "/account" ? "text-primary" : "text-muted-foreground"}`}>
            <UserIcon className="h-5 w-5" />
            <span className="text-[10px] font-medium">Account</span>
          </Link>
        </div>
      </div>

      <ProfileSidebar
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        onSaved={(profile) => {
          if (user) {
            setUser({ ...user, displayName: profile.displayName, photoURL: profile.photoURL });
          }
        }}
      />
    </>
  );
}
