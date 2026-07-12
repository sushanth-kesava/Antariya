import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sitemap | Antariya",
  description: "Complete sitemap of Antariya e-commerce website",
  robots: "index, follow",
};

export default function SitemapPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">Site Map</h1>
          <p className="text-lg text-slate-600">
            Browse all pages on Antariya. For automated indexing, visit our{" "}
            <a href="/sitemap.xml" className="text-blue-600 hover:text-blue-800 underline">
              XML Sitemap
            </a>
          </p>
        </div>

        {/* Main Pages */}
        <section className="mb-12 bg-white rounded-lg shadow-md p-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Shop & Marketplace</h2>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <li>
              <a href="/" className="text-blue-600 hover:text-blue-800 hover:underline flex items-center">
                <span className="mr-2">🏠</span> Homepage
              </a>
            </li>
            <li>
              <a href="/marketplace" className="text-blue-600 hover:text-blue-800 hover:underline flex items-center">
                <span className="mr-2">🛍️</span> Marketplace
              </a>
            </li>
            <li>
              <a href="/shop" className="text-blue-600 hover:text-blue-800 hover:underline flex items-center">
                <span className="mr-2">🏪</span> Shop
              </a>
            </li>
            <li>
              <a href="/shop/hoodies" className="text-blue-600 hover:text-blue-800 hover:underline flex items-center">
                <span className="mr-2">👕</span> Hoodies
              </a>
            </li>
            <li>
              <a href="/customize" className="text-blue-600 hover:text-blue-800 hover:underline flex items-center">
                <span className="mr-2">🎨</span> Customize
              </a>
            </li>
            <li>
              <a href="/wishlist" className="text-blue-600 hover:text-blue-800 hover:underline flex items-center">
                <span className="mr-2">❤️</span> Wishlist
              </a>
            </li>
          </ul>
        </section>

        {/* Account & Checkout */}
        <section className="mb-12 bg-white rounded-lg shadow-md p-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Account & Shopping</h2>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <li>
              <a href="/account" className="text-blue-600 hover:text-blue-800 hover:underline flex items-center">
                <span className="mr-2">👤</span> My Account
              </a>
            </li>
            <li>
              <a href="/cart" className="text-blue-600 hover:text-blue-800 hover:underline flex items-center">
                <span className="mr-2">🛒</span> Shopping Cart
              </a>
            </li>
            <li>
              <a href="/checkout" className="text-blue-600 hover:text-blue-800 hover:underline flex items-center">
                <span className="mr-2">💳</span> Checkout
              </a>
            </li>
            <li>
              <a href="/order-status" className="text-blue-600 hover:text-blue-800 hover:underline flex items-center">
                <span className="mr-2">📦</span> Order Status
              </a>
            </li>
            <li>
              <a href="/complete-profile" className="text-blue-600 hover:text-blue-800 hover:underline flex items-center">
                <span className="mr-2">✏️</span> Complete Profile
              </a>
            </li>
          </ul>
        </section>

        {/* Authentication */}
        <section className="mb-12 bg-white rounded-lg shadow-md p-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Authentication</h2>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <li>
              <a href="/login" className="text-blue-600 hover:text-blue-800 hover:underline flex items-center">
                <span className="mr-2">🔓</span> Customer Login
              </a>
            </li>
            <li>
              <a href="/signup" className="text-blue-600 hover:text-blue-800 hover:underline flex items-center">
                <span className="mr-2">✍️</span> Sign Up
              </a>
            </li>
            <li>
              <a href="/admin-login" className="text-blue-600 hover:text-blue-800 hover:underline flex items-center">
                <span className="mr-2">🔐</span> Admin Login
              </a>
            </li>
            <li>
              <a href="/superadmin-login" className="text-blue-600 hover:text-blue-800 hover:underline flex items-center">
                <span className="mr-2">👑</span> Superadmin Login
              </a>
            </li>
          </ul>
        </section>

        {/* Admin Portals */}
        <section className="mb-12 bg-white rounded-lg shadow-md p-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Admin Portals</h2>
          <div className="bg-amber-50 border border-amber-200 rounded p-4 mb-4">
            <p className="text-amber-800">🔒 Admin areas require authentication</p>
          </div>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <li>
              <a href="/portal/admin" className="text-blue-600 hover:text-blue-800 hover:underline flex items-center">
                <span className="mr-2">📊</span> Admin Dashboard
              </a>
            </li>
            <li>
              <a href="/portal/admin/my-company-catalog" className="text-blue-600 hover:text-blue-800 hover:underline flex items-center">
                <span className="mr-2">📋</span> My Catalog
              </a>
            </li>
            <li>
              <a href="/portal/admin/add-new-product" className="text-blue-600 hover:text-blue-800 hover:underline flex items-center">
                <span className="mr-2">➕</span> Add Product
              </a>
            </li>
            <li>
              <a href="/portal/admin/operations-overview" className="text-blue-600 hover:text-blue-800 hover:underline flex items-center">
                <span className="mr-2">⚙️</span> Operations
              </a>
            </li>
            <li>
              <a href="/portal/admin/review-moderation" className="text-blue-600 hover:text-blue-800 hover:underline flex items-center">
                <span className="mr-2">✅</span> Review Moderation
              </a>
            </li>
            <li>
              <a href="/portal/admin/moderation-activity" className="text-blue-600 hover:text-blue-800 hover:underline flex items-center">
                <span className="mr-2">📈</span> Moderation Activity
              </a>
            </li>
            <li>
              <a href="/portal/customer" className="text-blue-600 hover:text-blue-800 hover:underline flex items-center">
                <span className="mr-2">👥</span> Customer Portal
              </a>
            </li>
            <li>
              <a href="/portal/superadmin" className="text-blue-600 hover:text-blue-800 hover:underline flex items-center">
                <span className="mr-2">👑</span> Superadmin Panel
              </a>
            </li>
          </ul>
        </section>

        {/* Legal & Info */}
        <section className="mb-12 bg-white rounded-lg shadow-md p-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Legal & Information</h2>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <li>
              <a href="/legal/policies" className="text-blue-600 hover:text-blue-800 hover:underline flex items-center">
                <span className="mr-2">📜</span> Policies & Terms
              </a>
            </li>
            <li>
              <a href="/sitemap" className="text-blue-600 hover:text-blue-800 hover:underline flex items-center">
                <span className="mr-2">🗺️</span> Sitemap (This Page)
              </a>
            </li>
          </ul>
        </section>

        {/* SEO Resources */}
        <section className="bg-white rounded-lg shadow-md p-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">SEO Resources</h2>
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded border border-blue-200">
              <p className="font-semibold text-slate-900 mb-2">📍 XML Sitemap</p>
              <a href="/sitemap.xml" className="text-blue-600 hover:text-blue-800 break-all">
                https://antariya.onrender.com/sitemap.xml
              </a>
              <p className="text-sm text-slate-600 mt-2">For search engines (Google, Bing)</p>
            </div>
            <div className="p-4 bg-green-50 rounded border border-green-200">
              <p className="font-semibold text-slate-900 mb-2">🤖 Robots.txt</p>
              <a href="/robots.txt" className="text-blue-600 hover:text-blue-800 break-all">
                https://antariya.onrender.com/robots.txt
              </a>
              <p className="text-sm text-slate-600 mt-2">Crawl instructions for bots</p>
            </div>
          </div>
        </section>

        {/* Footer Info */}
        <div className="mt-12 text-center text-slate-600">
          <p>
            Have questions? <a href="/legal/policies" className="text-blue-600 hover:text-blue-800">Contact us</a>
          </p>
          <p className="text-sm mt-2">
            Last Updated: {new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
      </div>
    </div>
  );
}
