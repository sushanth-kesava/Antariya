"use client";

import Link from "next/link";
import { ShoppingCart, Search, User as UserIcon, Menu, Bell, Heart } from "lucide-react";
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
import { useState } from "react";
import { CURRENT_USER } from "@/app/lib/mock-data";

export function Navbar() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-xl group-hover:rotate-12 transition-transform">
              S
            </div>
            <span className="font-headline text-2xl font-bold tracking-tight text-primary hidden sm:inline-block">
              StitchMart
            </span>
          </Link>
          
          <div className="hidden md:flex items-center gap-1">
            <Button variant="ghost" asChild>
              <Link href="/marketplace">Marketplace</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/designs">Designs</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/tools">Tools</Link>
            </Button>
          </div>
        </div>

        <div className="flex-1 max-w-md hidden lg:flex relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            className="pl-10 bg-muted/50 focus-visible:ring-primary border-none" 
            placeholder="Search threads, designs, parts..." 
          />
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="lg:hidden">
            <Search className="h-5 w-5" />
          </Button>
          
          <Button variant="ghost" size="icon" className="relative">
            <Heart className="h-5 w-5" />
          </Button>

          <Link href="/cart">
            <Button variant="ghost" size="icon" className="relative">
              <ShoppingCart className="h-5 w-5" />
              <Badge className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center p-0 text-[10px]" variant="default">
                3
              </Badge>
            </Button>
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full overflow-hidden border">
                <UserIcon className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span>{CURRENT_USER.name}</span>
                  <span className="text-xs font-normal text-muted-foreground">{CURRENT_USER.email}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/portal/customer">My Portal</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/portal/customer/orders">Orders</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/portal/customer/downloads">Downloads</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {CURRENT_USER.role === 'customer' && (
                <DropdownMenuItem asChild>
                  <Link href="/portal/dealer/register" className="text-primary font-medium">Become a Dealer</Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">Logout</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </nav>
  );
}