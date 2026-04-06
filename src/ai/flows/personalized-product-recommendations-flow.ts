'use server';
/**
 * @fileOverview A Genkit flow for generating personalized product recommendations.
 *
 * - personalizedProductRecommendations - A function that handles the generation of personalized product recommendations.
 * - PersonalizedProductRecommendationsInput - The input type for the personalizedProductRecommendations function.
 * - PersonalizedProductRecommendationsOutput - The return type for the personalizedProductRecommendations function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const PersonalizedProductRecommendationsInputSchema = z.object({
  userId: z.string().optional().describe('The ID of the user for whom recommendations are being generated.'),
  browsingHistory: z
    .array(z.string())
    .describe('A list of product names or descriptions the user has recently viewed.'),
  pastPurchases: z
    .array(z.string())
    .describe('A list of product names or descriptions the user has previously purchased.'),
  currentQuery: z
    .string()
    .optional()
    .describe('An optional current search query or interest expressed by the user.'),
});
export type PersonalizedProductRecommendationsInput = z.infer<
  typeof PersonalizedProductRecommendationsInputSchema
>;

const RecommendedProductSchema = z.object({
  productId: z.string().optional().describe('A unique identifier for the recommended product.'),
  productName: z.string().describe('The name of the recommended product.'),
  category:
    z.string().describe(
      'The category of the recommended product (e.g., Embroidery Designs, Machine Threads, Fabrics, Stabilizers, Needles, Hoops & Frames, Spare Parts, Accessories).'
    ),
  reason: z.string().describe('A brief explanation of why this product is recommended.'),
});

const PersonalizedProductRecommendationsOutputSchema = z.object({
  recommendations: z
    .array(RecommendedProductSchema)
    .describe('A list of personalized product recommendations.'),
});
export type PersonalizedProductRecommendationsOutput = z.infer<
  typeof PersonalizedProductRecommendationsOutputSchema
>;

export async function personalizedProductRecommendations(
  input: PersonalizedProductRecommendationsInput
): Promise<PersonalizedProductRecommendationsOutput> {
  return personalizedProductRecommendationsFlow(input);
}

function buildFallbackRecommendations(
  input: PersonalizedProductRecommendationsInput
): PersonalizedProductRecommendationsOutput {
  const history = [...(input.browsingHistory || []), ...(input.pastPurchases || [])].join(' ').toLowerCase();
  const wantsApparel = /hoodie|blouse|garment|fabric|thread|stitch/.test(history) || /wedding|festive|custom/.test((input.currentQuery || '').toLowerCase());

  return {
    recommendations: [
      {
        productId: 'fallback-design-pack',
        productName: 'Royal Zardosi Floral Pack',
        category: 'Embroidery Designs',
        reason: 'A premium design pack that aligns with traditional embroidery and detailed custom work.',
      },
      {
        productId: 'fallback-thread-set',
        productName: 'Vibrant Silk Thread Set',
        category: 'Machine Threads',
        reason: 'Useful for finishing custom garments and matching ornate embroidery palettes.',
      },
      {
        productId: wantsApparel ? 'fallback-hoodie' : 'fallback-blouse',
        productName: wantsApparel ? 'Premium Cotton Hoodie - Jet Black' : 'Silk Blend Blouse Piece',
        category: wantsApparel ? 'Hoodies' : 'Blouses',
        reason: wantsApparel
          ? 'A dependable apparel base for personalized embroidery and premium gifting.'
          : 'A refined base garment that works well for festive customization and elegant embroidery.',
      },
    ],
  };
}

const recommendationsPrompt = ai.definePrompt({
  name: 'personalizedProductRecommendationsPrompt',
  input: {schema: PersonalizedProductRecommendationsInputSchema},
  output: {schema: PersonalizedProductRecommendationsOutputSchema},
  prompt: `You are an expert in computer embroidery products, acting as a personalized shopping assistant.
Your goal is to provide highly relevant product recommendations to a customer based on their past interactions and stated interests.

Consider the following information about the customer:
- User ID: {{{userId}}}
- Recent Browsing History: {{{browsingHistory}}}
- Past Purchases: {{{pastPurchases}}}
{{#if currentQuery}}
- Current Interest/Query: {{{currentQuery}}}
{{/if}}

Based on this information, recommend 3-5 distinct products from the embroidery industry. Focus on categories such as Embroidery Designs, Machine Threads, Fabrics, Stabilizers, Needles, Hoops & Frames, Spare Parts, and Accessories.

For each recommendation, provide:
1. A unique 'productId' (can be a generated placeholder if a real one is not known).
2. The 'productName'.
3. The 'category' of the product.
4. A 'reason' explaining why this product is recommended, specifically linking it to the user's history or current interest.

Ensure the recommendations are varied, relevant to the embroidery niche, and avoid suggesting products already explicitly listed in their browsing history or past purchases.
`,
});

const personalizedProductRecommendationsFlow = ai.defineFlow(
  {
    name: 'personalizedProductRecommendationsFlow',
    inputSchema: PersonalizedProductRecommendationsInputSchema,
    outputSchema: PersonalizedProductRecommendationsOutputSchema,
  },
  async input => {
    try {
      const {output} = await recommendationsPrompt(input);
      if (!output) {
        return buildFallbackRecommendations(input);
      }

      return output;
    } catch (error) {
      return buildFallbackRecommendations(input);
    }
  }
);
