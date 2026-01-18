
import { GoogleGenAI, Type } from "@google/genai";
import { BudgetData, GroceryCategory, CategoryOverride } from "../types";

export const analyzeBudget = async (data: BudgetData): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    Analyze the following monthly budget and provide 3-5 concise, actionable financial tips.
    Income: ${JSON.stringify(data.income)}
    Monthly Expenses: ${JSON.stringify(data.expenses)}
    One-time Payments: ${JSON.stringify(data.oneTimePayments)}
    Format the output as a professional brief with clear bullet points.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Could not generate insights.";
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "AI Analysis temporarily unavailable.";
  }
};

export const processGroceryBill = async (
  base64Image: string, 
  categories: GroceryCategory[], 
  overrides: Record<string, CategoryOverride> = {}
): Promise<any> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const categoryContext = categories.map(c => 
    `${c.name}: [${c.subCategories.map(s => s.name).join(', ')}]`
  ).join('\n');

  // Stringify overrides for the prompt
  const overrideContext = Object.entries(overrides).length > 0 
    ? `USER PREFERENCES (Follow these strictly if you see these items again):\n${Object.entries(overrides).map(([desc, ov]) => `- "${desc}" should be ${ov.categoryName} -> ${ov.subCategoryName}`).join('\n')}`
    : "";

  const prompt = `
    Analyze this grocery bill image. Extract all items.
    For each item, determine its category and subcategory based on this list:
    ${categoryContext}
    
    ${overrideContext}
    
    CRITICAL: If an item is similar to one in the USER PREFERENCES, use the specified category/subcategory.
    
    Return a JSON object with:
    - shopName (string)
    - date (string, YYYY-MM-DD)
    - items (array):
      - description (string)
      - quantity (number)
      - unit (string, e.g., kg, g, pkt, unit)
      - unitCost (number)
      - totalCost (number)
      - categoryName (matching one from the list)
      - subCategoryName (matching one from the list)
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { text: prompt },
          { inlineData: { mimeType: "image/jpeg", data: base64Image.split(',')[1] || base64Image } }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            shopName: { type: Type.STRING },
            date: { type: Type.STRING },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  description: { type: Type.STRING },
                  quantity: { type: Type.NUMBER },
                  unit: { type: Type.STRING },
                  unitCost: { type: Type.NUMBER },
                  totalCost: { type: Type.NUMBER },
                  categoryName: { type: Type.STRING },
                  subCategoryName: { type: Type.STRING },
                }
              }
            }
          }
        }
      }
    });

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("OCR Processing Error:", error);
    throw error;
  }
};
