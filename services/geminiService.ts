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
    Analyze these bill image(s) using this specific flow:
    1. IMAGE TRANSCRIPTION: Process the image and convert the layout into a clean, structured table representation of all text found.
    2. DATA EXTRACTION: From the clean table created in step 1, fetch: merchantName, date (YYYY-MM-DD), total amount (number), and a short summary.
    
    If the image is blurry, use the table's context to infer missing data.
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
    Extract data from these grocery bill images following this strict sequence:
    
    STEP 1: IMAGE TO TABLE TRANSCRIPTION
    Process the bill images and convert them into a clean, structured table. Every line item should be clearly identified with columns for Description, Quantity, Unit Price, and Total Amount. Handle multi-shot photos as one continuous bill.
    
    STEP 2: FIELD EXTRACTION
    From the structured table generated in Step 1, fetch the individual item names, quantities, unit prices, and total amounts. 
    Map each item to the appropriate category and subcategory from the list below:
    ${categoryContext}
    ${overrideContext}
    
    RECONSTRUCTION: If the image is blurry, use the table context and common grocery patterns (e.g., 'TMTO' is Tomato) and ensure (Qty * Unit Price = Total) holds true.
    
    Return JSON:
    - shopName (string)
    - date (YYYY-MM-DD)
    - items (array of {description, quantity, unit, unitCost, totalCost, categoryName, subCategoryName})
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