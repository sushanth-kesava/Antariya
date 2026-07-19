"use client";

import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  MessageSquare, 
  Mail, 
  Phone, 
  MessageCircle, 
  FileText,
  ArrowRight,
  Clock
} from "lucide-react";

export default function ContactSupport() {
  const supportOptions = [
    {
      icon: <MessageSquare className="h-8 w-8" />,
      title: "Raise a Support Ticket",
      description: "Submit a detailed support request and track the resolution status in real-time through your portal.",
      cta: "Create Ticket",
      href: "/portal/customer",
      color: "bg-blue-50 text-blue-600 border-blue-100"
    },
    {
      icon: <Mail className="h-8 w-8" />,
      title: "Email Us",
      description: "Send us an email with your query. Our team typically responds within 24 hours.",
      cta: "Send Email",
      href: "mailto:antariyaofficial@gmail.com",
      color: "bg-emerald-50 text-emerald-600 border-emerald-100"
    },
    {
      icon: <Phone className="h-8 w-8" />,
      title: "Call Us",
      description: "Speak directly with our support team. Available Monday-Saturday, 10 AM - 6 PM IST.",
      cta: "Call Now",
      href: "tel:+917013296469",
      color: "bg-purple-50 text-purple-600 border-purple-100"
    },
    {
      icon: <MessageCircle className="h-8 w-8" />,
      title: "WhatsApp Chat",
      description: "Get instant support via WhatsApp. Send us a message and we'll reply as soon as possible.",
      cta: "Start Chat",
      href: "https://wa.me/917013296469",
      color: "bg-green-50 text-green-600 border-green-100"
    },
    {
      icon: <FileText className="h-8 w-8" />,
      title: "Policies & FAQs",
      description: "Browse our comprehensive policies, FAQs, and documentation to find answers to common questions.",
      cta: "View Policies",
      href: "/legal/policies",
      color: "bg-amber-50 text-amber-600 border-amber-100"
    },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden py-20 lg:py-32">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
          
          <div className="w-full max-w-[1760px] mx-auto px-3 sm:px-4 lg:px-6 relative z-10">
            <div className="text-center space-y-6 max-w-3xl mx-auto">
              <Badge className="rounded-full bg-white/10 text-white border-white/20 hover:bg-white/15 mx-auto">
                Get Support
              </Badge>
              <h1 className="text-5xl lg:text-6xl font-bold text-white font-theseasons tracking-tight">
                We're Here to Help
              </h1>
              <p className="text-xl text-white/80 leading-relaxed">
                Choose your preferred way to reach us. Our support team is ready to assist you with any questions or concerns.
              </p>
            </div>
          </div>
        </section>

        {/* Support Options */}
        <section className="py-20 lg:py-32">
          <div className="w-full max-w-[1760px] mx-auto px-3 sm:px-4 lg:px-6">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {supportOptions.map((option, index) => {
                const isExternal = option.href.startsWith("http") || option.href.startsWith("mailto") || option.href.startsWith("tel");
                const isWhatsApp = option.href.startsWith("https://wa.me");
                
                return (
                  <div
                    key={index}
                    className="group rounded-2xl border border-border bg-card hover:border-primary/50 transition-all duration-300 p-8 space-y-6 h-full flex flex-col hover:shadow-lg hover:shadow-primary/10"
                  >
                    {/* Icon */}
                    <div className={`w-16 h-16 rounded-xl border flex items-center justify-center transition-all ${option.color}`}>
                      {option.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                      <h3 className="text-xl font-bold mb-3">{option.title}</h3>
                      <p className="text-muted-foreground leading-relaxed">{option.description}</p>
                    </div>

                    {/* CTA */}
                    <div className="pt-4 border-t">
                      {isExternal ? (
                        <a
                          href={option.href}
                          target={isWhatsApp ? "_blank" : undefined}
                          rel={isWhatsApp ? "noopener noreferrer" : undefined}
                          className="inline-flex items-center gap-2 text-primary font-semibold hover:gap-3 transition-all"
                        >
                          {option.cta}
                          <ArrowRight className="h-4 w-4" />
                        </a>
                      ) : (
                        <Link
                          href={option.href}
                          className="inline-flex items-center gap-2 text-primary font-semibold hover:gap-3 transition-all"
                        >
                          {option.cta}
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Response Times */}
        <section className="py-20 lg:py-32 bg-primary/5">
          <div className="w-full max-w-[1760px] mx-auto px-3 sm:px-4 lg:px-6">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-12">
                <Badge className="rounded-full bg-primary/10 text-primary border-primary/30 mx-auto mb-4">
                  Support Response Times
                </Badge>
                <h2 className="text-3xl font-bold font-theseasons">
                  We Aim to Respond Quickly
                </h2>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {[
                  { method: "Support Tickets", time: "12-24 hours", icon: <MessageSquare className="h-5 w-5" /> },
                  { method: "Email", time: "12-24 hours", icon: <Mail className="h-5 w-5" /> },
                  { method: "WhatsApp", time: "1-2 hours", icon: <MessageCircle className="h-5 w-5" /> },
                  { method: "Phone Call", time: "Same day", icon: <Phone className="h-5 w-5" /> },
                ].map((item, index) => (
                  <div key={index} className="flex items-center gap-4 p-6 rounded-xl border border-border bg-card">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      {item.icon}
                    </div>
                    <div>
                      <p className="font-semibold">{item.method}</p>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {item.time}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Quick Links */}
        <section className="py-20 lg:py-32">
          <div className="w-full max-w-[1760px] mx-auto px-3 sm:px-4 lg:px-6">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-12">
                <h2 className="text-3xl font-bold font-theseasons mb-4">
                  Frequently Needed Resources
                </h2>
                <p className="text-muted-foreground">
                  Quick access to common requests and information
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {[
                  { label: "Return & Refund Policy", href: "/legal/policies" },
                  { label: "Shipping Information", href: "/legal/policies" },
                  { label: "Privacy Policy", href: "/legal/privacy" },
                  { label: "Terms of Service", href: "/legal/terms" },
                  { label: "Dealer Program", href: "/portal/admin" },
                  { label: "Track Your Order", href: "/track-order" },
                ].map((item, index) => (
                  <Link
                    key={index}
                    href={item.href}
                    className="group p-4 rounded-xl border border-border bg-card hover:border-primary/50 transition-all flex items-center justify-between"
                  >
                    <span className="font-semibold text-foreground">{item.label}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 lg:py-32 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
          <div className="w-full max-w-[1760px] mx-auto px-3 sm:px-4 lg:px-6 relative z-10">
            <div className="text-center space-y-8 max-w-2xl mx-auto">
              <div>
                <h2 className="text-4xl font-bold text-white font-theseasons mb-4">
                  Need Immediate Assistance?
                </h2>
                <p className="text-xl text-white/80">
                  Our team is standing by to help you with any urgent matters.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" className="rounded-full px-8" asChild>
                  <a href="https://wa.me/917013296469" target="_blank" rel="noopener noreferrer">
                    WhatsApp Support
                  </a>
                </Button>
                <Button size="lg" variant="outline" className="rounded-full px-8 border-white/20 text-white bg-white/5 hover:bg-white/10" asChild>
                  <a href="tel:+917013296469">
                    Call +91 70132 96469
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
