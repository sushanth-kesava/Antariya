import {genkit} from 'genkit';
import openAI from '@genkit-ai/compat-oai/openai';

const openAiApiKey = process.env.OPENAI_API_KEY;

export const ai = genkit({
  plugins: openAiApiKey ? [openAI({ apiKey: openAiApiKey })] : [],
  ...(openAiApiKey ? { model: 'openai/gpt-4o-mini' } : {}),
});
