
import { GoogleGenAI, Type } from "@google/genai";
import { BudgetData, GroceryCategory, CategoryOverride } from "../types";

export const analyzeBudget = async (data: BudgetData): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    Analyze the following monthly budget and provide 3-5 concise, actionable financial tips.
    Income: ${JSON.stringify(data.income)}
    Monthly Expenses: ${JSON.stringify(data.expenses)}
    One-time Payments: ${JSON.stringify(data.oneTimePayments)}
    Loans: ${JSON.stringify(data.loans)}
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

export const processGeneralBill = async (base64Images: string[]): Promise<any> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    Follow this two-step reasoning flow:
    1. INTERNAL TRANSCRIPTION: Process the image(s) and convert all visible text into a clean, structured internal table. 
    2. DATA EXTRACTION: From that internal table, fetch: merchantName, date (YYYY-MM-DD), total amount (number), and a short summary.
    
    If the photo is unclear, use neighboring context and common merchant patterns to infer missing characters.
    Return the result as a JSON object.
  `;

  const imageParts = base64Images.map(img => ({
    inlineData: { 
      mimeType: "image/jpeg", 
      data: img.split(',')[1] || img 
    }
  }));

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: {
        parts: [
          { text: prompt },
          ...imageParts
        ]
      },
      config: {
        thinkingConfig: { thinkingBudget: 2000 },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            merchantName: { type: Type.STRING },
            date: { type: Type.STRING },
            amount: { type: Type.NUMBER },
            summary: { type: Type.STRING },
          },
          propertyOrdering: ["merchantName", "date", "amount", "summary"],
        }
      }
    });

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("General Bill OCR Error:", error);
    throw error;
  }
};

export const processGroceryBill = async (
  base64Images: string[], 
  categories: GroceryCategory[], 
  overrides: Record<string, CategoryOverride> = {}
): Promise<any> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const categoryContext = categories.map(c => 
    `${c.name}: [${c.subCategories.map(s => s.name).join(', ')}]`
  ).join('\n');

  const overrideContext = Object.entries(overrides).length > 0 
    ? `USER PREFERENCES:\n${Object.entries(overrides).map(([desc, ov]) => `- "${desc}" is ${ov.categoryName} -> ${ov.subCategoryName}`).join('\n')}`
    : "";

  const prompt = `
    Perform high-precision data capture following this sequence:
    
    STEP 1: INTERNAL TRANSCRIPTION
    Convert the grocery bill image(s) into a clean, structured mental table. Identify every row and column (Description, Qty, Unit Price, Total). 
    If text is blurry, use common grocery patterns (e.g., 'BANA' = Banana, 'COCO OIL' = Coconut Oil) and mathematical deduction (Total / Qty = Unit Price) to reconstruct the data.

    STEP 2: STRUCTURED EXTRACTION
    From your internal table, fetch the item names, quantities, unit prices, and total amounts. 
    Map each item to these categories:
    ${categoryContext}
    
    Respect these overrides:
    ${overrideContext}
    
    Return a final JSON object:
    - shopName (string)
    - date (YYYY-MM-DD)
    - items (array: {description, quantity, unit, unitCost, totalCost, categoryName, subCategoryName})
  `;

  const imageParts = base64Images.map(img => ({
    inlineData: { 
      mimeType: "image/jpeg", 
      data: img.split(',')[1] || img 
    }
  }));

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: {
        parts: [
          { text: prompt },
          ...imageParts
        ]
      },
      config: {
        thinkingConfig: { thinkingBudget: 2500 },
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
                },
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

export const processLoanScreenshot = async (base64Image: string): Promise<any> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `
    1. Internally transcribe the financial screenshot into a clean table of transactions.
    2. Fetch the date, description, amount, and suggest a logical account name for each row.
    Return JSON {transactions: [...]}.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: {
        parts: [
          { text: prompt },
          { inlineData: { mimeType: "image/jpeg", data: base64Image.split(',')[1] || base64Image } }
        ]
      },
      config: {
        thinkingConfig: { thinkingBudget: 1500 },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            transactions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  date: { type: Type.STRING },
                  description: { type: Type.STRING },
                  amount: { type: Type.NUMBER },
                  suggestedAccount: { type: Type.STRING },
                }
              }
            }
          }
        }
      }
    });

    return JSON.parse(response.text || '{"transactions": []}');
  } catch (error) {
    console.error("Loan OCR Processing Error:", error);
    throw error;
  }
};
