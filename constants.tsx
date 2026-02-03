
import { BudgetData, GroceryCategory } from './types';

const INITIAL_GROCERY_CATEGORIES: GroceryCategory[] = [
  {
    id: 'g-cat-1',
    name: 'Staples & Pulses',
    subCategories: [
      { id: 'g-sub-1-1', name: 'Rice' },
      { id: 'g-sub-1-2', name: 'Samaposha' },
      { id: 'g-sub-1-3', name: 'Parippu (Lentils)' },
      { id: 'g-sub-1-4', name: 'Cowpea' },
      { id: 'g-sub-1-5', name: 'Mung Ata (Green Gram)' },
      { id: 'g-sub-1-6', name: 'Soya' }
    ]
  },
  {
    id: 'g-cat-2',
    name: 'Boiled Tubers',
    subCategories: [
      { id: 'g-sub-2-1', name: 'Bathala (Sweet Potato)' },
      { id: 'g-sub-2-2', name: 'Manioc (Cassava)' }
    ]
  },
  {
    id: 'g-cat-3',
    name: 'Flour-Based Items',
    subCategories: [
      { id: 'g-sub-3-1', name: 'Noodles' },
      { id: 'g-sub-3-2', name: 'Pasta' },
      { id: 'g-sub-3-3', name: 'Kottu' },
      { id: 'g-sub-3-4', name: 'Rotti' },
      { id: 'g-sub-3-5', name: 'Paratha' },
      { id: 'g-sub-3-6', name: 'Pittu' },
      { id: 'g-sub-3-7', name: 'Idli' },
      { id: 'g-sub-3-8', name: 'Dosai' }
    ]
  },
  {
    id: 'g-cat-4',
    name: 'Meat & Seafood',
    subCategories: [
      { id: 'g-sub-4-1', name: 'Chicken (for Curry)' },
      { id: 'g-sub-4-2', name: 'Fish (for Curry/Ambul Thiyal)' },
      { id: 'g-sub-4-3', name: 'Mackerel' },
      { id: 'g-sub-4-4', name: 'Sprats' },
      { id: 'g-sub-4-5', name: 'Small Fish (for frying)' },
      { id: 'g-sub-4-6', name: 'Karawala (Dried Fish)' },
      { id: 'g-sub-4-7', name: 'Kunisso (Dried Shrimp)' }
    ]
  },
  {
    id: 'g-cat-5',
    name: 'Dairy & Eggs',
    subCategories: [
      { id: 'g-sub-5-1', name: 'Eggs' },
      { id: 'g-sub-5-2', name: 'Yogurt' },
      { id: 'g-sub-5-3', name: 'Milk' },
      { id: 'g-sub-5-4', name: 'Cheese' },
      { id: 'g-sub-5-5', name: 'Butter' },
      { id: 'g-sub-5-6', name: 'Ghee' },
      { id: 'g-sub-5-7', name: 'Milk Powder' }
    ]
  },
  {
    id: 'g-cat-6',
    name: 'Vegetables',
    subCategories: [
      { id: 'g-sub-6-1', name: 'Potato (Ala)' },
      { id: 'g-sub-6-2', name: 'Pumpkin' },
      { id: 'g-sub-6-3', name: 'Beetroot' },
      { id: 'g-sub-6-4', name: 'Watakolu (Ridge Gourd)' },
      { id: 'g-sub-6-5', name: 'Hathu (Mushrooms)' },
      { id: 'g-sub-6-6', name: 'Amberella' },
      { id: 'g-sub-6-7', name: 'Polos (Baby Jackfruit)' },
      { id: 'g-sub-6-8', name: 'Kos (Jackfruit)' },
      { id: 'g-sub-6-9', name: 'Del (Breadfruit)' },
      { id: 'g-sub-6-10', name: 'Beans' },
      { id: 'g-sub-6-11', name: 'Bandakka (Okra)' },
      { id: 'g-sub-6-12', name: 'Karawila (Bitter Gourd)' },
      { id: 'g-sub-6-13', name: 'Gowa (Cabbage)' },
      { id: 'g-sub-6-14', name: 'Carrots' },
      { id: 'g-sub-6-15', name: 'Wambatu (Eggplant)' },
      { id: 'g-sub-6-16', name: 'Tomato' }
    ]
  },
  {
    id: 'g-cat-7',
    name: 'Greens',
    subCategories: [
      { id: 'g-sub-7-1', name: 'Gotukola' },
      { id: 'g-sub-7-2', name: 'Mukunuwenna' },
      { id: 'g-sub-7-3', name: 'Spinach' },
      { id: 'g-sub-7-4', name: 'Spring Onion' }
    ]
  },
  {
    id: 'g-cat-8',
    name: 'Spices & Seasonings',
    subCategories: [
      { id: 'g-sub-8-1', name: 'Ginger' },
      { id: 'g-sub-8-2', name: 'Onion' },
      { id: 'g-sub-8-3', name: 'Garlic' },
      { id: 'g-sub-8-4', name: 'Green Chilli' },
      { id: 'g-sub-8-5', name: 'Lime' },
      { id: 'g-sub-8-6', name: 'Salt' },
      { id: 'g-sub-8-7', name: 'Chili Powder' },
      { id: 'g-sub-8-8', name: 'Turmeric' },
      { id: 'g-sub-8-9', name: 'Curry Powder' }
    ]
  },
  {
    id: 'g-cat-9',
    name: 'Pantry Staples & Beverages',
    subCategories: [
      { id: 'g-sub-9-1', name: 'Coconuts' },
      { id: 'g-sub-9-2', name: 'Coconut Oil' },
      { id: 'g-sub-9-3', name: 'Sugar' },
      { id: 'g-sub-9-4', name: 'Tea' }
    ]
  },
  {
    id: 'g-cat-10',
    name: 'Fruits',
    subCategories: [
      { id: 'g-sub-10-1', name: 'Banana' },
      { id: 'g-sub-10-2', name: 'Mango' },
      { id: 'g-sub-10-3', name: 'Papaw' },
      { id: 'g-sub-10-4', name: 'Pine Apple' },
      { id: 'g-sub-10-5', name: 'Gauva' }
    ]
  },
  {
    id: 'g-cat-11',
    name: 'Cleaning & Laundry',
    subCategories: [
      { id: 'g-sub-11-1', name: 'Dish Wash Soap' },
      { id: 'g-sub-11-2', name: 'Laundry Detergent' },
      { id: 'g-sub-11-3', name: 'General all purpose cleaner' },
      { id: 'g-sub-11-4', name: 'Sponges & Scrubbers' },
      { id: 'g-sub-11-5', name: 'Trash Bags' },
      { id: 'g-sub-11-6', name: 'Tissues' }
    ]
  },
  {
    id: 'g-cat-12',
    name: 'Personal Care',
    subCategories: [
      { id: 'g-sub-12-1', name: 'Toothpaste' },
      { id: 'g-sub-12-2', name: 'Toothbrush' },
      { id: 'g-sub-12-3', name: 'Shampoo' },
      { id: 'g-sub-12-4', name: 'Conditioner' },
      { id: 'g-sub-12-5', name: 'Soap' },
      { id: 'g-sub-12-6', name: 'Deodrant' },
      { id: 'g-sub-12-7', name: 'Shavin Cream' },
      { id: 'g-sub-12-8', name: 'Menstrual Pads' }
    ]
  },
  {
    id: 'g-cat-13',
    name: 'Snacks & Biscuits',
    subCategories: [
      { id: 'g-sub-13-1', name: 'Biscuits' },
      { id: 'g-sub-13-2', name: 'Cookies' },
      { id: 'g-sub-13-3', name: 'Crackers' },
      { id: 'g-sub-13-4', name: 'Chips & Crisps' },
      { id: 'g-sub-13-5', name: 'Chocolates' },
      { id: 'g-sub-13-6', name: 'Traditional Sweets' },
      { id: 'g-sub-13-7', name: 'Mixed Nuts' }
    ]
  }
];

export const INITIAL_DATA: BudgetData = {
  income: [
    { id: 'inc-1', name: 'Salary', amount: 385000 },
    { id: 'inc-2', name: 'Rent Income', amount: 110000 }
  ],
  expenses: [
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
  ],
  savings: {
    openingBalance: 0,
    additions: [
      { id: 'sav-add-1', amount: 50000, date: '2026-01-26' }
    ],
    withdrawals: []
  },
  cash: {
    openingBalance: 0,
    income: [],
    expenses: []
  },
  groceryCategories: INITIAL_GROCERY_CATEGORIES,
  groceryBills: [],
  loans: [],
  bankStatements: []
};
