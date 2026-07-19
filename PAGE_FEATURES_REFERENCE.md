# Antariya New Pages - Feature Reference Guide

## Quick Navigation
- [Coming Soon](#coming-soon-page)
- [About](#about-page)
- [Track Order](#track-order-page)
- [Contact Support](#contact-support-page)

---

## Coming Soon Page

**File**: `/coming-soon/page.tsx`  
**Route**: `/coming-soon`  
**Components**: Navbar, Button, Rocket icon

### Key Features
- ✓ Centered card layout with vertical spacing
- ✓ Animated rocket icon (bounce animation)
- ✓ Gradient icon container (from-primary/20 to-primary/5)
- ✓ Main title using font-theseasons font family
- ✓ Responsive grid layout
- ✓ Secondary links to marketplace
- ✓ "Back to Home" button

### Code Highlights
```tsx
<div className="w-24 h-24 bg-gradient-to-br from-primary/20 to-primary/5 rounded-3xl 
              flex items-center justify-center border border-primary/30">
  <Rocket className="h-12 w-12 text-primary animate-bounce" />
</div>

<Button asChild size="lg" className="rounded-full px-8">
  <Link href="/">Back to Home</Link>
</Button>
```

### Styling
- Icon container: 96x96px with gradient and border
- Max-width: md (28rem)
- Text alignment: center
- Spacing: space-y-8

---

## About Page

**File**: `/about/page.tsx`  
**Route**: `/about`  
**Components**: Navbar, Footer, Button, Badge, multiple Lucide icons

### Key Sections

#### 1. Hero Banner
- Dark slate gradient background (slate-900 to slate-800)
- Animated blue/amber blur overlays
- Brand tagline in large text (6xl on desktop)
- White badge with category

#### 2. Our Story Section
- Two-column layout (text + decorative image)
- Multiple paragraphs about Indian embroidery heritage
- Light background on right side

#### 3. Our Mission Section (bg-primary/5)
- Three-column grid with mission pillars:
  - Digital Assets (Palette icon)
  - Physical Supplies (Zap icon)
  - Machine Solutions (Target icon)
- Icon cards with hover effects

#### 4. What We Offer Section
- 2x2 grid layout
- Four service cards:
  1. Marketplace
  2. Customization Studio
  3. Dealer Program
  4. Dealer Support
- Hover state: border-primary/50 transition

#### 5. Contact Section
- Three contact methods in grid:
  - Email
  - Phone
  - WhatsApp
- Direct links to contact channels

### Icon Usage
```tsx
Sparkles, Palette, Zap, Target, Users, Globe, Mail, Phone, MessageCircle
```

### Layout Pattern
```tsx
<section className="py-20 lg:py-32">
  <div className="w-full max-w-[1760px] mx-auto px-3 sm:px-4 lg:px-6">
    {/* Content */}
  </div>
</section>
```

---

## Track Order Page

**File**: `/track-order/page.tsx`  
**Route**: `/track-order`  
**Components**: Navbar, Button, Input, Label, Package & ArrowRight icons
**State**: useState for submitted, searchType, value

### Key Features

#### Search Form
- Toggle between "Order ID" and "Email" search
- Dynamic input placeholder
- Disabled button when input empty
- Styled toggle using conditional classes

#### States
1. **Initial State**: Search form visible
2. **Submitted State**: Success message with CTA

#### Conditional UI
```tsx
{!submitted ? (
  // Form state
) : (
  // Submitted state
)}
```

#### Submitted State Shows
- ✓ "Please log in to portal" message
- ✓ Benefits list (4 items with dot indicators)
- ✓ Button to `/portal/customer`
- ✓ "Search Another Order" reset button

### Input Toggle Pattern
```tsx
<div className="flex gap-4 p-1 bg-muted rounded-full">
  <button
    type="button"
    onClick={() => { setSearchType("order-id"); setValue(""); }}
    className={searchType === "order-id" ? "active-styles" : "inactive-styles"}
  >
    Order ID
  </button>
  {/* Email button similar */}
</div>
```

### Form Card
- Rounded-2xl border with bg-card
- Max-width: 2xl (42rem)
- Padding: p-8
- Shadow: shadow-sm

---

## Contact Support Page

**File**: `/contact-support/page.tsx`  
**Route**: `/contact-support`  
**Components**: Navbar (no Footer), Button, Badge, multiple Lucide icons

### Key Sections

#### 1. Hero Section
- Dark gradient background (slate-900)
- Animated blue/purple blur overlays
- Title and subtitle

#### 2. Support Options Grid (5 Cards)
Each card contains:
- Color-coded icon container:
  1. MessageSquare - Blue (bg-blue-50 text-blue-600)
  2. Mail - Emerald (bg-emerald-50 text-emerald-600)
  3. Phone - Purple (bg-purple-50 text-purple-600)
  4. MessageCircle - Green (bg-green-50 text-green-600)
  5. FileText - Amber (bg-amber-50 text-amber-600)
- Title and description
- CTA with arrow icon
- Hover effects: border-primary/50, shadow-lg shadow-primary/10

#### 3. Response Times Section (bg-primary/5)
- 4-column grid showing response times
- Icons with timing information
- Badge header: "Support Response Times"

#### 4. Quick Links Section
- 6 common resource links
- 2-column grid layout
- Items:
  - Return & Refund Policy
  - Shipping Information
  - Privacy Policy
  - Terms of Service
  - Dealer Program
  - Track Your Order

#### 5. CTA Section
- Dark gradient footer (not actual Footer component)
- "Need Immediate Assistance?" headline
- Two buttons: WhatsApp and Phone call

### Support Options Array
```tsx
const supportOptions = [
  {
    icon: <MessageSquare />,
    title: "Raise a Support Ticket",
    description: "...",
    cta: "Create Ticket",
    href: "/portal/customer",
    color: "bg-blue-50 text-blue-600 border-blue-100"
  },
  // ... 4 more options
];
```

### Link Handling
```tsx
const isExternal = href.startsWith("http") || href.startsWith("mailto") || href.startsWith("tel");
const isWhatsApp = href.startsWith("https://wa.me");

// Render as <a> tag if external, <Link> if internal
{isExternal ? (
  <a href={option.href} target={isWhatsApp ? "_blank" : undefined}>
    {option.cta}
  </a>
) : (
  <Link href={option.href}>{option.cta}</Link>
)}
```

---

## Common Design Patterns

### Gradient Hero Section
```tsx
<section className="relative overflow-hidden py-20 lg:py-32">
  <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
  <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
  <div className="absolute bottom-0 left-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
  <div className="relative z-10">
    {/* Content */}
  </div>
</section>
```

### Card Grid with Hover Effects
```tsx
<div className="rounded-2xl border border-border bg-card hover:border-primary/50 
             transition-all duration-300 p-8 hover:shadow-lg hover:shadow-primary/10">
  {/* Content */}
</div>
```

### Icon Container Styling
```tsx
<div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
  {icon}
</div>
```

### Responsive Max-Width Container
```tsx
<div className="w-full max-w-[1760px] mx-auto px-3 sm:px-4 lg:px-6">
  {/* Content */}
</div>
```

---

## Import Guide

### Components
```tsx
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer"; // About page only
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
```

### Icons (lucide-react)
```tsx
import { 
  Rocket, Package, ArrowRight, Mail, Phone, MessageCircle,
  MessageSquare, FileText, Clock, Sparkles, Palette, Zap,
  Target, Users, Globe
} from "lucide-react";
```

### React Hooks
```tsx
import { useState } from "react"; // Track Order page
```

---

## Responsive Breakpoints Used

| Breakpoint | Class | Purpose |
|-----------|-------|---------|
| Default | - | Mobile (< 640px) |
| sm: | 640px | Small devices |
| md: | 768px | Tablets |
| lg: | 1024px | Desktops |

## Font Family
- `font-theseasons`: Custom font for headings (large titles)
- `font-bold`: Standard bold text
- `font-semibold`: Medium weight

## Animation Classes
- `animate-bounce`: Rocket icon on Coming Soon
- `animate-fade-in`: Success state animation on Track Order
- `transition-all`: Smooth color/border transitions on hover
- `transition-colors`: Color transitions

---

## Testing Checklist

- [ ] All pages load without errors
- [ ] Navbar displays correctly on all pages
- [ ] Mobile responsiveness works (use DevTools)
- [ ] External links open correctly:
  - [ ] Email: antariyaofficial@gmail.com
  - [ ] Phone: +91 70132 96469
  - [ ] WhatsApp: wa.me/917013296469
- [ ] Internal links work:
  - [ ] `/` (home)
  - [ ] `/marketplace`
  - [ ] `/portal/customer`
  - [ ] `/portal/admin`
  - [ ] `/legal/policies`, `/legal/privacy`, `/legal/terms`
- [ ] Form submission on Track Order page works
- [ ] State toggles on Track Order page
- [ ] Hover effects visible on cards
- [ ] Icons render correctly
- [ ] Text is readable with good contrast

---

## Color Palette Reference

| Usage | Color | CSS Class |
|-------|-------|-----------|
| Primary CTA | Primary | bg-primary, text-primary |
| Card Background | Card | bg-card |
| Text | Foreground | text-foreground |
| Muted Text | Muted Foreground | text-muted-foreground |
| Section Background | Primary/5 | bg-primary/5 |
| Backgrounds | Background | bg-background |
| Borders | Border | border-border |

---

## File Statistics

| Page | File Size | Lines | Complexity |
|------|-----------|-------|-----------|
| Coming Soon | 1.76 KB | 48 | Low |
| About | 11.66 KB | 231 | Medium-High |
| Track Order | 7.50 KB | 178 | Medium |
| Contact Support | 10.90 KB | 245 | Medium |

---

Last Updated: 2026-07-19
