
// Single source of truth for Antariya's two-level T-shirt category system.
//
// Structure: CATEGORY (top-level section) -> SUB-CATEGORIES (items).
// A product is tagged with one `category` (the section) and one
// `subCategory` (an item within it), Amazon-style.
//
// Used by:
//  - Admin "Add Product": category dropdown -> sub-category dropdown.
//  - Customer marketplace: expandable category sidebar (category -> sub-cats).
//  - Homepage "Shop by Category" bar (curated highlights).

// ---------------------------------------------------------------------------
// GLOBAL GENDER CATEGORIES (top-level "parent nodes" of the whole catalog).
//
// Every product carries a `gender` field ("Men" | "Women" | "Unisex").
// These act as the highest-level entry points into the marketplace: a shopper
// picks who they're shopping for, then sees only that audience's products.
//
// `value` MUST match the product `gender` field value used on the Add-Product
// form (see PRODUCT_ATTRIBUTES.gender below).
// ---------------------------------------------------------------------------
export type GenderCategory = {
  /** Display label for the card. */
  label: string;
  /** The `gender` field value to filter products by. */
  value: string;
  /** Short marketing tagline shown on the card. */
  description: string;
  /** Optional fallback image if no live product image is available for the card. */
  fallbackImage?: string;
};

export const GENDER_CATEGORIES: GenderCategory[] = [
  {
    label: "Men's",
    value: "Men",
    description: "T-shirts & apparel for him",
  },
  {
    label: "Women's",
    value: "Women",
    description: "T-shirts & apparel for her",
  },
  {
    label: "Unisex",
    value: "Unisex",
    description: "Styles for everyone",
  },
  {
    // "All Products" is not a gender — an empty value clears the gender filter
    // and shows the entire catalogue.
    label: "All Products",
    value: "",
    description: "Browse the entire collection",
  },
];

export type CategoryDefinition = {
  /** Top-level category name (the section). */
  category: string;
  /** Short label for compact UI (nav, chips). */
  shortLabel: string;
  /** Lucide icon component name for this category. */
  icon: string;
  /** Sub-categories within this category. */
  subCategories: string[];
};

export const CATEGORY_TREE: CategoryDefinition[] = [
  {
    category: "Collections",
    shortLabel: "Collections",
    icon: "Sparkles",
    subCategories: [
      "Signature Collection",
      "Performance Collection",
      "Essentials Collection",
      "Luxury Basics",
      "Heritage Collection",
      "Motorsport Collection",
      "Urban Street Collection",
      "Anime Collection",
      "Minimal Collection",
      "Vintage Collection",
      "Artist Collaboration Collection",
      "Limited Edition",
      "Exclusive Drop",
      "Oversized Premium Collection",
    ],
  },
  {
    category: "Sleeve Type",
    shortLabel: "Sleeve",
    icon: "Shirt",
    subCategories: [
      "Half Sleeve T-Shirt",
      "Full Sleeve T-Shirt",
      "Sleeveless T-Shirt",
      "Raglan Sleeve T-Shirt",
    ],
  },
  {
    category: "Fit",
    shortLabel: "Fit",
    icon: "Ruler",
    subCategories: [
      "Regular Fit",
      "Slim Fit",
      "Oversized Fit",
      "Relaxed Fit",
      "Boxy Fit",
      "Muscle Fit",
      "Athletic Fit",
      "Cropped Fit",
      "Longline Fit",
    ],
  },
  {
    category: "Fabric",
    shortLabel: "Fabric",
    icon: "Layers",
    subCategories: [
      "100% Cotton",
      "Organic Cotton",
      "Combed Cotton",
      "Supima Cotton",
      "Pima Cotton",
      "Cotton Blend",
      "Polyester",
      "Poly-Cotton Blend",
      "Cotton Lycra (Stretch)",
      "Bamboo Fabric",
      "Linen Blend",
      "Modal",
      "Rayon",
      "Dry-Fit Fabric",
      "French Terry",
      "Waffle Knit",
    ],
  },
  {
    category: "Style",
    shortLabel: "Style",
    icon: "Palette",
    subCategories: [
      "Basic Tee",
      "Pocket T-Shirt",
      "Drop Shoulder T-Shirt",
      "Oversized Streetwear Tee",
      "Vintage Tee",
      "Washed Tee",
      "Distressed Tee",
      "Layered Tee",
      "Hooded T-Shirt",
      "Zip T-Shirt",
      "Color Block T-Shirt",
      "Panel T-Shirt",
      "Henley T-Shirt",
      "Baseball Tee",
      "Polo T-Shirt",
      "Graphic Printed",
    ],
  },
  {
    category: "Occasion",
    shortLabel: "Occasion",
    icon: "CalendarHeart",
    subCategories: [
      "Casual Wear",
      "Streetwear",
      "Gym/Fitness",
      "Sports",
      "Running",
      "Travel",
      "Party Wear",
      "College Wear",
      "Lounge Wear",
      "Workwear",
      "Vacation Wear",
    ],
  },
  {
    category: "Audience",
    shortLabel: "Audience",
    icon: "Users",
    subCategories: [
      "Men's T-Shirts",
      "Women's T-Shirts",
      "Unisex T-Shirts",
      "Kids' T-Shirts",
      "Couple T-Shirts",
      "Family T-Shirts",
    ],
  },
];

