"use client";

import Link from "next/link";
import { ShoppingCart, Search, User as UserIcon, Menu, Heart, Palette, ShoppingBag } from "lucide-react";
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
import { useState, useEffect } from "react";
import { googleLogout } from '@react-oauth/google';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api";

function clearLocalSession() {
  localStorage.removeItem('app_auth_token');
  localStorage.removeItem('google_auth_user');
  localStorage.removeItem('user_role');
}

export function Navbar() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Validate session against backend on mount.
  useEffect(() => {
    const loadUser = async () => {
      const token = localStorage.getItem('app_auth_token');

      if (!token) {
        clearLocalSession();
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();

        if (!response.ok || !data?.success || !data?.user) {
          clearLocalSession();
          setUser(null);
          setLoading(false);
          return;
        }

        setUser(data.user);
        localStorage.setItem('google_auth_user', JSON.stringify(data.user));
      } catch (error) {
        clearLocalSession();
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    void loadUser();
  }, []);

  const handleLogout = () => {
    googleLogout();
    setUser(null);
    clearLocalSession();
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-20 flex items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white font-bold text-2xl group-hover:rotate-12 transition-all shadow-lg shadow-primary/20">
              S
            </div>
            <span className="font-headline text-2xl font-bold tracking-tight text-primary hidden sm:inline-block">
              StitchMart
            </span>
          </Link>
          
          <div className="hidden md:flex items-center gap-1">
            <Button variant="ghost" asChild className="rounded-full px-5 font-bold">
              <Link href="/marketplace">Marketplace</Link>
            </Button>
            <Button variant="ghost" asChild className="rounded-full px-5 font-bold">
              <Link href="/shop" className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4" /> Shop
              </Link>
            </Button>
            <Button variant="ghost" asChild className="rounded-full px-5 font-bold text-primary hover:text-primary bg-primary/5 hover:bg-primary/10">
              <Link href="/customize" className="flex items-center gap-2">
                <Palette className="h-4 w-4" /> AI Studio
              </Link>
            </Button>
          </div>
        </div>

        <div className="flex-1 max-w-md hidden lg:flex relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            className="pl-11 h-11 bg-muted/50 focus-visible:ring-primary border-none rounded-2xl" 
            placeholder="Search premium collections..." 
          />
        </div>

        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="lg:hidden rounded-full">
            <Search className="h-5 w-5" />
          </Button>
          
          <Button variant="ghost" size="icon" className="relative hidden sm:flex rounded-full">
            <Heart className="h-5 w-5" />
          </Button>

          <Link href="/cart">
            <Button variant="ghost" size="icon" className="relative rounded-full">
              <ShoppingCart className="h-5 w-5" />
              <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px] bg-secondary border-2 border-background" variant="default">
                3
              </Badge>
            </Button>
          </Link>

          {!loading && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full overflow-hidden border p-0 h-10 w-10">
                  {user.photoURL ? (
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
                  <Link href="/portal/customer">My Portal</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="rounded-xl p-3 cursor-pointer">
                  <Link href="/customize" className="text-primary font-bold">AI Design Drafts</Link>
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
            <div className="w-20 h-10 animate-pulse bg-muted rounded-full"></div>
          )}

          <Button variant="ghost" size="icon" className="md:hidden rounded-full">
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </nav>
  );
}
