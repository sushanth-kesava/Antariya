'use server';
/**
 * @fileOverview A Genkit flow for visualizing embroidery designs on various fabric types and colors.
 *
 * - embroideryDesignVisualizer - A function that handles the visualization process.
 * - EmbroideryDesignVisualizerInput - The input type for the embroideryDesignVisualizer function.
 * - EmbroideryDesignVisualizerOutput - The return type for the embroideryDesignVisualizer function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const EmbroideryDesignVisualizerInputSchema = z.object({
  garmentImage: z
    .string()
    .describe(
      "A URL or base64 data URI of the base garment image where the embroidery should be rendered."
    ),
  embroideryDesignImage: z
    .string()
    .describe(
      "A URL or base64 data URI of the embroidery design image."
    ),
  fabricType: z
    .string()
    .describe('The type of fabric (e.g., "cotton", "silk", "denim").'),
  fabricColor: z
    .string()
    .describe('The color of the fabric (e.g., "red", "blue", "white").'),
});
export type EmbroideryDesignVisualizerInput = z.infer<
  typeof EmbroideryDesignVisualizerInputSchema
>;

const EmbroideryDesignVisualizerOutputSchema = z.object({
  visualizedImage: z
    .string()
    .describe(
      "A base64 data URI of the AI-generated image of the embroidery design rendered on the specified fabric. Expected format: 'data:<mimetype>;base64,<encoded_data>'"
    ),
  fallbackUsed: z
    .boolean()
    .describe('Whether the response used a local fallback instead of AI generation.'),
  message: z
    .string()
    .optional()
    .describe('Optional informational message about fallback behavior.'),
});
export type EmbroideryDesignVisualizerOutput = z.infer<
  typeof EmbroideryDesignVisualizerOutputSchema
>;

const embroideryDesignVisualizerFlow = ai.defineFlow(
  {
    name: 'embroideryDesignVisualizerFlow',
    inputSchema: EmbroideryDesignVisualizerInputSchema,
    outputSchema: EmbroideryDesignVisualizerOutputSchema,
  },
  async input => {
    try {
      const prompt = [
        'Create a realistic product mockup for an embroidered garment.',
        `Garment type: ${input.fabricType}.`,
        `Garment color: ${input.fabricColor}.`,
        'Render a clean studio-style apparel photo with natural folds and lighting.',
        'Place a tasteful embroidered motif on the chest area with visible stitched thread texture.',
        'Keep the output photorealistic, commercial, and suitable for an ecommerce product preview.',
        'Do not include text overlays, logos, watermarks, or extra objects.',
      ].join(' ');

      const {media} = await ai.generate({
        model: 'openai/gpt-image-1',
        prompt,
        config: {
          quality: 'low',
          output_format: 'jpeg',
          output_compression: 60,
          size: '1024x1024',
          n: 1,
        },
      });

      if (!media) {
        return {
          visualizedImage: input.garmentImage,
          fallbackUsed: true,
          message: 'AI preview is temporarily unavailable. Showing original garment image instead.',
        };
      }

      return {
        visualizedImage: media.url,
        fallbackUsed: false,
      };
    } catch (error: any) {
      const rawError = String(error?.message || '');
      const quotaExceeded =
        rawError.includes('RESOURCE_EXHAUSTED') ||
        rawError.includes('insufficient_quota') ||
        rawError.includes('429');

      console.error('Embroidery preview generation failed:', rawError);

      return {
        visualizedImage: input.garmentImage,
        fallbackUsed: true,
        message: quotaExceeded
          ? 'OpenAI quota exceeded. Add billing or try again later. Showing original design image.'
          : 'AI preview failed. Showing original garment image as fallback.',
      };
    }
  }
);

export async function embroideryDesignVisualizer(
  input: EmbroideryDesignVisualizerInput
): Promise<EmbroideryDesignVisualizerOutput> {
  return embroideryDesignVisualizerFlow(input);
}
