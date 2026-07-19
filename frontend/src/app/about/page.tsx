"use client";

import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Sparkles, 
  Palette, 
  Zap, 
  Target, 
  Users, 
  Globe,
  Mail,
  Phone,
  MessageCircle
} from "lucide-react";

export default function About() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      
      <main className="flex-1">
        {/* Hero Banner */}
        <section className="relative overflow-hidden py-20 lg:py-32">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
          
          <div className="w-full max-w-[1760px] mx-auto px-3 sm:px-4 lg:px-6 relative z-10">
            <div className="text-center space-y-6 max-w-3xl mx-auto">
              <Badge className="rounded-full bg-white/10 text-white border-white/20 hover:bg-white/15 mx-auto">
                About Antariya
              </Badge>
              <h1 className="text-5xl lg:text-6xl font-bold text-white font-theseasons tracking-tight">
                Empowering India's Embroidery Industry
              </h1>
              <p className="text-xl text-white/80 leading-relaxed">
                Transforming how embroidery professionals access premium digital assets, physical supplies, and machine solutions for their growing businesses.
              </p>
            </div>
          </div>
        </section>

        {/* Our Story */}
        <section className="py-20 lg:py-32">
          <div className="w-full max-w-[1760px] mx-auto px-3 sm:px-4 lg:px-6">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-12">
                <Badge className="rounded-full bg-primary/10 text-primary border-primary/30 mb-4">
                  Our Story
                </Badge>
                <h2 className="text-4xl font-bold font-theseasons">
                  Every Thread Has a Story
                </h2>
              </div>
              <div className="space-y-6 text-lg text-muted-foreground leading-relaxed">
                <p>
                  Some tell stories of festivals, some of families, and some carry generations of craftsmanship passed from one pair of hands to another. India has always been a land of extraordinary art, where every region has its own embroidery, jewellery, and handmade traditions. Yet, many of these beautiful crafts remain unseen in today's fast-moving world.
                </p>
                <p className="text-foreground text-xl font-semibold leading-relaxed">
                  Antariya was born from a simple belief: <span className="text-primary">our culture deserves to be worn with pride, not forgotten with time.</span>
                </p>
                <p>
                  Our journey begins with what we do best—<strong className="text-foreground">premium computer embroidery and high-quality T-shirts</strong>. By combining precision embroidery technology with thoughtful design, we create apparel that feels modern while carrying the spirit of Indian artistry. Every stitch is carefully crafted to ensure lasting quality and timeless style.
                </p>
                <p>
                  But this is only the beginning.
                </p>
                <p>
                  Our vision reaches far beyond T-shirts. We dream of creating a home for India's countless art forms—from intricate hand embroidery and handcrafted jewellery to traditional crafts made by skilled artisans across the country. We want every purchase to become a bridge between the people who preserve these traditions and the people who appreciate them.
                </p>
                <p>
                  At Antariya, every product is treated with care from start to finish. Each piece is carefully inspected, <strong className="text-foreground">packed with love, and delivered with care</strong>, because we believe the experience should feel as special as the craft itself.
                </p>
                <p>
                  When you choose Antariya, you're not just buying a product. You're becoming part of a story—one that celebrates craftsmanship, supports artisans, and keeps India's artistic heritage alive for the next generation.
                </p>
                <p className="text-foreground font-semibold text-xl">
                  This is our story.
                </p>
                <p className="text-primary font-semibold text-xl">
                  And with every order, it becomes yours too.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Our Mission */}
        <section className="py-20 lg:py-32 bg-primary/5">
          <div className="w-full max-w-[1760px] mx-auto px-3 sm:px-4 lg:px-6">
            <div className="max-w-3xl mx-auto text-center mb-16">
              <Badge className="rounded-full bg-primary/10 text-primary border-primary/30 mx-auto mb-4">
                Our Mission
              </Badge>
              <h2 className="text-4xl font-bold font-theseasons mb-6">
                Empowering Growth Through Accessibility
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                We're committed to making premium embroidery resources accessible to businesses of all sizes, enabling them to scale operations, innovate designs, and reach new markets.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  icon: <Palette className="h-8 w-8" />,
                  title: "Digital Assets",
                  description: "Thousands of premium embroidery designs, patterns, and digital resources curated for professionals and small businesses."
                },
                {
                  icon: <Zap className="h-8 w-8" />,
                  title: "Physical Supplies",
                  description: "Quality threads, fabrics, and materials sourced from trusted manufacturers and distributors across India."
                },
                {
                  icon: <Target className="h-8 w-8" />,
                  title: "Machine Solutions",
                  description: "Equipment, tools, and technical support for embroidery businesses looking to scale their operations efficiently."
                }
              ].map((item, index) => (
                <div key={index} className="p-8 rounded-2xl border border-border bg-card hover:border-primary/50 transition-colors space-y-4">
                  <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                    {item.icon}
                  </div>
                  <h3 className="text-xl font-bold">{item.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* What We Offer */}
        <section className="py-20 lg:py-32">
          <div className="w-full max-w-[1760px] mx-auto px-3 sm:px-4 lg:px-6">
            <div className="text-center mb-16">
              <Badge className="rounded-full bg-primary/10 text-primary border-primary/30 mx-auto mb-4">
                Our Platform
              </Badge>
              <h2 className="text-4xl font-bold font-theseasons">What We Offer</h2>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {[
                {
                  icon: <Globe className="h-6 w-6" />,
                  title: "Marketplace",
                  description: "Browse, purchase, and download premium embroidery designs from professional creators. Every design is curated for quality and originality."
                },
                {
                  icon: <Palette className="h-6 w-6" />,
                  title: "Customization Studio",
                  description: "Create bespoke embroidery designs using our intuitive design tools. Personalize colors, sizes, and styles for your unique projects."
                },
                {
                  icon: <Users className="h-6 w-6" />,
                  title: "Dealer Program",
                  description: "Join our network of trusted dealers and suppliers. Build your business by offering premium products through our platform."
                },
                {
                  icon: <Zap className="h-6 w-6" />,
                  title: "Dealer Support",
                  description: "Access training, marketing resources, and operational support to grow your embroidery business with Antariya's infrastructure."
                }
              ].map((item, index) => (
                <div key={index} className="p-8 rounded-2xl border border-border bg-background hover:bg-primary/2 transition-colors space-y-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                    {item.icon}
                  </div>
                  <h3 className="text-xl font-bold">{item.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section className="py-20 lg:py-32 bg-primary/5">
          <div className="w-full max-w-[1760px] mx-auto px-3 sm:px-4 lg:px-6">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold font-theseasons mb-4">Get in Touch</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Have questions? We'd love to hear from you. Reach out to our team and let's build something great together.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-3xl mx-auto">
              <div className="text-center space-y-4 p-6 rounded-2xl border border-border bg-card">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center text-primary mx-auto">
                  <Mail className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold mb-2">Email Us</h3>
                  <a href="mailto:antariyaofficial@gmail.com" className="text-primary hover:underline">
                    antariyaofficial@gmail.com
                  </a>
                </div>
              </div>

              <div className="text-center space-y-4 p-6 rounded-2xl border border-border bg-card">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center text-primary mx-auto">
                  <Phone className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold mb-2">Call Us</h3>
                  <a href="tel:+917013296469" className="text-primary hover:underline">
                    +91 70132 96469
                  </a>
                </div>
              </div>

              <div className="text-center space-y-4 p-6 rounded-2xl border border-border bg-card">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center text-primary mx-auto">
                  <MessageCircle className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold mb-2">WhatsApp</h3>
                  <a href="https://wa.me/917013296469" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    Start Chat
                  </a>
                </div>
              </div>
            </div>

            <div className="text-center mt-12">
              <Button asChild size="lg" className="rounded-full px-8">
                <Link href="/contact-support">View All Support Options</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
