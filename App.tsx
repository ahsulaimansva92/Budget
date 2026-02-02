import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  BudgetData, IncomeSource, ExpenseItem, OneTimePayment, SavingsEntry, SavingsWithdrawal, 
  CashEntry, GroceryCategory, GrocerySubCategory, GroceryBill, GroceryBillItem, CategoryOverride,
  LoanAccount, LoanTransaction, LoanTransactionType
} from './types';
import { INITIAL_DATA } from './constants';
import Layout from './components/Layout';
import SummaryCard from './components/SummaryCard';
import { analyzeBudget, processGroceryBill, processLoanScreenshot } from './services/geminiService';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, PieChart, Pie 
} from 'recharts';

/**
 * A custom searchable dropdown component for selecting grocery categories and subcategories.
 */
const SearchableCategoryDropdown: React.FC<{
  currentValue: string;
  categories: GroceryCategory[];
  onSelect: (catId: string, subCatId: string) => void;
  placeholder?: string;
}> = ({ currentValue, categories, onSelect, placeholder = "Select Category" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredCategories = useMemo(() => {
    const query = search.toLowerCase();
    if (!query) return categories;
    
    return categories.map(cat => ({
      ...cat,
      subCategories: cat.subCategories.filter(sub => 
        sub.name.toLowerCase().includes(query) || 
        cat.name.toLowerCase().includes(query)
      )
    })).filter(cat => cat.subCategories.length > 0);
  }, [categories, search]);

  const currentLabel = useMemo(() => {
    const [_, subId] = currentValue.split('|');
    if (subId === 'unassigned') return placeholder;
    
    for (const cat of categories) {
      const sub = cat.subCategories.find(s => s.id === subId);
      if (sub) return `${cat.name} > ${sub.name}`;
    }
    return placeholder;
  }, [currentValue, categories, placeholder]);

  return (
    <div className="relative w-full md:w-auto min-w-[220px]" ref={containerRef}>
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setSearch('');
        }}
        className={`w-full text-left px-3 py-2 border rounded-lg text-[11px] font-black transition-all flex justify-between items-center shadow-sm ${
          isOpen ? 'bg-white border-indigo-500 ring-2 ring-indigo-50' : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
        }`}
      >
        <span className="truncate">{currentLabel}</span>
        <span className={`transition-transform duration-200 text-slate-400 ${isOpen ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {isOpen && (
        <div className="absolute z-[100] mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 origin-top">
          <div className="p-2 border-b bg-slate-50">
            <input
              autoFocus
              type="text"
              placeholder="Search items (e.g. 'Rice', 'Milk')..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold border border-slate-200 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none placeholder:text-slate-400"
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-1 custom-scrollbar">
            {filteredCategories.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 font-bold italic">No categories found matching "{search}"</div>
            ) : (
              filteredCategories.map(cat => (
                <div key={cat.id} className="mb-2 last:mb-0">
                  <div className="px-3 py-1.5 text-[9px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-50/30 rounded-t-lg mx-1">{cat.name}</div>
                  <div className="space-y-0.5 px-1">
                    {cat.subCategories.map(sub => {
                      const isSelected = currentValue === `${cat.id}|${sub.id}`;
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => {
                            onSelect(cat.id, sub.id);
                            setIsOpen(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
                            isSelected 
                              ? 'bg-indigo-600 text-white shadow-sm' 
                              : 'text-slate-600 hover:bg-slate-100 hover:text-indigo-700'
                          }`}
                        >
                          {sub.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [grocerySubTab, setGrocerySubTab] = useState<'analysis' | 'bills' | 'categories'>('analysis');
  const [data, setData] = useState<BudgetData>(() => {
    const saved = localStorage.getItem('home_budget_data');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (!parsed.savings) parsed.savings = INITIAL_DATA.savings;
      if (!parsed.cash) parsed.cash = INITIAL_DATA.cash;
      if (!parsed.groceryCategories) parsed.groceryCategories = INITIAL_DATA.groceryCategories;
      if (!parsed.groceryBills) parsed.groceryBills = INITIAL_DATA.groceryBills;
      if (!parsed.loans) parsed.loans = INITIAL_DATA.loans;
      if (!parsed.mappingOverrides) parsed.mappingOverrides = {};
      return parsed;
    }
    return { ...INITIAL_DATA, mappingOverrides: {} };
  });

  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [showAuditBillId, setShowAuditBillId] = useState<string | null>(null);
  const [showBreakupSubId, setShowBreakupSubId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loanFileInputRef = useRef<HTMLInputElement>(null);

  // Modal states for Loans
  const [selectedLoanAccountId, setSelectedLoanAccountId] = useState<string | null>(null);
  const [isLoanOcrLoading, setIsLoanOcrLoading] = useState(false);

  /**
   * Sync function to ensure Cash tab matches items marked as "Cash Handled"
   */
  const syncCashData = (currentData: BudgetData): BudgetData => {
    const today = new Date().toISOString().split('T')[0];
    const nonSyncedCashIncome = currentData.cash.income.filter(item => !item.id.startsWith('cash-sync-'));
    const nonSyncedCashExpenses = currentData.cash.expenses.filter(item => !item.id.startsWith('cash-sync-'));

    const syncedIncome: CashEntry[] = currentData.income
      .filter(i => i.isCashHandled)
      .map(i => ({
        id: `cash-sync-inc-${i.id}`,
        date: today,
        description: `Income: ${i.name}`,
        amount: Number(i.amount),
        isSynced: true
      }));

    const syncedExpenses: CashEntry[] = currentData.expenses
      .filter(e => e.isCashHandled)
      .map(e => ({
        id: `cash-sync-exp-${e.id}`,
        date: today,
        description: `Expense: ${e.name}`,
        amount: Number(e.amount),
        isSynced: true
      }));

    return {
      ...currentData,
      cash: {
        ...currentData.cash,
        income: [...nonSyncedCashIncome, ...syncedIncome],
        expenses: [...nonSyncedCashExpenses, ...syncedExpenses]
      }
    };
  };

  useEffect(() => {
    localStorage.setItem('home_budget_data', JSON.stringify(data));
  }, [data]);

  const totals = useMemo(() => {
    const totalIncome = data.income.reduce((sum, item) => sum + Number(item.amount), 0);
    const recurringExpenses = data.expenses.reduce((sum, item) => sum + Number(item.amount), 0);
    const totalGrocerySpend = data.groceryBills.reduce((sum, bill) => sum + Number(bill.totalAmount), 0);
    const totalExpenses = recurringExpenses + totalGrocerySpend;
    
    const salaryIncome = Number(data.income.find(i => i.name === 'Salary')?.amount || 0);
    const rentIncome = Number(data.income.find(i => i.name === 'Rent Income')?.amount || 0);
    const salaryExpenses = data.expenses.filter(e => e.sourceType === 'Salary').reduce((sum, e) => sum + Number(e.amount), 0);
    const rentExpenses = data.expenses.filter(e => e.sourceType === 'Rent').reduce((sum, e) => sum + Number(e.amount), 0);
    const totalOneTime = data.oneTimePayments.reduce((sum, item) => sum + Number(item.totalAmount), 0);
    const totalSavingsAdditions = data.savings.additions.reduce((sum, item) => sum + Number(item.amount), 0);
    const totalSavingsWithdrawals = data.savings.withdrawals.reduce((sum, item) => sum + Number(item.amount), 0);
    const savingsBalance = Number(data.savings.openingBalance) + totalSavingsAdditions - totalSavingsWithdrawals;
    const totalCashIncome = data.cash.income.reduce((sum, item) => sum + Number(item.amount), 0);
    const totalCashExpenses = data.cash.expenses.reduce((sum, item) => sum + Number(item.amount), 0);
    const closingCashBalance = Number(data.cash.openingBalance) + totalCashIncome - totalCashExpenses;

    const totalLoanDebt = data.loans.reduce((acc, account) => {
      const balance = Number(account.openingBalance || 0) + account.transactions.reduce((s, t) => {
        return t.type === 'taken' ? s + Number(t.amount) : s - Number(t.amount);
      }, 0);
      return acc + balance;
    }, 0);

    return {
      totalIncome,
      totalExpenses,
      recurringExpenses,
      balance: totalIncome - totalExpenses,
      savingsBalance,
      cashBalance: closingCashBalance,
      totalGrocerySpend,
      salaryIncome,
      rentIncome,
      salaryExpenses,
      rentExpenses,
      salaryRemaining: salaryIncome - salaryExpenses,
      rentRemaining: rentIncome - rentExpenses,
      totalOneTime,
      totalLoanDebt
    };
  }, [data]);

  const groceryStats = useMemo(() => {
    const stats: Record<string, { totalAmount: number; totalQuantity: number; avgUnitCost: number; itemCount: number }> = {};
    data.groceryBills.forEach(bill => {
      bill.items.forEach(item => {
        const subId = item.subCategoryId || 'unassigned';
        if (!stats[subId]) {
          stats[subId] = { totalAmount: 0, totalQuantity: 0, avgUnitCost: 0, itemCount: 0 };
        }
        stats[subId].totalAmount += Number(item.totalCost);
        stats[subId].totalQuantity += Number(item.quantity);
        stats[subId].itemCount += 1;
        stats[subId].avgUnitCost = stats[subId].totalAmount / (stats[subId].totalQuantity || 1);
      });
    });
    return stats;
  }, [data.groceryBills]);

  const categoryTotals = useMemo(() => {
    const catTotals: Record<string, number> = {};
    data.groceryBills.forEach(bill => {
      bill.items.forEach(item => {
        const catId = item.categoryId || 'unassigned';
        catTotals[catId] = (catTotals[catId] || 0) + Number(item.totalCost);
      });
    });
    return catTotals;
  }, [data.groceryBills]);

  const totalCategorizedSpend = useMemo(() => {
    const validCatTotals = { ...categoryTotals };
    delete validCatTotals['unassigned'];
    return Object.values(validCatTotals).reduce((sum: number, val: number) => sum + Number(val), 0);
  }, [categoryTotals]);

  const unassignedItems = useMemo(() => {
    return data.groceryBills.flatMap(bill => 
      bill.items
        .filter(item => !item.subCategoryId || item.subCategoryId === 'unassigned' || item.subCategoryId === 'misc')
        .map(item => ({ ...item, billId: bill.id, billDate: bill.date, billShop: bill.shopName }))
    );
  }, [data.groceryBills]);

  const breakupItems = useMemo(() => {
    if (!showBreakupSubId) return [];
    return data.groceryBills.flatMap(bill => 
      bill.items
        .filter(item => item.subCategoryId === showBreakupSubId)
        .map(item => ({ ...item, billId: bill.id, billDate: bill.date, billShop: bill.shopName }))
    );
  }, [showBreakupSubId, data.groceryBills]);

  const selectedSubCategoryName = useMemo(() => {
    if (!showBreakupSubId) return '';
    for (const cat of data.groceryCategories) {
      const sub = cat.subCategories.find(s => s.id === showBreakupSubId);
      if (sub) return sub.name;
    }
    return '';
  }, [showBreakupSubId, data.groceryCategories]);

  const handleUpdateIncome = (id: string, field: keyof IncomeSource, value: any) => {
    setData(prev => {
      const updatedIncome = prev.income.map(i => i.id === id ? { ...i, [field]: value } : i);
      return syncCashData({ ...prev, income: updatedIncome });
    });
  };

  const handleUpdateExpense = (id: string, field: keyof ExpenseItem, value: any) => {
    setData(prev => {
      const updatedExpenses = prev.expenses.map(e => e.id === id ? { ...e, [field]: (field === 'amount' ? Number(value) : value) } : e);
      return syncCashData({ ...prev, expenses: updatedExpenses });
    });
  };

  const handleAddExpense = (sourceType: 'Salary' | 'Rent') => {
    const newExp: ExpenseItem = {
      id: `exp-${Date.now()}`,
      name: 'New Expense',
      amount: 0,
      category: 'General',
      sourceType,
      isCashHandled: false
    };
    setData(prev => ({ ...prev, expenses: [...prev.expenses, newExp] }));
  };

  const handleUpdateOneTime = (id: string, field: keyof OneTimePayment, value: any) => {
    setData(prev => ({
      ...prev,
      oneTimePayments: prev.oneTimePayments.map(p => p.id === id ? { ...p, [field]: (['totalAmount', 'paidAmount'].includes(field) ? Number(value) : value) } : p)
    }));
  };

  const handleCategorizeItem = (billId: string, itemId: string, catId: string, subCatId: string) => {
    const cat = data.groceryCategories.find(c => c.id === catId);
    const sub = cat?.subCategories.find(s => s.id === subCatId);
    const bill = data.groceryBills.find(b => b.id === billId);
    const item = bill?.items.find(i => i.id === itemId);
    const rawDesc = item?.rawDescription || item?.description;

    setData(prev => {
      const newOverrides = { ...prev.mappingOverrides };
      if (rawDesc && cat && sub) {
        newOverrides[rawDesc] = { categoryName: cat.name, subCategoryName: sub.name };
      }
      return {
        ...prev,
        mappingOverrides: newOverrides,
        groceryBills: prev.groceryBills.map(bill => {
          if (bill.id !== billId) return bill;
          return {
            ...bill,
            items: bill.items.map(item => {
              if (item.id !== itemId) return item;
              return { ...item, categoryId: catId, subCategoryId: subCatId };
            })
          };
        })
      };
    });
  };

  const handleUpdateCashOpening = (amount: number) => {
    setData(prev => ({ ...prev, cash: { ...prev.cash, openingBalance: Number(amount) } }));
  };

  const handleAddCashItem = (type: 'income' | 'expenses') => {
    const newItem: CashEntry = {
      id: `cash-${type}-${Date.now()}`,
      amount: 0,
      date: new Date().toISOString().split('T')[0],
      description: 'New Item'
    };
    setData(prev => ({
      ...prev,
      cash: { ...prev.cash, [type]: [...prev.cash[type], newItem] }
    }));
  };

  const handleUpdateCashItem = (type: 'income' | 'expenses', id: string, field: keyof CashEntry, value: any) => {
    setData(prev => ({
      ...prev,
      cash: {
        ...prev.cash,
        [type]: prev.cash[type].map(item => item.id === id ? { ...item, [field]: (field === 'amount' ? Number(value) : value) } : item)
      }
    }));
  };

  const handleRemoveCashItem = (type: 'income' | 'expenses', id: string) => {
    setData(prev => {
      if (id.startsWith('cash-sync-')) {
        const sourceId = id.split('-inc-')[1] || id.split('-exp-')[1];
        const newIncome = prev.income.map(i => i.id === sourceId ? { ...i, isCashHandled: false } : i);
        const newExpenses = prev.expenses.map(e => e.id === sourceId ? { ...e, isCashHandled: false } : e);
        return syncCashData({ ...prev, income: newIncome, expenses: newExpenses });
      }
      return {
        ...prev,
        cash: { ...prev.cash, [type]: prev.cash[type].filter(item => item.id !== id) }
      };
    });
  };

  const handleUpdateSavingsOpening = (amount: number) => {
    setData(prev => ({ ...prev, savings: { ...prev.savings, openingBalance: Number(amount) } }));
  };

  const handleAddSavingsAddition = () => {
    const newEntry: SavingsEntry = { id: `sav-add-${Date.now()}`, amount: 0, date: new Date().toISOString().split('T')[0] };
    setData(prev => ({ ...prev, savings: { ...prev.savings, additions: [...prev.savings.additions, newEntry] } }));
  };

  const handleUpdateSavingsAddition = (id: string, field: keyof SavingsEntry, value: any) => {
    setData(prev => ({
      ...prev,
      savings: { ...prev.savings, additions: prev.savings.additions.map(a => a.id === id ? { ...a, [field]: (field === 'amount' ? Number(value) : value) } : a) }
    }));
  };

  const handleRemoveSavingsAddition = (id: string) => {
    setData(prev => ({ ...prev, savings: { ...prev.savings, additions: prev.savings.additions.filter(a => a.id !== id) } }));
  };

  const handleAddSavingsWithdrawal = () => {
    const newWithdrawal: SavingsWithdrawal = { id: `sav-wd-${Date.now()}`, amount: 0, date: new Date().toISOString().split('T')[0], reason: 'General' };
    setData(prev => ({ ...prev, savings: { ...prev.savings, withdrawals: [...prev.savings.withdrawals, newWithdrawal] } }));
  };

  const handleUpdateSavingsWithdrawal = (id: string, field: keyof SavingsWithdrawal, value: any) => {
    setData(prev => ({
      ...prev,
      savings: { ...prev.savings, withdrawals: prev.savings.withdrawals.map(w => w.id === id ? { ...w, [field]: (field === 'amount' ? Number(value) : value) } : w) }
    }));
  };

  const handleRemoveSavingsWithdrawal = (id: string) => {
    setData(prev => ({ ...prev, savings: { ...prev.savings, withdrawals: prev.savings.withdrawals.filter(w => w.id !== id) } }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsOcrLoading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      try {
        const result = await processGroceryBill(base64, data.groceryCategories, data.mappingOverrides);
        const newBill: GroceryBill = {
          id: `bill-${Date.now()}`,
          date: result.date || new Date().toISOString().split('T')[0],
          shopName: result.shopName || 'Unknown Shop',
          imageUrl: base64,
          totalAmount: result.items.reduce((s: number, i: any) => s + Number(i.totalCost), 0),
          items: result.items.map((i: any) => {
            const cat = data.groceryCategories.find(c => c.name === i.categoryName);
            const sub = cat?.subCategories.find(s => s.name === i.subCategoryName);
            return {
              id: `item-${Math.random()}`,
              description: i.description,
              rawDescription: i.description,
              quantity: Number(i.quantity),
              unit: i.unit,
              unitCost: Number(i.unitCost),
              totalCost: Number(i.totalCost),
              categoryId: cat?.id || 'unassigned',
              subCategoryId: sub?.id || 'unassigned'
            };
          })
        };
        setData(prev => ({ ...prev, groceryBills: [newBill, ...prev.groceryBills] }));
        setGrocerySubTab('bills');
      } catch (err) {
        alert("Failed to process bill image.");
      } finally {
        setIsOcrLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleLoanFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoanOcrLoading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      try {
        const result = await processLoanScreenshot(base64);
        const extractedTransactions = result.transactions || [];
        
        setData(prev => {
          let updatedLoans = [...prev.loans];
          extractedTransactions.forEach((tx: any) => {
            const accName = tx.suggestedAccount || 'General Loan Account';
            let acc = updatedLoans.find(l => l.name.toLowerCase() === accName.toLowerCase());
            
            if (!acc) {
              acc = { id: `loan-${Date.now()}-${Math.random()}`, name: accName, openingBalance: 0, transactions: [] };
              updatedLoans.push(acc);
            }

            const newTx: LoanTransaction = {
              id: `tx-${Date.now()}-${Math.random()}`,
              date: tx.date || new Date().toISOString().split('T')[0],
              description: tx.description || 'Extracted Payment',
              amount: Number(tx.amount) || 0,
              type: 'taken',
              imageUrl: base64
            };
            
            acc.transactions.push(newTx);
          });
          return { ...prev, loans: updatedLoans };
        });
      } catch (err) {
        alert("Failed to process loan evidence.");
      } finally {
        setIsLoanOcrLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUpdateLoanTransaction = (accId: string, txId: string, field: keyof LoanTransaction, value: any) => {
    setData(prev => ({
      ...prev,
      loans: prev.loans.map(acc => {
        if (acc.id !== accId) return acc;
        return {
          ...acc,
          transactions: acc.transactions.map(tx => tx.id === txId ? { ...tx, [field]: value } : tx)
        };
      })
    }));
  };

  const handleUpdateLoanOpeningBalance = (accId: string, amount: number) => {
    setData(prev => ({
      ...prev,
      loans: prev.loans.map(acc => acc.id === accId ? { ...acc, openingBalance: Number(amount) } : acc)
    }));
  };

  const handleDeleteLoanTransaction = (accId: string, txId: string) => {
    if (confirm("Delete this transaction?")) {
      setData(prev => ({
        ...prev,
        loans: prev.loans.map(acc => {
          if (acc.id !== accId) return acc;
          return { ...acc, transactions: acc.transactions.filter(tx => tx.id !== txId) };
        })
      }));
    }
  };

  const handleAddNewLoanAccount = () => {
    const name = prompt("Enter a name/reason for this loan account:");
    if (name) {
      setData(prev => ({
        ...prev,
        loans: [...prev.loans, { id: `loan-${Date.now()}`, name, openingBalance: 0, transactions: [] }]
      }));
    }
  };

  // Bill Management Handlers
  const handleUpdateBillDetails = (billId: string, field: keyof GroceryBill, value: any) => {
    setData(prev => ({
      ...prev,
      groceryBills: prev.groceryBills.map(b => b.id === billId ? { ...b, [field]: value } : b)
    }));
  };

  const handleUpdateBillItem = (billId: string, itemId: string, field: keyof GroceryBillItem, value: any) => {
    setData(prev => ({
      ...prev,
      groceryBills: prev.groceryBills.map(b => {
        if (b.id !== billId) return b;
        const newItems = b.items.map(i => i.id === itemId ? { ...i, [field]: value } : i);
        // Recalculate total from items
        const newTotal = newItems.reduce((sum, i) => sum + Number(i.totalCost), 0);
        return { ...b, items: newItems, totalAmount: newTotal };
      })
    }));
  };

  const handleAddBillItem = (billId: string) => {
    setData(prev => ({
      ...prev,
      groceryBills: prev.groceryBills.map(b => {
        if (b.id !== billId) return b;
        const newItem: GroceryBillItem = {
          id: `item-${Date.now()}-${Math.random()}`,
          description: 'New Item',
          rawDescription: 'New Item',
          quantity: 1,
          unit: 'unit',
          unitCost: 0,
          totalCost: 0,
          categoryId: 'unassigned',
          subCategoryId: 'unassigned'
        };
        const newItems = [...b.items, newItem];
        return { ...b, items: newItems };
      })
    }));
  };

  const handleDeleteBillItem = (billId: string, itemId: string) => {
    setData(prev => ({
      ...prev,
      groceryBills: prev.groceryBills.map(b => {
        if (b.id !== billId) return b;
        const newItems = b.items.filter(i => i.id !== itemId);
        const newTotal = newItems.reduce((sum, i) => sum + Number(i.totalCost), 0);
        return { ...b, items: newItems, totalAmount: newTotal };
      })
    }));
  };

  const handleDeleteBill = (billId: string) => {
    if (confirm("Are you sure you want to delete this entire bill and its items?")) {
      setData(prev => ({
        ...prev,
        groceryBills: prev.groceryBills.filter(b => b.id !== billId)
      }));
      setShowAuditBillId(null);
    }
  };

  const moveCategory = (index: number, direction: 'up' | 'down') => {
    const newCats = [...data.groceryCategories];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newCats.length) return;
    [newCats[index], newCats[targetIndex]] = [newCats[targetIndex], newCats[index]];
    setData(prev => ({ ...prev, groceryCategories: newCats }));
  };

  const moveSubCategory = (catIndex: number, subIndex: number, direction: 'up' | 'down') => {
    const newCats = [...data.groceryCategories];
    const targetSubIndex = direction === 'up' ? subIndex - 1 : subIndex + 1;
    if (targetSubIndex < 0 || targetSubIndex >= newCats[catIndex].subCategories.length) return;
    [newCats[catIndex].subCategories[subIndex], newCats[catIndex].subCategories[targetSubIndex]] = 
      [newCats[catIndex].subCategories[targetSubIndex], newCats[catIndex].subCategories[subIndex]];
    setData(prev => ({ ...prev, groceryCategories: newCats }));
  };

  const runAIAnalysis = async () => {
    setIsAnalyzing(true);
    const result = await analyzeBudget(data);
    setAiInsight(result);
    setIsAnalyzing(false);
  };

  const chartData = [
    { name: 'Salary', Income: totals.salaryIncome, Expenses: totals.salaryExpenses },
    { name: 'Rent', Income: totals.rentIncome, Expenses: totals.rentExpenses },
  ];

  const pieData = [
    { name: 'Expenses', value: totals.totalExpenses, fill: '#4f46e5' },
    { name: 'Surplus', value: Math.max(0, totals.balance), fill: '#16a34a' },
  ];

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {activeTab === 'dashboard' && (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Financial Dashboard</h2>
            <button 
              onClick={runAIAnalysis}
              disabled={isAnalyzing}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-100 transition-all flex items-center gap-2 transform hover:scale-105 active:scale-95"
            >
              {isAnalyzing ? '✨ Analyzing...' : '✨ Get AI Insights'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <SummaryCard title="Total Income" amount={totals.totalIncome} color="indigo" />
            <SummaryCard title="Planned Expenses" amount={totals.recurringExpenses} color="orange" />
            <SummaryCard title="Monthly Surplus" amount={totals.balance} color={totals.balance >= 0 ? 'green' : 'red'} />
            <SummaryCard title="Total Savings" amount={totals.savingsBalance} color="indigo" />
            <SummaryCard title="Cash Balance" amount={totals.cashBalance} color="blue" />
            <SummaryCard title="Loan Liabilities" amount={totals.totalLoanDebt} color="red" />
          </div>

          {aiInsight && (
            <div className="bg-white p-6 rounded-3xl border-2 border-indigo-100 shadow-xl relative animate-in zoom-in-95">
              <button onClick={() => setAiInsight(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-900 text-xl font-bold p-2">✕</button>
              <h3 className="text-lg font-black text-indigo-900 mb-4 flex items-center gap-2">✨ AI Financial Assessment</h3>
              <div className="prose prose-sm prose-slate max-w-none text-slate-700 whitespace-pre-line font-medium leading-relaxed">{aiInsight}</div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <div className="bg-white p-6 rounded-3xl shadow-lg border border-slate-200">
              <h3 className="text-lg font-extrabold text-slate-900 mb-6 border-b border-slate-100 pb-3">Income vs Expenses Analysis</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 12, fontWeight: 600}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 12, fontWeight: 600}} />
                    <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                    <Bar dataKey="Income" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={32} />
                    <Bar dataKey="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-lg border border-slate-200">
              <h3 className="text-lg font-extrabold text-slate-900 mb-6 border-b border-slate-100 pb-3">Net Utilization Breakdown</h3>
              <div className="h-64 flex justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={8}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                    <Legend verticalAlign="bottom" iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'income' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Monthly Income</h2>
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 w-16 text-center">In Cash?</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">Revenue Source</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">Monthly Amount (LKR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.income.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-center">
                      <input 
                        type="checkbox" 
                        checked={item.isCashHandled || false}
                        onChange={(e) => handleUpdateIncome(item.id, 'isCashHandled', e.target.checked)}
                        className="w-5 h-5 accent-indigo-600 cursor-pointer"
                      />
                    </td>
                    <td className="px-6 py-4 font-semibold text-base text-slate-800">{item.name}</td>
                    <td className="px-6 py-4">
                      <div className="relative max-w-xs">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">Rs.</span>
                        <input
                          type="number"
                          value={item.amount}
                          onChange={(e) => handleUpdateIncome(item.id, 'amount', Number(e.target.value))}
                          className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-base text-indigo-700 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-6">
            <SummaryCard title="Aggregate Monthly Revenue" amount={totals.totalIncome} color="indigo" />
          </div>
        </div>
      )}

      {activeTab === 'expenses' && (
        <div className="space-y-10 animate-in fade-in duration-300">
          <div className="flex justify-between items-center">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Recurring Expenses</h2>
          </div>
          <div className="grid grid-cols-1 gap-12">
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b-2 pb-3 border-indigo-500">
                <div>
                  <h3 className="text-xl font-black text-indigo-800">1. Expenses via Salary</h3>
                  <p className="text-sm text-slate-500 font-medium">Auto-deductions and primary monthly bills</p>
                </div>
                <div className="text-right mt-3 md:mt-0 bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100 flex flex-col gap-1 shadow-sm">
                  <div>
                    <span className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider block">Total Salary</span>
                    <span className="text-sm font-bold text-slate-700">Rs. {totals.salaryIncome.toLocaleString()}</span>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-indigo-600">
                    <tr>
                      <th className="px-6 py-3 text-[10px] font-black text-white uppercase tracking-widest w-16 text-center">Cash?</th>
                      <th className="px-6 py-3 text-[10px] font-black text-white uppercase tracking-widest w-1/4">Category</th>
                      <th className="px-6 py-3 text-[10px] font-black text-white uppercase tracking-widest">Description</th>
                      <th className="px-6 py-3 text-[10px] font-black text-white uppercase tracking-widest w-1/4">Amount (Rs.)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.expenses.filter(e => e.sourceType === 'Salary').map(item => (
                      <tr key={item.id} className="hover:bg-indigo-50/30 transition-colors">
                        <td className="px-6 py-2 text-center">
                          <input 
                            type="checkbox" 
                            checked={item.isCashHandled || false}
                            onChange={(e) => handleUpdateExpense(item.id, 'isCashHandled', e.target.checked)}
                            className="w-4 h-4 accent-indigo-600 cursor-pointer"
                          />
                        </td>
                        <td className="px-6 py-2">
                          <input
                            value={item.category}
                            onChange={(e) => handleUpdateExpense(item.id, 'category', e.target.value)}
                            className="bg-transparent border-none focus:ring-0 w-full text-slate-500 text-[11px] font-bold italic tracking-tight"
                          />
                        </td>
                        <td className="px-6 py-2">
                          <input
                            value={item.name}
                            onChange={(e) => handleUpdateExpense(item.id, 'name', e.target.value)}
                            className="w-full border-none focus:ring-0 text-slate-800 font-semibold text-sm"
                          />
                        </td>
                        <td className="px-6 py-2">
                          <input
                            type="number"
                            value={item.amount}
                            onChange={(e) => handleUpdateExpense(item.id, 'amount', Number(e.target.value))}
                            className="w-full border-none focus:ring-0 text-indigo-700 font-bold text-sm"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button onClick={() => handleAddExpense('Salary')} className="w-full py-3.5 text-xs font-black text-indigo-600 bg-indigo-50/50 hover:bg-indigo-100 transition-all border-t border-indigo-100">+ ADD SALARY EXPENSE</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'groceries' && (
        <div className="space-y-10 animate-in fade-in duration-300 pb-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Grocery Tracker</h2>
            <div className="flex gap-3">
              <input 
                type="file" 
                accept="image/*" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                className="hidden" 
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isOcrLoading}
                className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-emerald-100 transition-all hover:scale-105 active:scale-95"
              >
                {isOcrLoading ? (
                  <><span className="animate-spin text-xl">🌀</span> Scanning...</>
                ) : (
                  <><span className="text-xl">📷</span> Capture Bill</>
                )}
              </button>
            </div>
          </div>

          <div className="flex gap-1 bg-slate-100 p-1.5 rounded-2xl w-full max-w-2xl">
            {[
              { id: 'analysis', label: 'Spend Analysis', icon: '📊' },
              { id: 'bills', label: 'Bills Archive', icon: '🧾' },
              { id: 'categories', label: 'Manage Categories', icon: '⚙️' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setGrocerySubTab(tab.id as any)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                  grocerySubTab === tab.id 
                    ? 'bg-white text-indigo-700 shadow-md' 
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {grocerySubTab === 'analysis' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SummaryCard title="Total Bills Value" amount={totals.totalGrocerySpend} color="blue" />
                <SummaryCard 
                  title="Total Categorized" 
                  amount={totalCategorizedSpend} 
                  color={totals.totalGrocerySpend === totalCategorizedSpend ? "indigo" : "red"} 
                  subtitle={totals.totalGrocerySpend === totalCategorizedSpend ? "Verification Successful ✅" : `Mismatch: Rs. ${(totals.totalGrocerySpend - totalCategorizedSpend).toLocaleString()} ❌`} 
                />
              </div>

              {unassignedItems.length > 0 && (
                <div className="bg-amber-50 border-2 border-amber-200 p-6 rounded-[2rem] shadow-sm animate-in zoom-in-95">
                  <div className="flex items-center gap-4 mb-6 border-b border-amber-200 pb-4">
                    <div className="text-3xl">⚠️</div>
                    <div>
                      <h3 className="text-xl font-black text-slate-900">Pending Categorization ({unassignedItems.length})</h3>
                      <p className="text-sm font-semibold text-amber-700">Quickly search and assign categories to pending items.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {unassignedItems.map(item => (
                      <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-amber-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex-1">
                          <div className="font-bold text-slate-800">{item.description}</div>
                          <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{item.billShop} | {item.billDate}</div>
                        </div>
                        <div className="flex items-center gap-4 w-full md:w-auto">
                          <div className="font-black text-indigo-700 whitespace-nowrap">Rs. {item.totalCost.toLocaleString()}</div>
                          <SearchableCategoryDropdown 
                            currentValue={`${item.categoryId}|${item.subCategoryId}`}
                            categories={data.groceryCategories}
                            onSelect={(catId, subCatId) => handleCategorizeItem(item.billId!, item.id, catId, subCatId)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-100">
                <div className="flex justify-between items-center mb-6 border-b pb-3">
                    <h3 className="text-lg font-black text-slate-900">Spend by Category</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Click a sub-category to view items</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {data.groceryCategories.map(cat => (
                    <div key={cat.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                        <div className="flex justify-between items-start mb-4">
                          <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{cat.name}</span>
                          <span className="text-lg font-black text-slate-900">Rs. {Number(categoryTotals[cat.id] || 0).toLocaleString()}</span>
                        </div>
                        <div className="space-y-2">
                          {cat.subCategories.map(sub => {
                            const stats = groceryStats[sub.id];
                            if (!stats) return null;
                            return (
                              <div 
                                key={sub.id} 
                                onClick={() => setShowBreakupSubId(sub.id)}
                                className="text-xs flex flex-col gap-1 border-t pt-2 mt-1 cursor-pointer hover:bg-white hover:rounded-lg p-1 transition-all group"
                              >
                                <div className="flex justify-between font-bold text-slate-700 group-hover:text-indigo-600">
                                  <span>{sub.name}</span>
                                  <span>Rs. {Number(stats.totalAmount).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-[10px] text-slate-400 italic">
                                  <span>Qty: {Number(stats.totalQuantity).toFixed(1)}</span>
                                  <span>Avg: Rs. {Number(stats.avgUnitCost).toFixed(2)}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {grocerySubTab === 'bills' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {data.groceryBills.length === 0 ? (
                  <div className="col-span-full py-20 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200">
                    <div className="text-5xl mb-4 opacity-30">📂</div>
                    <p className="text-slate-400 font-black uppercase tracking-widest">No bills archived yet</p>
                  </div>
                ) : (
                  data.groceryBills.map(bill => (
                    <div key={bill.id} className="bg-white rounded-3xl shadow-lg border border-slate-100 overflow-hidden group hover:shadow-xl transition-shadow">
                      <div className="relative h-40 bg-slate-100">
                          {bill.imageUrl ? (
                            <img src={bill.imageUrl} className="w-full h-full object-cover opacity-60 grayscale group-hover:grayscale-0 transition-all duration-500" />
                          ) : (
                            <div className="flex items-center justify-center h-full text-slate-300 font-bold">No Image</div>
                          )}
                          <div className="absolute inset-0 p-4 flex flex-col justify-end bg-gradient-to-t from-black/60 to-transparent">
                            <h4 className="text-white font-black text-lg">{bill.shopName}</h4>
                            <p className="text-white/80 text-xs font-bold uppercase tracking-widest">{bill.date}</p>
                          </div>
                      </div>
                      <div className="p-5 flex justify-between items-center bg-white">
                          <div>
                            <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest mb-1">Total Bill</p>
                            <p className="text-xl font-black text-indigo-700">Rs. {Number(bill.totalAmount).toLocaleString()}</p>
                          </div>
                          <button 
                            onClick={() => setShowAuditBillId(bill.id)}
                            className="bg-slate-50 hover:bg-slate-100 text-slate-600 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border border-slate-200 transition-colors"
                          >
                            Edit / Audit
                          </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {grocerySubTab === 'categories' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
                <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                    <div className="flex flex-col">
                      <h3 className="text-xl font-bold tracking-tight">Category Configuration</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Refine your tracking hierarchy</p>
                    </div>
                    <button 
                      onClick={() => {
                        const newCat: GroceryCategory = { id: `g-cat-${Date.now()}`, name: 'New Category', subCategories: [] };
                        setData(prev => ({ ...prev, groceryCategories: [...prev.groceryCategories, newCat] }));
                      }}
                      className="bg-indigo-600 hover:bg-indigo-700 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-black/20"
                    >
                      + Add New Category
                    </button>
                </div>
                <div className="p-8 divide-y space-y-12">
                    {data.groceryCategories.map((cat, catIdx) => (
                      <div key={cat.id} className="pt-8 first:pt-0">
                        <div className="flex items-center gap-6 mb-6">
                          <div className="flex flex-col gap-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
                            <button onClick={() => moveCategory(catIdx, 'up')} className="text-slate-400 hover:text-indigo-600 transition-colors">▲</button>
                            <button onClick={() => moveCategory(catIdx, 'down')} className="text-slate-400 hover:text-indigo-600 transition-colors">▼</button>
                          </div>
                          <input 
                            value={cat.name} 
                            onChange={(e) => {
                              const newCats = [...data.groceryCategories];
                              newCats[catIdx].name = e.target.value;
                              setData(prev => ({ ...prev, groceryCategories: newCats }));
                            }}
                            className="text-2xl font-black text-slate-900 border-none focus:ring-0 bg-transparent p-0 w-full hover:bg-slate-50 transition-colors rounded-lg px-2" 
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 ml-16">
                          {cat.subCategories.map((sub, subIdx) => (
                            <div key={sub.id} className="group flex items-center gap-3 bg-white px-4 py-3 rounded-2xl border border-slate-200 transition-all hover:border-indigo-200 hover:shadow-md">
                               <div className="flex flex-col text-[10px] text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => moveSubCategory(catIdx, subIdx, 'up')} className="hover:text-indigo-600">▲</button>
                                  <button onClick={() => moveSubCategory(catIdx, subIdx, 'down')} className="hover:text-indigo-600">▼</button>
                               </div>
                               <input 
                                value={sub.name}
                                onChange={(e) => {
                                  const newCats = [...data.groceryCategories];
                                  newCats[catIdx].subCategories[subIdx].name = e.target.value;
                                  setData(prev => ({ ...prev, groceryCategories: newCats }));
                                }}
                                className="bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-700 w-full"
                               />
                               <button 
                                 onClick={() => {
                                   if (confirm(`Delete sub-category "${sub.name}"?`)) {
                                      const newCats = [...data.groceryCategories];
                                      newCats[catIdx].subCategories = newCats[catIdx].subCategories.filter(s => s.id !== sub.id);
                                      setData(prev => ({ ...prev, groceryCategories: newCats }));
                                   }
                                 }}
                                 className="text-slate-200 hover:text-red-500 text-sm transition-colors"
                               >✕</button>
                            </div>
                          ))}
                          <button 
                            onClick={() => {
                              const newCats = [...data.groceryCategories];
                              const newSub: GrocerySubCategory = { id: `g-sub-${Date.now()}`, name: 'New Sub-item' };
                              newCats[catIdx].subCategories.push(newSub);
                              setData(prev => ({ ...prev, groceryCategories: newCats }));
                            }}
                            className="text-[10px] font-black text-indigo-500 border-2 border-dashed border-indigo-100 rounded-2xl px-6 py-3 hover:bg-indigo-50 hover:border-indigo-200 transition-all uppercase tracking-widest"
                          >
                            + New Subcategory
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {showBreakupSubId && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
               <div className="bg-white rounded-[2.5rem] w-full max-w-5xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
                  <div className="p-8 border-b flex justify-between items-center bg-slate-50">
                    <div>
                      <h3 className="text-2xl font-black text-slate-900 tracking-tight">{selectedSubCategoryName}</h3>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Detailed Item Breakdown & Management</p>
                    </div>
                    <button onClick={() => setShowBreakupSubId(null)} className="text-slate-400 hover:text-slate-900 text-3xl font-light p-2">✕</button>
                  </div>
                  <div className="flex-1 overflow-auto p-8">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-100 sticky top-0 z-10">
                        <tr>
                          <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Date</th>
                          <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Shop</th>
                          <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Item Description</th>
                          <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Cost (Rs.)</th>
                          <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Move To Category</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {breakupItems.map(item => (
                          <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-4 text-xs font-bold text-slate-400 whitespace-nowrap">{item.billDate}</td>
                            <td className="px-4 py-4 text-sm font-black text-slate-700 whitespace-nowrap">{item.billShop}</td>
                            <td className="px-4 py-4 text-sm font-medium text-slate-600 italic">"{item.description}"</td>
                            <td className="px-4 py-4 text-sm font-black text-indigo-700">Rs. {Number(item.totalCost).toLocaleString()}</td>
                            <td className="px-4 py-4">
                              <SearchableCategoryDropdown 
                                currentValue={`${item.categoryId}|${item.subCategoryId}`}
                                categories={data.groceryCategories}
                                onSelect={(catId, subCatId) => handleCategorizeItem(item.billId!, item.id, catId, subCatId)}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-indigo-50 font-black text-indigo-900 sticky bottom-0">
                        <tr>
                          <td colSpan={3} className="px-4 py-4 text-right uppercase text-[10px] tracking-widest">Total Spend in Category</td>
                          <td colSpan={2} className="px-4 py-4 text-lg">Rs. {breakupItems.reduce((s, i) => s + Number(i.totalCost), 0).toLocaleString()}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
               </div>
            </div>
          )}

          {showAuditBillId && (
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
              <div className="bg-white rounded-[2.5rem] w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95">
                <div className="p-8 border-b flex justify-between items-center bg-slate-50">
                  <div className="flex flex-col flex-1">
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">Edit Bill Details</h3>
                    <div className="flex gap-4 mt-2">
                      <div className="flex flex-col">
                        <label className="text-[9px] text-slate-400 uppercase font-black tracking-widest">Shop Name</label>
                        <input 
                          value={data.groceryBills.find(b => b.id === showAuditBillId)?.shopName}
                          onChange={(e) => handleUpdateBillDetails(showAuditBillId, 'shopName', e.target.value)}
                          className="bg-transparent border-b border-slate-300 focus:border-indigo-600 outline-none text-slate-800 font-bold"
                        />
                      </div>
                      <div className="flex flex-col">
                        <label className="text-[9px] text-slate-400 uppercase font-black tracking-widest">Date</label>
                        <input 
                          type="date"
                          value={data.groceryBills.find(b => b.id === showAuditBillId)?.date}
                          onChange={(e) => handleUpdateBillDetails(showAuditBillId, 'date', e.target.value)}
                          className="bg-transparent border-b border-slate-300 focus:border-indigo-600 outline-none text-slate-800 font-bold"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => handleDeleteBill(showAuditBillId)}
                      className="text-red-500 hover:text-red-700 text-xs font-black uppercase tracking-widest border border-red-200 hover:bg-red-50 px-4 py-2 rounded-xl transition-all"
                    >
                      Delete Bill
                    </button>
                    <button onClick={() => setShowAuditBillId(null)} className="text-slate-400 hover:text-slate-900 text-3xl font-light p-2">✕</button>
                  </div>
                </div>
                <div className="flex-1 overflow-auto p-8">
                   <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                      <div>
                        <h4 className="text-xs font-black text-slate-500 uppercase mb-4 tracking-widest flex items-center gap-2">
                          <span className="text-lg">🖼️</span> Original Receipt
                        </h4>
                        <div className="rounded-3xl border-2 border-slate-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                          <img src={data.groceryBills.find(b => b.id === showAuditBillId)?.imageUrl} className="w-full" alt="Original Receipt" />
                        </div>
                      </div>
                      <div className="flex flex-col h-full">
                        <h4 className="text-xs font-black text-slate-500 uppercase mb-4 tracking-widest flex items-center gap-2">
                          <span className="text-lg">🔡</span> Bill Items
                        </h4>
                        <div className="flex-1 bg-slate-50 rounded-3xl border border-slate-100 overflow-hidden flex flex-col">
                          <div className="overflow-auto flex-1">
                            <table className="w-full text-left text-sm border-collapse">
                              <thead className="bg-white border-b border-slate-200 sticky top-0 z-10">
                                <tr>
                                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Item Description</th>
                                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest w-20">Qty</th>
                                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest w-24">Cost</th>
                                  <th className="px-4 py-3 w-10"></th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 bg-white/50">
                                {data.groceryBills.find(b => b.id === showAuditBillId)?.items.map(item => (
                                  <tr key={item.id} className="hover:bg-white transition-colors group">
                                    <td className="px-4 py-2">
                                      <input 
                                        value={item.description}
                                        onChange={(e) => handleUpdateBillItem(showAuditBillId, item.id, 'description', e.target.value)}
                                        className="w-full bg-transparent border-none p-1 text-xs font-semibold text-slate-700 focus:ring-1 focus:ring-indigo-200 rounded"
                                      />
                                    </td>
                                    <td className="px-4 py-2">
                                       <div className="flex items-center gap-1">
                                          <input 
                                            type="number"
                                            value={item.quantity}
                                            onChange={(e) => handleUpdateBillItem(showAuditBillId, item.id, 'quantity', Number(e.target.value))}
                                            className="w-12 bg-transparent border-none p-1 text-xs font-bold text-slate-500 focus:ring-1 focus:ring-indigo-200 rounded"
                                          />
                                          <span className="text-[10px] text-slate-400">{item.unit}</span>
                                       </div>
                                    </td>
                                    <td className="px-4 py-2">
                                      <input 
                                        type="number"
                                        value={item.totalCost}
                                        onChange={(e) => handleUpdateBillItem(showAuditBillId, item.id, 'totalCost', Number(e.target.value))}
                                        className="w-full bg-transparent border-none p-1 text-xs font-black text-indigo-600 focus:ring-1 focus:ring-indigo-200 rounded"
                                      />
                                    </td>
                                    <td className="px-4 py-2 text-right">
                                      <button 
                                        onClick={() => handleDeleteBillItem(showAuditBillId, item.id)}
                                        className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                      >✕</button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <div className="p-4 bg-white border-t border-slate-200 flex justify-between items-center">
                            <button 
                              onClick={() => handleAddBillItem(showAuditBillId)}
                              className="text-xs font-black text-indigo-600 hover:bg-indigo-50 px-3 py-2 rounded-lg transition-colors uppercase tracking-widest"
                            >
                              + Add Item
                            </button>
                            <div className="text-right">
                              <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest mr-2">Total Bill</span>
                              <span className="text-xl font-black text-indigo-700">Rs. {Number(data.groceryBills.find(b => b.id === showAuditBillId)?.totalAmount).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                   </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'loans' && (
        <div className="space-y-10 animate-in fade-in duration-300">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Loan Accounts & Debt Tracker</h2>
            <div className="flex gap-3">
              <input type="file" accept="image/*" multiple ref={loanFileInputRef} onChange={handleLoanFileUpload} className="hidden" />
              <button 
                onClick={() => loanFileInputRef.current?.click()}
                disabled={isLoanOcrLoading}
                className="bg-amber-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-amber-100 transition-all hover:scale-105 active:scale-95"
              >
                {isLoanOcrLoading ? '🌀 Processing Screenshots...' : '📷 Upload Evidence (OCR)'}
              </button>
              <button onClick={handleAddNewLoanAccount} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold hover:scale-105 active:scale-95 transition-all">
                + New Account
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <SummaryCard title="Aggregate Liabilities" amount={totals.totalLoanDebt} color="red" />
            <SummaryCard title="Active Accounts" amount={data.loans.length} color="indigo" />
            <SummaryCard title="Repayment Rate" amount={0} subtitle="Feature Coming Soon" color="green" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-2">Loan Portfolios</h3>
              {data.loans.map(account => {
                const balance = Number(account.openingBalance || 0) + account.transactions.reduce((s, t) => t.type === 'taken' ? s + Number(t.amount) : s - Number(t.amount), 0);
                return (
                  <div 
                    key={account.id} 
                    onClick={() => setSelectedLoanAccountId(account.id)}
                    className={`p-5 rounded-3xl cursor-pointer border transition-all ${
                      selectedLoanAccountId === account.id 
                        ? 'bg-indigo-600 border-indigo-700 shadow-xl shadow-indigo-100 text-white' 
                        : 'bg-white border-slate-100 hover:border-indigo-200 text-slate-800'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-black text-lg truncate pr-4">{account.name}</h4>
                      <div className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg ${selectedLoanAccountId === account.id ? 'bg-white/20' : 'bg-slate-100'}`}>
                        {account.transactions.length} items
                      </div>
                    </div>
                    <p className={`text-sm font-bold ${selectedLoanAccountId === account.id ? 'text-indigo-100' : 'text-slate-500'}`}>Current Balance</p>
                    <p className={`text-2xl font-black ${selectedLoanAccountId === account.id ? 'text-white' : 'text-indigo-600'}`}>
                      Rs. {balance.toLocaleString()}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="lg:col-span-2">
              {selectedLoanAccountId ? (
                <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-right-4">
                  <div className="p-8 border-b bg-slate-50 flex justify-between items-center">
                    <div>
                      <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                        {data.loans.find(a => a.id === selectedLoanAccountId)?.name}
                      </h3>
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-1">Transaction History & Verification</p>
                    </div>
                    <div className="text-right">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Manual Opening Balance</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">Rs.</span>
                        <input 
                          type="number" 
                          value={data.loans.find(a => a.id === selectedLoanAccountId)?.openingBalance || 0}
                          onChange={(e) => handleUpdateLoanOpeningBalance(selectedLoanAccountId, Number(e.target.value))}
                          className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 focus:ring-2 focus:ring-indigo-100 outline-none w-40"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="p-0">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-100">
                        <tr>
                          <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Date</th>
                          <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Description</th>
                          <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Type</th>
                          <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Amount (Rs.)</th>
                          <th className="px-6 py-4"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.loans.find(a => a.id === selectedLoanAccountId)?.transactions.sort((a,b) => b.date.localeCompare(a.date)).map(tx => (
                          <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors group">
                            <td className="px-6 py-4 text-xs font-bold text-slate-400 whitespace-nowrap">
                              <input 
                                type="date" 
                                value={tx.date} 
                                onChange={(e) => handleUpdateLoanTransaction(selectedLoanAccountId, tx.id, 'date', e.target.value)}
                                className="bg-transparent border-none focus:ring-0 p-0 font-bold"
                              />
                            </td>
                            <td className="px-6 py-4">
                              <input 
                                value={tx.description} 
                                onChange={(e) => handleUpdateLoanTransaction(selectedLoanAccountId, tx.id, 'description', e.target.value)}
                                className="w-full bg-transparent border-none focus:ring-0 p-0 font-bold text-slate-800 text-sm italic"
                              />
                            </td>
                            <td className="px-6 py-4 text-center">
                              <button 
                                onClick={() => handleUpdateLoanTransaction(selectedLoanAccountId, tx.id, 'type', tx.type === 'taken' ? 'repayment' : 'taken')}
                                className={`text-[9px] font-black uppercase px-3 py-1.5 rounded-full transition-all ${
                                  tx.type === 'taken' 
                                    ? 'bg-red-50 text-red-600 border border-red-100' 
                                    : 'bg-green-50 text-green-600 border border-green-100'
                                }`}
                              >
                                {tx.type === 'taken' ? 'Loan Taken' : 'Repayment'}
                              </button>
                            </td>
                            <td className="px-6 py-4">
                              <input 
                                type="number"
                                value={tx.amount} 
                                onChange={(e) => handleUpdateLoanTransaction(selectedLoanAccountId, tx.id, 'amount', Number(e.target.value))}
                                className={`w-24 bg-transparent border-none focus:ring-0 p-0 font-black text-base ${tx.type === 'taken' ? 'text-red-700' : 'text-green-700'}`}
                              />
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button 
                                onClick={() => handleDeleteLoanTransaction(selectedLoanAccountId, tx.id)}
                                className="text-slate-300 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                              >✕</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="h-full bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center p-12 text-center text-slate-400">
                  <div className="text-6xl mb-6 opacity-30">📜</div>
                  <h4 className="text-lg font-black uppercase tracking-widest mb-2">Select an account</h4>
                  <p className="text-sm font-semibold max-w-xs">View detailed payment history or upload new evidence to track your loans.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'cash' && (
        <div className="space-y-8 animate-in fade-in duration-300">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Cash In Hand</h2>
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl px-6 py-3 flex items-center gap-6 shadow-sm">
              <div className="flex flex-col">
                <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest">Opening Cash</span>
                <div className="relative mt-1">
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">Rs.</span>
                  <input
                    type="number"
                    value={data.cash.openingBalance}
                    onChange={(e) => handleUpdateCashOpening(Number(e.target.value))}
                    className="pl-6 pr-2 py-1 bg-transparent border-none focus:ring-0 font-black text-lg text-slate-900 w-32 outline-none"
                  />
                </div>
              </div>
              <div className="w-[1px] h-10 bg-emerald-200"></div>
              <div className="flex flex-col">
                <span className="text-[10px] text-emerald-800 font-bold uppercase tracking-widest">Closing Balance</span>
                <span className={`text-xl font-black mt-1 ${totals.cashBalance >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                  Rs. {totals.cashBalance.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <div className="space-y-4">
                <h3 className="text-xl font-bold text-emerald-700">Cash Income</h3>
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                   <table className="w-full text-left">
                      <thead className="bg-emerald-500 text-white text-[10px] font-black uppercase">
                        <tr>
                          <th className="px-4 py-2">Date</th>
                          <th className="px-4 py-2">Source</th>
                          <th className="px-4 py-2">Amount</th>
                          <th className="px-4 py-2"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.cash.income.map(item => (
                          <tr key={item.id} className={item.isSynced ? 'bg-indigo-50/20' : ''}>
                            <td className="px-4 py-2 text-xs font-bold text-slate-500">
                              {item.isSynced ? item.date : <input type="date" value={item.date} onChange={(e) => handleUpdateCashItem('income', item.id, 'date', e.target.value)} className="bg-transparent border-none p-0 text-xs font-bold w-full" />}
                            </td>
                            <td className="px-4 py-2 text-sm font-semibold text-slate-700">
                              {item.isSynced ? <span className="italic text-indigo-700">{item.description} (Synced)</span> : <input value={item.description} onChange={(e) => handleUpdateCashItem('income', item.id, 'description', e.target.value)} className="bg-transparent border-none p-0 text-sm font-semibold w-full" />}
                            </td>
                            <td className="px-4 py-2 font-black text-emerald-700">Rs. {item.amount.toLocaleString()}</td>
                            <td className="px-4 py-2 text-right">
                              <button onClick={() => handleRemoveCashItem('income', item.id)} className="text-slate-300 hover:text-red-500">✕</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                   </table>
                   <button onClick={() => handleAddCashItem('income')} className="w-full py-2 bg-emerald-50 text-emerald-700 text-xs font-black uppercase">+ Add Income</button>
                </div>
             </div>
             <div className="space-y-4">
                <h3 className="text-xl font-bold text-orange-700">Cash Expenses</h3>
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                   <table className="w-full text-left">
                      <thead className="bg-orange-500 text-white text-[10px] font-black uppercase">
                        <tr>
                          <th className="px-4 py-2">Date</th>
                          <th className="px-4 py-2">Reason</th>
                          <th className="px-4 py-2">Amount</th>
                          <th className="px-4 py-2"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.cash.expenses.map(item => (
                          <tr key={item.id} className={item.isSynced ? 'bg-indigo-50/20' : ''}>
                            <td className="px-4 py-2 text-xs font-bold text-slate-500">
                              {item.isSynced ? item.date : <input type="date" value={item.date} onChange={(e) => handleUpdateCashItem('expenses', item.id, 'date', e.target.value)} className="bg-transparent border-none p-0 text-xs font-bold w-full" />}
                            </td>
                            <td className="px-4 py-2 text-sm font-semibold text-slate-700">
                              {item.isSynced ? <span className="italic text-indigo-700">{item.description} (Synced)</span> : <input value={item.description} onChange={(e) => handleUpdateCashItem('expenses', item.id, 'description', e.target.value)} className="bg-transparent border-none p-0 text-sm font-semibold w-full" />}
                            </td>
                            <td className="px-4 py-2 font-black text-orange-700">Rs. {item.amount.toLocaleString()}</td>
                            <td className="px-4 py-2 text-right">
                              <button onClick={() => handleRemoveCashItem('expenses', item.id)} className="text-slate-300 hover:text-red-500">✕</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                   </table>
                   <button onClick={() => handleAddCashItem('expenses')} className="w-full py-2 bg-orange-50 text-orange-700 text-xs font-black uppercase">+ Add Expense</button>
                </div>
             </div>
          </div>
        </div>
      )}

      {activeTab === 'onetime' && (
        <div className="space-y-8 animate-in fade-in duration-300">
           <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">One-Time Commitments</h2>
            <button 
              onClick={() => {
                const newItem: OneTimePayment = { id: `otp-${Date.now()}`, title: 'New Requirement', totalAmount: 0, paidAmount: 0, dueDate: '' };
                setData(prev => ({ ...prev, oneTimePayments: [...prev.oneTimePayments, newItem] }));
              }}
              className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold text-xs hover:bg-blue-700 shadow-lg"
            >
              + ADD NEW PAYMENT
            </button>
          </div>
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-900 text-white text-[10px] font-black uppercase">
                <tr>
                  <th className="px-6 py-4">Goal</th>
                  <th className="px-6 py-4">Target (Rs.)</th>
                  <th className="px-6 py-4">Paid (Rs.)</th>
                  <th className="px-6 py-4">Due</th>
                  <th className="px-6 py-4">Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.oneTimePayments.map(item => {
                  const progress = Number(item.totalAmount) > 0 ? Math.min(100, (Number(item.paidAmount) / Number(item.totalAmount)) * 100) : 0;
                  return (
                    <tr key={item.id} className="hover:bg-blue-50/20">
                      <td className="px-6 py-4 font-bold text-sm">
                        <input value={item.title} onChange={(e) => handleUpdateOneTime(item.id, 'title', e.target.value)} className="bg-transparent border-none p-0 w-full" />
                      </td>
                      <td className="px-6 py-4">
                        <input type="number" value={item.totalAmount} onChange={(e) => handleUpdateOneTime(item.id, 'totalAmount', Number(e.target.value))} className="bg-slate-50 border border-slate-100 rounded px-2 py-1 w-28 font-bold" />
                      </td>
                      <td className="px-6 py-4">
                        <input type="number" value={item.paidAmount} onChange={(e) => handleUpdateOneTime(item.id, 'paidAmount', Number(e.target.value))} className="bg-green-50 border border-green-100 text-green-700 rounded px-2 py-1 w-28 font-bold" />
                      </td>
                      <td className="px-6 py-4">
                         <input type="date" value={item.dueDate} onChange={(e) => handleUpdateOneTime(item.id, 'dueDate', e.target.value)} className="bg-transparent border-none p-0 text-xs font-bold" />
                      </td>
                      <td className="px-6 py-4 min-w-[120px]">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div className="bg-blue-600 h-full rounded-full" style={{ width: `${progress}%` }}></div>
                          </div>
                          <span className="text-[10px] font-black">{progress.toFixed(0)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'savings' && (
        <div className="space-y-8 animate-in fade-in duration-300">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Savings</h2>
            <div className="flex gap-4">
              <div className="bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100">
                 <span className="text-[10px] font-black text-indigo-400 block">Total Balance</span>
                 <span className="text-lg font-black text-indigo-700">Rs. {totals.savingsBalance.toLocaleString()}</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <div className="space-y-4">
                <h3 className="font-bold text-indigo-700">Additions</h3>
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                   <table className="w-full text-left text-sm">
                      <thead className="bg-indigo-500 text-white text-[10px] font-black">
                        <tr><th className="px-4 py-2">Date</th><th className="px-4 py-2">Amount</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.savings.additions.map(a => (
                          <tr key={a.id}>
                            <td className="px-4 py-2 text-xs font-bold text-slate-500">{a.date}</td>
                            <td className="px-4 py-2 font-black text-indigo-600">Rs. {a.amount.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                   </table>
                   <button onClick={handleAddSavingsAddition} className="w-full py-2 bg-indigo-50 text-indigo-700 text-xs font-black">+ Add Deposit</button>
                </div>
             </div>
             <div className="space-y-4">
                <h3 className="font-bold text-orange-700">Withdrawals</h3>
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                   <table className="w-full text-left text-sm">
                      <thead className="bg-orange-500 text-white text-[10px] font-black">
                        <tr><th className="px-4 py-2">Date</th><th className="px-4 py-2">Reason</th><th className="px-4 py-2">Amount</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.savings.withdrawals.map(w => (
                          <tr key={w.id}>
                            <td className="px-4 py-2 text-xs font-bold text-slate-500">{w.date}</td>
                            <td className="px-4 py-2 font-semibold text-slate-700">{w.reason}</td>
                            <td className="px-4 py-2 font-black text-orange-600">Rs. {w.amount.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                   </table>
                   <button onClick={handleAddSavingsWithdrawal} className="w-full py-2 bg-orange-50 text-orange-700 text-xs font-black">+ Add Withdrawal</button>
                </div>
             </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default App;