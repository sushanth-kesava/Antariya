"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { useFirestore, useCollection } from "@/firebase";
import { collection, addDoc, serverTimestamp, query, where, deleteDoc, doc } from "firebase/firestore";
import { CATEGORIES } from "@/app/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { LayoutDashboard, PlusCircle, PackageCheck, AlertCircle, Loader2, Trash2 } from "lucide-react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api";

export default function AdminPortal() {
  const router = useRouter();
  const db = useFirestore();
  const [authChecked, setAuthChecked] = useState(false);
  const [adminUser, setAdminUser] = useState<any>(null);
  const catalogQuery = useMemo(() => query(collection(db, "products"), where("dealerId", "==", "admin-1")), [db]);
  const { data: catalog, loading: loadingCatalog } = useCollection<any>(catalogQuery);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    image: "",
    category: CATEGORIES[0],
    stock: "100",
    customizable: false,
    rating: "0",
  });

  useEffect(() => {
    const validateAdminSession = async () => {
      const token = localStorage.getItem("app_auth_token");

      if (!token) {
        localStorage.removeItem("google_auth_user");
        localStorage.removeItem("user_role");
        router.replace("/login");
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
          localStorage.removeItem("app_auth_token");
          localStorage.removeItem("google_auth_user");
          localStorage.removeItem("user_role");
          router.replace("/login");
          return;
        }

        if (data.user.role !== "admin") {
          router.replace("/");
          return;
        }

        setAdminUser(data.user);
        setAuthChecked(true);
      } catch (err) {
        localStorage.removeItem("app_auth_token");
        localStorage.removeItem("google_auth_user");
        localStorage.removeItem("user_role");
        router.replace("/login");
      }
    };

    void validateAdminSession();
  }, [router]);

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-gray-50/50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const docRef = await addDoc(collection(db, "products"), {
        name: formData.name,
        description: formData.description,
        price: parseFloat(formData.price),
        image: formData.image || "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&q=80&w=600",
        category: formData.category,
        stock: parseInt(formData.stock),
        customizable: formData.customizable,
        rating: parseFloat(formData.rating),
        dealerId: "admin-1", // mock admin dealer
        createdAt: serverTimestamp(),
      });
      
      console.log("Product written with ID: ", docRef.id);
      setSuccess(true);
      
      // Reset form but keep category
      setFormData({
        name: "",
        description: "",
        price: "",
        image: "",
        category: formData.category,
        stock: "100",
        customizable: false,
        rating: "0",
      });
      
      setTimeout(() => setSuccess(false), 5000);
    } catch (err: any) {
      console.error("Error adding document: ", err);
      setError(err.message || "Failed to add product to database.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      if(confirm("Are you sure you want to delete this product from your catalog?")) {
        await deleteDoc(doc(db, "products", id));
      }
    } catch(err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col font-sans">
      <Navbar />
      
      <div className="flex-1 flex flex-col lg:flex-row container mx-auto px-4 py-8 gap-8">
        
        {/* Admin Sidebar */}
        <aside className="w-full lg:w-72 space-y-4">
          <div className="bg-primary border shadow-lg rounded-2xl p-6 space-y-6 text-primary-foreground">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center font-bold text-2xl">
                A
              </div>
              <div>
                <p className="font-bold text-lg leading-tight">Admin Portal</p>
                <p className="text-sm font-medium text-primary-foreground/80 mt-1">{adminUser?.displayName || "Super Administrator"}</p>
              </div>
            </div>
            <div className="space-y-1 pt-4 border-t border-white/20">
              <Button variant="ghost" className="w-full justify-start gap-3 bg-white/10 font-bold hover:bg-white/20 hover:text-white">
                <PlusCircle className="h-5 w-5" />
                Create New Product
              </Button>
              <Button variant="ghost" className="w-full justify-start gap-3 hover:bg-white/10 hover:text-white">
                <LayoutDashboard className="h-5 w-5" />
                Manage Inventory
              </Button>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 max-w-3xl">
          <Card className="rounded-[32px] border-gray-100 shadow-xl overflow-hidden bg-white">
            <CardHeader className="bg-gray-50/50 border-b border-gray-100 p-8">
              <CardTitle className="text-3xl font-black font-headline tracking-tight text-gray-900">Add New Product</CardTitle>
              <CardDescription className="text-gray-500 text-base">
                Fill out the details below to push a new premium product directly to the customer marketplace.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8">
              
              {success && (
                <div className="mb-8 p-4 bg-green-50 border border-green-200 rounded-2xl flex items-center gap-3 text-green-700 font-medium">
                  <PackageCheck className="h-6 w-6 text-green-500" />
                  Product successfully added! It is now live in the marketplace.
                </div>
              )}
              
              {error && (
                <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-700 font-medium">
                  <AlertCircle className="h-6 w-6 text-red-500" />
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                
                {/* Name & Basic Desc */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Product Name <span className="text-red-500">*</span></label>
                    <Input 
                      required 
                      className="h-12 rounded-xl border-gray-200 bg-gray-50 focus:bg-white text-lg" 
                      placeholder="e.g. Royal Zardosi Thread Set"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Detailed Description <span className="text-red-500">*</span></label>
                    <textarea 
                      required 
                      className="w-full rounded-xl border-gray-200 bg-gray-50 focus:bg-white p-4 text-base focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all" 
                      rows={4}
                      placeholder="Describe the quality and specs of the product..."
                      value={formData.description}
                      onChange={e => setFormData({...formData, description: e.target.value})}
                    />
                  </div>
                </div>

                {/* Pricing & Stock */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Price (in USD) <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <Input 
                        required 
                        type="number" 
                        step="0.01" 
                        className="pl-8 h-12 rounded-xl border-gray-200 bg-gray-50 focus:bg-white text-lg font-bold" 
                        placeholder="0.00"
                        value={formData.price}
                        onChange={e => setFormData({...formData, price: e.target.value})}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Initial Stock <span className="text-red-500">*</span></label>
                    <Input 
                      required 
                      type="number" 
                      className="h-12 rounded-xl border-gray-200 bg-gray-50 focus:bg-white text-lg" 
                      value={formData.stock}
                      onChange={e => setFormData({...formData, stock: e.target.value})}
                    />
                  </div>
                </div>

                {/* Image & Category */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Image URL</label>
                    <Input 
                      className="h-12 rounded-xl border-gray-200 bg-gray-50 focus:bg-white text-base" 
                      placeholder="https://example.com/image.jpg"
                      value={formData.image}
                      onChange={e => setFormData({...formData, image: e.target.value})}
                    />
                    <p className="text-xs text-muted-foreground mt-2">Leaves empty to use a random default image.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Marketplace Category <span className="text-red-500">*</span></label>
                    <select 
                      title="Marketplace Category"
                      aria-label="Marketplace Category"
                      className="w-full h-12 rounded-xl border-gray-200 bg-gray-50 focus:bg-white px-4 text-base font-medium outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                      value={formData.category}
                      onChange={e => setFormData({...formData, category: e.target.value})}
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Configurations */}
                <div className="pt-6 border-t border-gray-100 flex items-center justify-between">
                  <div>
                    <label className="block text-base font-bold text-gray-900">Customizable Base</label>
                    <p className="text-sm text-gray-500">Enable this if the item can be sent to the AI Design Studio.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      title="Customizable Base"
                      aria-label="Customizable Base"
                      className="sr-only peer" 
                      checked={formData.customizable}
                      onChange={e => setFormData({...formData, customizable: e.target.checked})}
                    />
                    <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                <div className="pt-8">
                  <Button 
                    type="submit" 
                    disabled={loading}
                    className="w-full h-14 rounded-2xl text-lg font-bold shadow-xl shadow-primary/20 hover:scale-[1.01] transition-all"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-6 w-6 animate-spin" /> Publishing to Store...
                      </>
                    ) : (
                      "Publish Product"
                    )}
                  </Button>
                </div>

              </form>
            </CardContent>
          </Card>

          {/* Catalog Management Section */}
          <div className="mt-8">
            <h2 className="text-2xl font-bold font-headline tracking-tight text-gray-900 mb-4">My Company Catalog</h2>
            <div className="space-y-4">
              {loadingCatalog ? (
                <div className="p-8 text-center text-muted-foreground bg-white rounded-[32px] border border-gray-100 shadow-sm">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" /> Loading your products...
                </div>
              ) : catalog && catalog.length > 0 ? (
                catalog.map((product: any) => (
                  <div key={product.id} className="flex items-center justify-between p-4 bg-white border border-gray-100 shadow-sm rounded-2xl">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-muted relative">
                        <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">{product.name}</h3>
                        <p className="text-sm text-gray-500">${product.price} • {product.category} • In stock: {product.stock}</p>
                      </div>
                    </div>
                    <div>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(product.id)} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-muted-foreground bg-white rounded-[32px] border border-gray-100 shadow-sm">
                  No products in your catalog yet. Start adding above!
                </div>
              )}
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}
