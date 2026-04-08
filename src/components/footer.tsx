import Link from "next/link";
import { BRAND_LOGO_URL } from "@/lib/brand";

export function Footer() {
  return (
    <footer className="bg-card border-t pt-16 pb-8">
      <div className="w-full max-w-[1760px] mx-auto px-3 sm:px-4 lg:px-6">
        <div className="flex flex-col items-center gap-8">
          <div className="w-24 h-24 rounded-2xl overflow-hidden shadow-md">
            <img src={BRAND_LOGO_URL} alt="Antariya logo" className="w-full h-full object-cover" />
          </div>
          
          <div className="text-center space-y-4">
            <h3 className="font-bold text-lg">Antariya</h3>
            <p className="text-muted-foreground text-sm max-w-md leading-relaxed">
              Empowering India's embroidery industry with premium digital assets and machine solutions.
            </p>
          </div>

          <div className="border-t pt-8 w-full flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-muted-foreground">
            <p>© 2024 Antariya India. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <Link href="#" className="hover:text-primary transition-colors">Privacy Policy</Link>
              <Link href="#" className="hover:text-primary transition-colors">Terms of Service</Link>
              <Link href="#" className="hover:text-primary transition-colors">Contact</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
