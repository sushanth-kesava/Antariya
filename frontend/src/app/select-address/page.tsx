"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  MapPin,
  Plus,
  Check,
  ChevronLeft,
  Home,
  Building2,
  MapPinned,
  Pencil,
  Trash2,
  Loader2,
  Phone,
  Star,
} from "lucide-react";
import {
  type CustomerAddress,
  type AddressInput,
  addAddressOnBackend,
  removeAddressOnBackend,
  setDefaultAddressOnBackend,
} from "@/lib/api/customerProfile";
import { getApiBaseUrl } from "@/lib/api/base-url";
import { INDIAN_STATES } from "@/lib/india-states";

type AddressFormData = {
  addressType: "Home" | "Office" | "Other";
  line1: string;
  line2: string;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
  alternatePhone: string;
  deliveryInstructions: string;
  isDefault: boolean;
};

const emptyForm: AddressFormData = {
  addressType: "Home",
  line1: "",
  line2: "",
  landmark: "",
  city: "",
  state: "",
  pincode: "",
  alternatePhone: "",
  deliveryInstructions: "",
  isDefault: false,
};

export default function SelectAddressPage() {
  const router = useRouter();
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<AddressFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const token = typeof window !== "undefined" ? localStorage.getItem("app_auth_token") : null;

  // Fetch saved addresses
  useEffect(() => {
    if (!token) {
      router.push("/login?next=/select-address");
      return;
    }

    async function fetchAddresses() {
      try {
        const res = await fetch(`${getApiBaseUrl()}/customer/profile`, {
          credentials: "include",
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success && data.profile?.addresses) {
          setAddresses(data.profile.addresses);
          // Auto-select default or first address
          const defaultAddr = data.profile.addresses.find((a: CustomerAddress) => a.isDefault);
          setSelectedId(defaultAddr?._id || data.profile.addresses[0]?._id || null);
        }
      } catch {
        setError("Failed to load addresses");
      } finally {
        setLoading(false);
      }
    }

    fetchAddresses();
  }, [token, router]);

  const handleAddAddress = async () => {
    if (!token || !formData.line1 || !formData.city || !formData.state || !formData.pincode) {
      setError("Please fill all required fields");
      return;
    }

    setSaving(true);
    setError(null);

    const input: AddressInput = {
      addressType: formData.addressType,
      line1: formData.line1,
      line2: formData.line2 || undefined,
      landmark: formData.landmark || undefined,
      city: formData.city,
      state: formData.state,
      pincode: formData.pincode,
      alternatePhone: formData.alternatePhone || undefined,
      deliveryInstructions: formData.deliveryInstructions || undefined,
      isDefault: formData.isDefault,
    };

    const result = await addAddressOnBackend(token, input);
    setSaving(false);

    if (result.success) {
      setAddresses(result.addresses);
      const newest = result.addresses[result.addresses.length - 1];
      setSelectedId(newest?._id || null);
      setShowForm(false);
      setFormData(emptyForm);
    } else {
      setError(result.message);
    }
  };

  const handleDelete = async (addressId: string) => {
    if (!token) return;
    setDeletingId(addressId);
    const result = await removeAddressOnBackend(token, addressId);
    setDeletingId(null);
    if (result.success) {
      setAddresses(result.addresses);
      if (selectedId === addressId) {
        setSelectedId(result.addresses[0]?._id || null);
      }
    }
  };

  const handleSetDefault = async (addressId: string) => {
    if (!token) return;
    const result = await setDefaultAddressOnBackend(token, addressId);
    if (result.success) {
      setAddresses(result.addresses);
    }
  };

  const handleProceedToCheckout = () => {
    if (!selectedId) return;
    // Store selected address ID for checkout page
    sessionStorage.setItem("selectedAddressId", selectedId);
    router.push("/checkout");
  };

  const getAddressIcon = (type: string) => {
    switch (type) {
      case "Home": return <Home className="h-4 w-4" />;
      case "Office": return <Building2 className="h-4 w-4" />;
      default: return <MapPinned className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50/50">
      <Navbar />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()} className="p-2 rounded-full hover:bg-gray-100 transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Select Delivery Address</h1>
            <p className="text-sm text-muted-foreground">Choose where you'd like your order delivered</p>
          </div>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center gap-2 mb-8 text-xs font-medium">
          <span className="text-muted-foreground">Cart</span>
          <span className="text-muted-foreground">→</span>
          <span className="text-primary font-bold">Address</span>
          <span className="text-muted-foreground">→</span>
          <span className="text-muted-foreground">Payment</span>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Saved Addresses */}
        {addresses.length > 0 && !showForm && (
          <div className="space-y-3 mb-6">
            {addresses.map((addr) => (
              <Card
                key={addr._id}
                className={`p-4 cursor-pointer transition-all border-2 ${
                  selectedId === addr._id
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-gray-200 hover:border-gray-300 hover:shadow-sm"
                }`}
                onClick={() => setSelectedId(addr._id)}
              >
                <div className="flex items-start gap-3">
                  {/* Radio indicator */}
                  <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    selectedId === addr._id ? "border-primary bg-primary" : "border-gray-300"
                  }`}>
                    {selectedId === addr._id && <Check className="h-3 w-3 text-white" />}
                  </div>

                  {/* Address content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded-full text-xs font-medium text-gray-700">
                        {getAddressIcon(addr.addressType || "Other")}
                        {addr.addressType || addr.label || "Address"}
                      </span>
                      {addr.isDefault && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 border border-amber-200 rounded-full text-xs font-medium text-amber-700">
                          <Star className="h-3 w-3 fill-amber-400" /> Default
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-900">{addr.line1}</p>
                    {addr.line2 && <p className="text-sm text-gray-600">{addr.line2}</p>}
                    {addr.landmark && <p className="text-xs text-gray-500">Near: {addr.landmark}</p>}
                    <p className="text-sm text-gray-600">{addr.city}, {addr.state} — {addr.pincode}</p>
                    {addr.alternatePhone && (
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {addr.alternatePhone}
                      </p>
                    )}
                    {addr.deliveryInstructions && (
                      <p className="text-xs text-muted-foreground mt-1 italic">"{addr.deliveryInstructions}"</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    {!addr.isDefault && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleSetDefault(addr._id); }}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-amber-600 transition-colors"
                        title="Set as default"
                      >
                        <Star className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(addr._id); }}
                      className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                      title="Remove address"
                      disabled={deletingId === addr._id}
                    >
                      {deletingId === addr._id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Add New Address Button */}
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="w-full py-4 border-2 border-dashed border-gray-300 rounded-xl text-sm font-medium text-gray-600 hover:border-primary hover:text-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add a new address
          </button>
        )}

        {/* New Address Form */}
        {showForm && (
          <Card className="p-6 border-2 border-primary/30 bg-white">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Add New Address
            </h3>

            {/* Address Type */}
            <div className="mb-4">
              <label className="text-sm font-medium text-gray-700 mb-2 block">Address Type</label>
              <div className="flex gap-2">
                {(["Home", "Office", "Other"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFormData({ ...formData, addressType: type })}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                      formData.addressType === type
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    {getAddressIcon(type)} {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Address Line 1 */}
            <div className="mb-3">
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Address Line 1 <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="Flat / House no., Building, Street"
                value={formData.line1}
                onChange={(e) => setFormData({ ...formData, line1: e.target.value })}
                className="h-11"
              />
            </div>

            {/* Address Line 2 */}
            <div className="mb-3">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Address Line 2</label>
              <Input
                placeholder="Area, Colony, Sector (optional)"
                value={formData.line2}
                onChange={(e) => setFormData({ ...formData, line2: e.target.value })}
                className="h-11"
              />
            </div>

            {/* Landmark */}
            <div className="mb-3">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Landmark</label>
              <Input
                placeholder="Near temple, school, etc. (optional)"
                value={formData.landmark}
                onChange={(e) => setFormData({ ...formData, landmark: e.target.value })}
                className="h-11"
              />
            </div>

            {/* City + Pincode */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  City <span className="text-red-500">*</span>
                </label>
                <Input
                  placeholder="City / Town"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="h-11"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Pincode <span className="text-red-500">*</span>
                </label>
                <Input
                  placeholder="6-digit pincode"
                  value={formData.pincode}
                  onChange={(e) => setFormData({ ...formData, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) })}
                  maxLength={6}
                  className="h-11"
                />
              </div>
            </div>

            {/* State */}
            <div className="mb-3">
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                State <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                className="w-full h-11 px-3 rounded-md border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              >
                <option value="">Select state</option>
                {INDIAN_STATES.map((state) => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
            </div>

            {/* Alternate Phone */}
            <div className="mb-3">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Alternate Phone</label>
              <Input
                placeholder="10-digit mobile number (optional)"
                value={formData.alternatePhone}
                onChange={(e) => setFormData({ ...formData, alternatePhone: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                maxLength={10}
                className="h-11"
              />
            </div>

            {/* Delivery Instructions */}
            <div className="mb-4">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Delivery Instructions</label>
              <Input
                placeholder="Ring doorbell, leave at gate, etc. (optional)"
                value={formData.deliveryInstructions}
                onChange={(e) => setFormData({ ...formData, deliveryInstructions: e.target.value })}
                className="h-11"
              />
            </div>

            {/* Set as default */}
            <label className="flex items-center gap-2 mb-5 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isDefault}
                onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary/20"
              />
              <span className="text-sm text-gray-700">Set as default address</span>
            </label>

            {/* Form Actions */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setShowForm(false); setFormData(emptyForm); setError(null); }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-primary hover:bg-primary/90"
                onClick={handleAddAddress}
                disabled={saving}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Save Address
              </Button>
            </div>
          </Card>
        )}

        {/* Proceed Button */}
        {!showForm && addresses.length > 0 && (
          <div className="mt-8 sticky bottom-4">
            <Button
              className="w-full h-14 text-base font-bold bg-primary hover:bg-primary/90 rounded-xl shadow-lg"
              disabled={!selectedId}
              onClick={handleProceedToCheckout}
            >
              <MapPin className="h-5 w-5 mr-2" />
              Deliver to this address
            </Button>
          </div>
        )}

        {/* Empty state */}
        {addresses.length === 0 && !showForm && (
          <div className="text-center py-12">
            <MapPin className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-700 mb-2">No saved addresses</h3>
            <p className="text-sm text-muted-foreground mb-4">Add an address to continue with your order</p>
            <Button onClick={() => setShowForm(true)} className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" /> Add your first address
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
