
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

export const processGroceryBill = async (
  base64Image: string, 
  categories: GroceryCategory[], 
  overrides: Record<string, CategoryOverride> = {}
): Promise<any> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const categoryContext = categories.map(c => 
    `${c.name}: [${c.subCategories.map(s => s.name).join(', ')}]`
  ).join('\n');

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
            transactions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  date: { type: Type.STRING },
                  description: { type: Type.STRING },
                  amount: { type: Type.NUMBER },
                  suggestedAccount: { type: Type.STRING, description: "Group transactions into logical account names" },
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

export const processBankStatement = async (base64Image: string): Promise<any> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    Analyze this bank statement image. Extract all transactions.
    
    For each transaction, identify:
    1. Date (YYYY-MM-DD format)
    2. Description (Transaction details)
    3. Amount (Positive Number)
    4. Type: Is it 'credit' (money in / deposit) or 'debit' (money out / withdrawal / expense)?

    Return a JSON object containing:
    - statementDate (string - likely month/year)
    - transactions (array of objects with date, description, amount, type)
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
            statementDate: { type: Type.STRING },
            transactions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  date: { type: Type.STRING },
                  description: { type: Type.STRING },
                  amount: { type: Type.NUMBER },
                  type: { type: Type.STRING, enum: ['credit', 'debit'] },
                }
              }
            }
          }
        }
      }
    });

    return JSON.parse(response.text || '{"transactions": []}');
  } catch (error) {
    console.error("Bank Statement OCR Processing Error:", error);
    throw error;
  }
};
