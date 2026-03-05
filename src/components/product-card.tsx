import { Product } from "@/app/lib/mock-data";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Heart, Star, Download } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const isDesign = product.category === 'Embroidery Designs';

  return (
    <Card className="group relative overflow-hidden transition-all hover:shadow-xl border-border/50 bg-card/50 backdrop-blur-sm">
      <Link href={`/product/${product.id}`} className="block relative aspect-square overflow-hidden bg-muted">
        <Image
          src={product.image}
          alt={product.name}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-110"
        />
        {isDesign && (
          <div className="absolute top-2 right-2">
            <Badge variant="secondary" className="flex items-center gap-1 bg-white/90 backdrop-blur text-primary border-primary/20">
              <Download className="h-3 w-3" />
              Digital
            </Badge>
          </div>
        )}
        <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full bg-white/90 backdrop-blur shadow-sm">
            <Heart className="h-4 w-4 text-secondary" />
          </Button>
        </div>
      </Link>
      
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{product.category}</p>
          <div className="flex items-center gap-1 text-xs font-bold text-accent">
            <Star className="h-3 w-3 fill-current" />
            {product.rating}
          </div>
        </div>
        
        <Link href={`/product/${product.id}`}>
          <h3 className="font-semibold text-lg line-clamp-1 group-hover:text-primary transition-colors">{product.name}</h3>
        </Link>
        
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-bold text-primary">₹{(product.price * 80).toLocaleString()}</span>
          {isDesign && <span className="text-xs text-muted-foreground">Unlimited License</span>}
        </div>
      </CardContent>
      
      <CardFooter className="p-4 pt-0">
        <Button className="w-full gap-2 rounded-full font-semibold shadow-sm hover:shadow-md transition-all active:scale-95" variant="default">
          <ShoppingCart className="h-4 w-4" />
          Add to Cart
        </Button>
      </CardFooter>
    </Card>
  );
}