
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

export interface BudgetData {
  income: IncomeSource[];
  expenses: ExpenseItem[];
  oneTimePayments: OneTimePayment[];
}
