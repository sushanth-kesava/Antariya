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
import {googleAI} from '@genkit-ai/google-genai';

const EmbroideryDesignVisualizerInputSchema = z.object({
  embroideryDesignImage: z
    .string()
    .describe(
      "A base64 data URI of the embroidery design image. Expected format: 'data:<mimetype>;base64,<encoded_data>'"
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
    // Extract MIME type from the data URI for the media part
    const mimeMatch = input.embroideryDesignImage.match(/^data:(.*?);base64,/);
    const contentType = mimeMatch ? mimeMatch[1] : 'image/png'; // Default to image/png if not found

    const {media} = await ai.generate({
      model: googleAI.model('gemini-2.5-flash-image'), // Use the image-to-image model
      prompt: [
        {
          media: {url: input.embroideryDesignImage, contentType: contentType},
        },
        {
          text: `Render this embroidery design on a ${input.fabricColor} ${input.fabricType} fabric. Ensure the embroidery design is clearly visible and integrated naturally onto the fabric texture, respecting the fabric's texture and drape. The fabric should look realistic, and the embroidery should appear stitched onto it.`,
        },
      ],
      config: {
        responseModalities: ['TEXT', 'IMAGE'], // As per guidance, must provide both TEXT and IMAGE.
      },
    });

    if (!media) {
      throw new Error(
        'Failed to generate visual preview: No media output from AI model.'
      );
    }

    return {
      visualizedImage: media.url,
    };
  }
);

export async function embroideryDesignVisualizer(
  input: EmbroideryDesignVisualizerInput
): Promise<EmbroideryDesignVisualizerOutput> {
  return embroideryDesignVisualizerFlow(input);
}