/** All top-level category names, in display order. */
export const CATEGORIES: string[] = CATEGORY_TREE.map((entry) => entry.category);

/** Look up a category definition by its top-level name. */
export function getCategoryDefinition(category: string): CategoryDefinition | undefined {
  return CATEGORY_TREE.find((entry) => entry.category === category);
}

/** Sub-categories for a given top-level category (empty if unknown). */
export function getSubCategories(category: string): string[] {
  return getCategoryDefinition(category)?.subCategories ?? [];
}

/** Icon component name for a category, with a sensible fallback. */
export function getCategoryIconName(category: string): string {
  return getCategoryDefinition(category)?.icon ?? "Shirt";
}

/** Flat list of every sub-category across all categories. */
export const ALL_SUB_CATEGORIES: string[] = CATEGORY_TREE.flatMap((entry) => entry.subCategories);

/**
 * Curated highlights for the homepage "Shop by Category" bar.
 * Each links to a marketplace view filtered by category + sub-category.
 */
export const CURATED_HIGHLIGHTS: { label: string; category: string; subCategory: string; icon: string }[] = [
  { label: "Oversized", category: "Fit", subCategory: "Oversized Fit", icon: "Boxes" },
  { label: "Regular Fit", category: "Fit", subCategory: "Regular Fit", icon: "Shirt" },
  { label: "Premium Cotton", category: "Fabric", subCategory: "Supima Cotton", icon: "Gem" },
  { label: "Graphic Printed", category: "Style", subCategory: "Graphic Printed", icon: "Palette" },
  { label: "Minimal", category: "Collections", subCategory: "Minimal Collection", icon: "Layers" },
  { label: "Motorsport", category: "Collections", subCategory: "Motorsport Collection", icon: "Zap" },
  { label: "Anime", category: "Collections", subCategory: "Anime Collection", icon: "Sparkles" },
  { label: "Streetwear", category: "Occasion", subCategory: "Streetwear", icon: "Flame" },
  { label: "Signature", category: "Collections", subCategory: "Signature Collection", icon: "Gem" },
  { label: "Limited Edition", category: "Collections", subCategory: "Limited Edition", icon: "Sparkles" },
  { label: "Essentials", category: "Collections", subCategory: "Essentials Collection", icon: "Layers" },
  { label: "Full Sleeve", category: "Sleeve Type", subCategory: "Full Sleeve T-Shirt", icon: "Shirt" },
  { label: "Polo", category: "Style", subCategory: "Polo T-Shirt", icon: "Shirt" },
  { label: "Sleeveless", category: "Sleeve Type", subCategory: "Sleeveless T-Shirt", icon: "Wind" },
];


// ---------------------------------------------------------------------------
// Product attributes (additional dropdowns on the Add-Product form).
// Each attribute maps to a field saved on the product and filterable.
// ---------------------------------------------------------------------------

export type ProductAttribute = {
  /** Product field key (also the query-param / DB field name). */
  key: "size" | "color" | "gender" | "neckType" | "pattern";
  /** Human label shown on the form. */
  label: string;
  /** Selectable options. */
  options: string[];
};

export const PRODUCT_ATTRIBUTES: ProductAttribute[] = [
  {
    key: "size",
    label: "Size",
    options: ["XS", "S", "M", "L", "XL", "XXL"],
  },
  {
    key: "color",
    label: "Color",
    options: ["Black", "White", "Navy", "Maroon", "Olive", "Beige"],
  },
  {
    key: "gender",
    label: "Gender",
    options: ["Men", "Women", "Unisex", "Kids"],
  },
  {
    key: "neckType",
    label: "Neck Type",
    options: ["Round Neck", "V-Neck", "Polo", "Henley", "Hooded"],
  },
  {
    key: "pattern",
    label: "Pattern",
    options: ["Solid", "Graphic Printed", "Striped", "Color Block", "Typography"],
  },
];

/** The product attribute field keys, in form order. */
export const PRODUCT_ATTRIBUTE_KEYS = PRODUCT_ATTRIBUTES.map((attr) => attr.key);
