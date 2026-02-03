
export interface IncomeSource {
  id: string;
  name: string;
  amount: number;
  isCashHandled?: boolean;
}

export type ExpenseSourceType = 'Salary' | 'Rent';

export interface ExpenseItem {
  id: string;
  name: string;
  amount: number;
  category: string;
  sourceType: ExpenseSourceType;
  isCashHandled?: boolean;
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
  isSynced?: boolean;
}

export interface CashData {
  openingBalance: number;
  income: CashEntry[];
  expenses: CashEntry[];
}

// Loan Tracking Types
export type LoanTransactionType = 'taken' | 'repayment';

export interface LoanTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: LoanTransactionType;
  imageUrl?: string;
}

export interface LoanAccount {
  id: string;
  name: string;
  openingBalance: number;
  transactions: LoanTransaction[];
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
  rawDescription?: string;
}

export interface GroceryBill {
  id: string;
  date: string;
  shopName: string;
  items: GroceryBillItem[];
  imageUrl?: string;
  totalAmount: number;
  isVerified?: boolean;
}

export interface CategoryOverride {
  categoryName: string;
  subCategoryName: string;
}

// Bank Statement Types
export type BankTransactionType = 'credit' | 'debit';

export interface BankTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: BankTransactionType;
}

export interface BankStatement {
  id: string;
  uploadDate: string;
  fileName: string; // e.g., "Statement - Jan 2026"
  imageUrl?: string;
  transactions: BankTransaction[];
}

export interface BudgetData {
  income: IncomeSource[];
  expenses: ExpenseItem[];
  oneTimePayments: OneTimePayment[];
  savings: SavingsData;
  cash: CashData;
  groceryCategories: GroceryCategory[];
  groceryBills: GroceryBill[];
  loans: LoanAccount[];
  bankStatements: BankStatement[];
  mappingOverrides?: Record<string, CategoryOverride>;
}
