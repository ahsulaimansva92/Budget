
import { GoogleGenAI } from "@google/genai";
import { BudgetData } from "../types";

export const analyzeBudget = async (data: BudgetData): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  
  const prompt = `
    Analyze the following monthly budget and provide 3-5 concise, actionable financial tips or observations.
    Income: ${JSON.stringify(data.income)}
    Monthly Expenses: ${JSON.stringify(data.expenses)}
    One-time Payments: ${JSON.stringify(data.oneTimePayments)}
    
    Focus on:
    1. Balance between salary-paid and rent-paid expenses.
    2. Savings percentage.
    3. Potential overspending in specific categories like food or petrol.
    
    Format the output as a professional brief with clear bullet points.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Could not generate insights at this time.";
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "The AI is currently unavailable to analyze your budget. Please try again later.";
  }
};
