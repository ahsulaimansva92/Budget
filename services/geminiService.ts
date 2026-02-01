import { GoogleGenAI, Type } from "@google/genai";
import { BudgetData, GroceryCategory } from "../types";

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
    Analyze these bill image(s) and extract the merchant name, date (YYYY-MM-DD), total amount, and a summary.
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
        parts: [{ text: prompt }, ...imageParts]
      },
      config: {
        thinkingConfig: { thinkingBudget: 1500 },
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
  categories: GroceryCategory[]
): Promise<any> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Construct a simple taxonomy for the model to reference
  const taxonomy = categories.map(c => ({
    category: c.name,
    subCategories: c.subCategories.map(s => s.name)
  }));

  const prompt = `
    You are a smart Grocery Bill OCR Scanner.
    
    TASK:
    1. Analyze the provided image(s) (which may be multiple screenshots of one long bill).
    2. Extract the Shop Name and Bill Date.
    3. Extract every line item with its Description, Quantity, and Amount (Total Cost).
    4. CLASSIFY each item into the correct Category and Sub-Category from the provided list.

    CATEGORY LIST:
    ${JSON.stringify(taxonomy)}

    OUTPUT FORMAT:
    Return a JSON object with:
    - shopName
    - date
    - items: Array of { description, quantity, totalCost, categoryName, subCategoryName }
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
        parts: [{ text: prompt }, ...imageParts]
      },
      config: {
        thinkingConfig: { thinkingBudget: 2000 },
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
                  totalCost: { type: Type.NUMBER },
                  categoryName: { type: Type.STRING },
                  subCategoryName: { type: Type.STRING },
                },
                required: ["description", "totalCost", "categoryName", "subCategoryName"]
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
    Extract date, description, and amount from this financial screenshot. Suggest an account name.
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