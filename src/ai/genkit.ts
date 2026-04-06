import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

const googleApiKey = process.env.GOOGLE_API_KEY;

export const ai = genkit({
  plugins: googleApiKey ? [googleAI({ apiKey: googleApiKey })] : [],
  ...(googleApiKey ? { model: 'googleai/gemini-2.0-flash' } : {}),
});
