
import { GoogleGenAI, Type } from "@google/genai";
import { BudgetData, GroceryCategory, CategoryOverride } from "../types";

export const analyzeBudget = async (data: BudgetData): Promise<string> => {
  // Always use a named parameter for apiKey and obtain it from process.env.API_KEY
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
    // Use gemini-3-flash-preview for basic text tasks like summarization and Q&A
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    // Use .text property directly, it's not a method
    return response.text || "Could not generate insights.";
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "AI Analysis temporarily unavailable.";
  }
};

export const processGroceryBill = async (
  base64Images: string[], 
  categories: GroceryCategory[], 
  overrides: Record<string, CategoryOverride> = {}
): Promise<any> => {
  // Obtain API key from environment variable
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const categoryContext = categories.map(c => 
    `${c.name}: [${c.subCategories.map(s => s.name).join(', ')}]`
  ).join('\n');

  const overrideContext = Object.entries(overrides).length > 0 
    ? `USER PREFERENCES (Follow these strictly if you see these items again):\n${Object.entries(overrides).map(([desc, ov]) => `- "${desc}" should be ${ov.categoryName} -> ${ov.subCategoryName}`).join('\n')}`
    : "";

  const prompt = `
    Analyze these grocery bill image(s). They may be multiple screenshots of the same long bill. Extract all items across all images.
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

  const imageParts = base64Images.map(img => ({
    inlineData: { 
      mimeType: "image/jpeg", 
      data: img.split(',')[1] || img 
    }
  }));

  try {
    // Use gemini-3-pro-preview for complex reasoning tasks like multimodal OCR and categorization
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: {
        parts: [
          { text: prompt },
          ...imageParts
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
                },
                propertyOrdering: ["description", "quantity", "unit", "unitCost", "totalCost", "categoryName", "subCategoryName"],
              }
            }
          },
          propertyOrdering: ["shopName", "date", "items"],
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
    Analyze this screenshot containing financial loan or repayment transactions.
    Extract every individual transaction found.
    For each transaction, determine:
    1. Date (YYYY-MM-DD)
    2. Description/Reason (Be descriptive)
    3. Amount (number)
    4. Logical Account Name (Group similar transactions by their likely purpose or creditor name)

    Return a JSON object containing an array of 'transactions'.
  `;

  try {
    // Use gemini-3-pro-preview for complex text and visual analysis
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
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
            transactions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  date: { type: Type.STRING },
                  description: { type: Type.STRING },
                  amount: { type: Type.NUMBER },
                  suggestedAccount: { type: Type.STRING, description: "Group transactions into logical account names" },
                },
                propertyOrdering: ["date", "description", "amount", "suggestedAccount"],
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
