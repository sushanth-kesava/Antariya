"use client";

import ProductDetailsClient from "./ProductDetailsClient";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://antariya.onrender.com";

type ProductsApiResponse = {
  success?: boolean;
  products?: Array<{ id?: string }>;
};

type ProductDetailApiResponse = {
  success?: boolean;
  product?: {
    name?: string;
    description?: string;
    image?: string;
    price?: number;
  };
};

type ProductPageProps = {
  params: { id: string };
};


export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = params;

  return <ProductDetailsClient id={id} />;
}
