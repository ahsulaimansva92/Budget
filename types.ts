
export interface IncomeSource {
  id: string;
  name: string;
  amount: number;
}

export type ExpenseSourceType = 'Salary' | 'Rent';

export interface ExpenseItem {
  id: string;
  name: string;
  amount: number;
  category: string;
  sourceType: ExpenseSourceType;
}

export interface OneTimePayment {
  id: string;
  title: string;
  totalAmount: number;
  paidAmount: number;
  dueDate: string;
}

export interface SavingsEntry {
  id: string;
  amount: number;
  date: string;
}

export interface SavingsWithdrawal {
  id: string;
  amount: number;
  date: string;
  reason: string;
}

export interface SavingsData {
  openingBalance: number;
  additions: SavingsEntry[];
  withdrawals: SavingsWithdrawal[];
}

export interface CashEntry {
  id: string;
  date: string;
  description: string;
  amount: number;
}

export interface CashData {
  openingBalance: number;
  income: CashEntry[];
  expenses: CashEntry[];
}

// Grocery Tracker Types
export interface GrocerySubCategory {
  id: string;
  name: string;
}

export interface GroceryCategory {
  id: string;
  name: string;
  subCategories: GrocerySubCategory[];
}

export interface GroceryBillItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  categoryId: string;
  subCategoryId: string;
  rawDescription?: string; // For audit trail
}

export interface GroceryBill {
  id: string;
  date: string;
  shopName: string;
  items: GroceryBillItem[];
  imageUrl?: string;
  totalAmount: number;
}

export interface BudgetData {
  income: IncomeSource[];
  expenses: ExpenseItem[];
  oneTimePayments: OneTimePayment[];
  savings: SavingsData;
  cash: CashData;
  groceryCategories: GroceryCategory[];
  groceryBills: GroceryBill[];
}
