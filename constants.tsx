
import { BudgetData, ExpenseItem } from './types';

export const INITIAL_DATA: BudgetData = {
  income: [
    { id: 'inc-1', name: 'Salary', amount: 385000 },
    { id: 'inc-2', name: 'Rent Income', amount: 110000 }
  ],
  expenses: [
    // Paid by Salary
    { id: 'exp-1', name: 'Food', amount: 90000, category: 'Automatic Payments', sourceType: 'Salary' },
    { id: 'exp-2', name: 'Electricity Pedris', amount: 8000, category: 'Automatic Payments', sourceType: 'Salary' },
    { id: 'exp-3', name: 'Water Pedris', amount: 2500, category: 'Automatic Payments', sourceType: 'Salary' },
    { id: 'exp-4', name: 'Internet', amount: 1099, category: 'Automatic Payments', sourceType: 'Salary' },
    { id: 'exp-5', name: 'Phone internet+reload', amount: 1787, category: 'Automatic Payments', sourceType: 'Salary' },
    { id: 'exp-6', name: 'Life Insurance', amount: 30000, category: 'Automatic Payments', sourceType: 'Salary' },
    { id: 'exp-7', name: 'Credit Card Payments', amount: 6000, category: 'Automatic Payments', sourceType: 'Salary' },
    { id: 'exp-8', name: 'Inshi', amount: 80000, category: 'Automatic Payments', sourceType: 'Salary' },
    { id: 'exp-9', name: 'Adhila', amount: 28000, category: 'Automatic Payments', sourceType: 'Salary' },
    { id: 'exp-10', name: 'School Fees to Mama', amount: 18500, category: 'Automatic Payments', sourceType: 'Salary' },
    { id: 'exp-11', name: 'Vehicle Lease Payments', amount: 29000, category: 'Automatic & Manual Payments', sourceType: 'Salary' },
    { id: 'exp-12', name: 'NDB Savings', amount: 50000, category: 'Automatic & Manual Payments', sourceType: 'Salary' },
    { id: 'exp-13', name: 'Petrol', amount: 18000, category: 'Specific Card', sourceType: 'Salary' },
    { id: 'exp-14', name: 'Entertainment & Other', amount: 20000, category: 'Specific Card', sourceType: 'Salary' },
    
    // Paid by Rent
    { id: 'exp-15', name: 'Psychiatrist Doctor', amount: 54000, category: 'Medical/Personal', sourceType: 'Rent' },
    { id: 'exp-16', name: 'Medical Claim Allocation', amount: 15000, category: 'Medical/Personal', sourceType: 'Rent' },
    { id: 'exp-17', name: 'Mgt fee allocation', amount: 15000, category: 'Allocations', sourceType: 'Rent' },
    { id: 'exp-18', name: 'Car Insurance allocation', amount: 5000, category: 'Allocations', sourceType: 'Rent' },
    { id: 'exp-19', name: 'Car Maintenance Allocation', amount: 10000, category: 'Allocations', sourceType: 'Rent' },
  ],
  oneTimePayments: [
    { id: 'otp-1', title: 'School Fees', totalAmount: 0, paidAmount: 0, dueDate: '' },
    { id: 'otp-2', title: 'Income Tax', totalAmount: 0, paidAmount: 0, dueDate: '' },
    { id: 'otp-3', title: 'Municipal Taxes', totalAmount: 0, paidAmount: 0, dueDate: '' },
    { id: 'otp-4', title: 'Google AI Studio', totalAmount: 0, paidAmount: 0, dueDate: '' },
    { id: 'otp-5', title: 'Management Fees', totalAmount: 0, paidAmount: 0, dueDate: '' },
    { id: 'otp-6', title: 'Continental Insurance', totalAmount: 0, paidAmount: 0, dueDate: '' },
    { id: 'otp-7', title: 'Car Service', totalAmount: 0, paidAmount: 0, dueDate: '' },
  ]
};
