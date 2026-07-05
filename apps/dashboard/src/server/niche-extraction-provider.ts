import { GoogleGenerativeAI } from "@google/generative-ai";

export interface NicheExtractionProvider {
  generate(prompt: string): Promise<string>;
}

export const nicheExtractionProvider: NicheExtractionProvider = {
  async generate(prompt) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Gemini API key is not configured");

    const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
      model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
      generationConfig: { responseMimeType: "application/json" },
    });
    const result = await model.generateContent(prompt);
    return result.response.text();
  },
};
