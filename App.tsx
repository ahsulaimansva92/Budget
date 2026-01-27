
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
    if (!subId || subId === 'unassigned') return placeholder;
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
        onClick={() => { setIsOpen(!isOpen); setSearch(''); }}
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
              placeholder="Search items..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold border border-slate-200 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none placeholder:text-slate-400"
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-1 custom-scrollbar">
            {filteredCategories.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 font-bold italic">No categories found</div>
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
                          onClick={() => { onSelect(cat.id, sub.id); setIsOpen(false); }}
                          className={`w-full text-left px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
                            isSelected ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-indigo-700'
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
  const [isManualBillModalOpen, setIsManualBillModalOpen] = useState(false);
  
  const [manualBillData, setManualBillData] = useState<{
    shopName: string;
    date: string;
    items: Array<Partial<GroceryBillItem>>;
  }>({
    shopName: '',
    date: new Date().toISOString().split('T')[0],
    items: [{ id: `m-item-${Date.now()}`, description: '', quantity: 1, unit: 'unit', totalCost: 0, categoryId: 'unassigned', subCategoryId: 'unassigned' }]
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const loanFileInputRef = useRef<HTMLInputElement>(null);

  const [selectedLoanAccountId, setSelectedLoanAccountId] = useState<string | null>(null);
  const [isLoanOcrLoading, setIsLoanOcrLoading] = useState(false);

  const syncCashData = (currentData: BudgetData): BudgetData => {
    const today = new Date().toISOString().split('T')[0];
    const nonSyncedCashIncome = currentData.cash.income.filter(item => !item.id.startsWith('cash-sync-'));
    const nonSyncedCashExpenses = currentData.cash.expenses.filter(item => !item.id.startsWith('cash-sync-'));
    const syncedIncome: CashEntry[] = currentData.income
      .filter(i => i.isCashHandled)
      .map(i => ({ id: `cash-sync-inc-${i.id}`, date: today, description: `Income: ${i.name}`, amount: Number(i.amount), isSynced: true }));
    const syncedExpenses: CashEntry[] = currentData.expenses
      .filter(e => e.isCashHandled)
      .map(e => ({ id: `cash-sync-exp-${e.id}`, date: today, description: `Expense: ${e.name}`, amount: Number(e.amount), isSynced: true }));
    return { ...currentData, cash: { ...currentData.cash, income: [...nonSyncedCashIncome, ...syncedIncome], expenses: [...nonSyncedCashExpenses, ...syncedExpenses] } };
  };

  useEffect(() => {
    localStorage.setItem('home_budget_data', JSON.stringify(data));
  }, [data]);

  const totals = useMemo(() => {
    const totalIncome = data.income.reduce((sum, item) => sum + Number(item.amount), 0);
    const recurringExpenses = data.expenses.reduce((sum, item) => sum + Number(item.amount), 0);
    const totalGrocerySpend = data.groceryBills.reduce((sum, bill) => sum + Number(bill.totalAmount), 0);
    const totalVerifiedGroceryAmount = data.groceryBills.filter(b => b.isVerified).reduce((sum, bill) => sum + Number(bill.totalAmount), 0);
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
      const balance = Number(account.openingBalance || 0) + account.transactions.reduce((s, t) => t.type === 'taken' ? s + Number(t.amount) : s - Number(t.amount), 0);
      return acc + balance;
    }, 0);

    return {
      totalIncome, totalExpenses, recurringExpenses, balance: totalIncome - totalExpenses,
      savingsBalance, cashBalance: closingCashBalance, totalGrocerySpend, totalVerifiedGroceryAmount,
      salaryIncome, rentIncome, salaryExpenses, rentExpenses,
      salaryRemaining: salaryIncome - salaryExpenses, rentRemaining: rentIncome - rentExpenses,
      totalOneTime, totalLoanDebt
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
        .filter(item => !item.subCategoryId || item.subCategoryId === 'unassigned')
        .map(item => ({ ...item, billId: bill.id, billDate: bill.date, billShop: bill.shopName }))
    );
  }, [data.groceryBills]);

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
    const newExp: ExpenseItem = { id: `exp-${Date.now()}`, name: 'New Expense', amount: 0, category: 'General', sourceType, isCashHandled: false };
    setData(prev => ({ ...prev, expenses: [...prev.expenses, newExp] }));
  };

  const handleToggleVerifyBill = (billId: string) => {
    setData(prev => ({
      ...prev,
      groceryBills: prev.groceryBills.map(bill => bill.id === billId ? { ...bill, isVerified: !bill.isVerified } : bill)
    }));
  };

  const handleDeleteBill = (billId: string) => {
    if (confirm("Delete this bill? Stats will be updated automatically.")) {
      setData(prev => ({ ...prev, groceryBills: prev.groceryBills.filter(b => b.id !== billId) }));
    }
  };

  const handleSaveManualBill = () => {
    if (!manualBillData.shopName || manualBillData.items.length === 0) {
      alert("Please enter shop name and at least one item.");
      return;
    }
    const totalAmount = manualBillData.items.reduce((sum, item) => sum + (Number(item.totalCost) || 0), 0);
    const newBill: GroceryBill = {
      id: `bill-manual-${Date.now()}`,
      shopName: manualBillData.shopName,
      date: manualBillData.date,
      totalAmount,
      isVerified: false,
      items: manualBillData.items.map(item => ({
        id: item.id || `m-item-${Math.random()}`,
        description: item.description || 'Unnamed Item',
        quantity: Number(item.quantity) || 1,
        unit: item.unit || 'unit',
        unitCost: (Number(item.totalCost) || 0) / (Number(item.quantity) || 1),
        totalCost: Number(item.totalCost) || 0,
        categoryId: item.categoryId || 'unassigned',
        subCategoryId: item.subCategoryId || 'unassigned'
      }))
    };
    setData(prev => ({ ...prev, groceryBills: [newBill, ...prev.groceryBills] }));
    setIsManualBillModalOpen(false);
    setGrocerySubTab('bills');
    setManualBillData({ shopName: '', date: new Date().toISOString().split('T')[0], items: [{ id: `m-item-${Date.now()}`, description: '', quantity: 1, unit: 'unit', totalCost: 0, categoryId: 'unassigned', subCategoryId: 'unassigned' }] });
  };

  const handleUpdateManualItem = (id: string, field: keyof GroceryBillItem, value: any) => {
    setManualBillData(prev => ({ ...prev, items: prev.items.map(item => item.id === id ? { ...item, [field]: value } : item) }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // Explicitly cast to File[] to avoid 'unknown' type issues in map callbacks
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;
    
    setIsOcrLoading(true);
    
    try {
      const base64Images = await Promise.all(files.map((file: File) => {
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve(ev.target?.result as string);
          // file is now correctly typed as File (which extends Blob)
          reader.readAsDataURL(file);
        });
      }));

      const result = await processGroceryBill(base64Images, data.groceryCategories, data.mappingOverrides || {});
      
      const newBill: GroceryBill = {
        id: `bill-ocr-${Date.now()}`,
        date: result.date || new Date().toISOString().split('T')[0],
        shopName: result.shopName || 'Unknown Shop',
        imageUrls: base64Images,
        totalAmount: result.items.reduce((s: number, i: any) => s + Number(i.totalCost), 0),
        isVerified: false,
        items: result.items.map((i: any) => {
          const cat = data.groceryCategories.find(c => c.name === i.categoryName);
          const sub = cat?.subCategories.find(s => s.name === i.subCategoryName);
          return {
            id: `item-${Math.random()}`,
            description: i.description, quantity: Number(i.quantity), unit: i.unit,
            unitCost: Number(i.unitCost), totalCost: Number(i.totalCost),
            categoryId: cat?.id || 'unassigned', subCategoryId: sub?.id || 'unassigned'
          };
        })
      };
      
      setData(prev => ({ ...prev, groceryBills: [newBill, ...prev.groceryBills] }));
      setGrocerySubTab('bills');
    } catch (err) { 
      alert("OCR Failed. Please try with clearer images."); 
      console.error(err);
    } finally { 
      setIsOcrLoading(false); 
      e.target.value = ''; 
    }
  };

  const handleCategorizeItem = (billId: string, itemId: string, catId: string, subCatId: string) => {
    const cat = data.groceryCategories.find(c => c.id === catId);
    const sub = cat?.subCategories.find(s => s.id === subCatId);
    
    setData(prev => {
      const bill = prev.groceryBills.find(b => b.id === billId);
      const item = bill?.items.find(i => i.id === itemId);
      const rawDesc = item?.rawDescription || item?.description;
      
      const newOverrides = { ...(prev.mappingOverrides || {}) };
      if (rawDesc && cat && sub) {
        newOverrides[rawDesc] = { categoryName: cat.name, subCategoryName: sub.name };
      }
      return {
        ...prev,
        mappingOverrides: newOverrides,
        groceryBills: prev.groceryBills.map(b => {
          if (b.id !== billId) return b;
          return { ...b, items: b.items.map(it => it.id === itemId ? { ...it, categoryId: catId, subCategoryId: subCatId } : it) };
        })
      };
    });
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {activeTab === 'dashboard' && (
        <div className="space-y-10 animate-in fade-in duration-500">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Financial Dashboard</h2>
            <button onClick={async () => { setIsAnalyzing(true); setAiInsight(await analyzeBudget(data)); setIsAnalyzing(false); }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-100 transition-all flex items-center gap-2 transform hover:scale-105 active:scale-95">
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
        </div>
      )}

      {activeTab === 'income' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Monthly Income</h2>
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 text-center">In Cash?</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">Revenue Source</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">Monthly Amount (LKR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.income.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-center">
                      <input type="checkbox" checked={item.isCashHandled || false} onChange={(e) => handleUpdateIncome(item.id, 'isCashHandled', e.target.checked)} className="w-5 h-5 accent-indigo-600 cursor-pointer" />
                    </td>
                    <td className="px-6 py-4 font-semibold text-base text-slate-800">{item.name}</td>
                    <td className="px-6 py-4">
                      <div className="relative max-w-xs">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">Rs.</span>
                        <input type="number" value={item.amount} onChange={(e) => handleUpdateIncome(item.id, 'amount', Number(e.target.value))} className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-base text-indigo-700 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'expenses' && (
        <div className="space-y-10 animate-in fade-in duration-300">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Recurring Expenses</h2>
          <div className="grid grid-cols-1 gap-12">
            {['Salary', 'Rent'].map(source => (
              <div key={source} className="space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b-2 pb-3 border-indigo-500">
                  <h3 className="text-xl font-black text-indigo-800">{source === 'Salary' ? '1. Expenses via Salary' : '2. Expenses via Rent'}</h3>
                  <div className="bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100 flex flex-col gap-1">
                    <span className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider">Total {source}</span>
                    <span className="text-sm font-bold text-slate-700">Rs. {(source === 'Salary' ? totals.salaryIncome : totals.rentIncome).toLocaleString()}</span>
                  </div>
                </div>
                <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-indigo-600">
                      <tr>
                        <th className="px-6 py-3 text-[10px] font-black text-white uppercase tracking-widest w-16 text-center">Cash?</th>
                        <th className="px-6 py-3 text-[10px] font-black text-white uppercase tracking-widest">Category</th>
                        <th className="px-6 py-3 text-[10px] font-black text-white uppercase tracking-widest">Description</th>
                        <th className="px-6 py-3 text-[10px] font-black text-white uppercase tracking-widest">Amount (Rs.)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.expenses.filter(e => e.sourceType === source).map(item => (
                        <tr key={item.id} className="hover:bg-indigo-50/30 transition-colors">
                          <td className="px-6 py-2 text-center">
                            <input type="checkbox" checked={item.isCashHandled || false} onChange={(e) => handleUpdateExpense(item.id, 'isCashHandled', e.target.checked)} className="w-4 h-4 accent-indigo-600" />
                          </td>
                          <td className="px-6 py-2">
                            <input value={item.category} onChange={(e) => handleUpdateExpense(item.id, 'category', e.target.value)} className="bg-transparent border-none focus:ring-0 w-full text-slate-500 text-[11px] font-bold italic" />
                          </td>
                          <td className="px-6 py-2">
                            <input value={item.name} onChange={(e) => handleUpdateExpense(item.id, 'name', e.target.value)} className="w-full border-none focus:ring-0 text-slate-800 font-semibold text-sm" />
                          </td>
                          <td className="px-6 py-2">
                            <input type="number" value={item.amount} onChange={(e) => handleUpdateExpense(item.id, 'amount', Number(e.target.value))} className="w-full border-none focus:ring-0 text-indigo-700 font-bold text-sm" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button onClick={() => handleAddExpense(source as any)} className="w-full py-3.5 text-xs font-black text-indigo-600 bg-indigo-50/50 hover:bg-indigo-100 transition-all border-t border-indigo-100">+ ADD {source.toUpperCase()} EXPENSE</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'groceries' && (
        <div className="space-y-10 animate-in fade-in duration-300 pb-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Grocery Tracker</h2>
            <div className="flex gap-3">
              <button onClick={() => setIsManualBillModalOpen(true)} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-100 transition-all hover:scale-105 active:scale-95">
                <span className="text-xl">✍️</span> Add Bill Manually
              </button>
              <input type="file" accept="image/*" multiple ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} disabled={isOcrLoading} className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-emerald-100 transition-all hover:scale-105 active:scale-95">
                {isOcrLoading ? <><span className="animate-spin text-xl">🌀</span> Scanning...</> : <><span className="text-xl">📷</span> Capture Bill(s)</>}
              </button>
            </div>
          </div>

          <div className="flex gap-1 bg-slate-100 p-1.5 rounded-2xl w-full max-w-2xl">
            {[{ id: 'analysis', label: 'Spend Analysis', icon: '📊' }, { id: 'bills', label: 'Bills Archive', icon: '🧾' }, { id: 'categories', label: 'Manage Categories', icon: '⚙️' }].map((tab) => (
              <button key={tab.id} onClick={() => setGrocerySubTab(tab.id as any)} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${grocerySubTab === tab.id ? 'bg-white text-indigo-700 shadow-md' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
                <span>{tab.icon}</span> {tab.label}
              </button>
            ))}
          </div>

          {grocerySubTab === 'analysis' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <SummaryCard title="Total Bills Value" amount={totals.totalGrocerySpend} color="blue" />
                <SummaryCard title="Verified Amount" amount={totals.totalVerifiedGroceryAmount} color="green" />
                <SummaryCard 
                  title="Categorized Total" 
                  amount={totalCategorizedSpend} 
                  color={totals.totalGrocerySpend === totalCategorizedSpend ? "indigo" : "red"} 
                  subtitle={totals.totalGrocerySpend === totalCategorizedSpend ? "Full Reconciled ✅" : `Mismatch: Rs. ${(totals.totalGrocerySpend - totalCategorizedSpend).toLocaleString()} ❌`} 
                />
              </div>

              {unassignedItems.length > 0 && (
                <div className="bg-amber-50 border-2 border-amber-200 p-6 rounded-[2rem] shadow-sm">
                  <h3 className="text-xl font-black text-slate-900 mb-4">Pending Categorization ({unassignedItems.length})</h3>
                  <div className="grid grid-cols-1 gap-3">
                    {unassignedItems.map(item => (
                      <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-amber-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex-1">
                          <div className="font-bold text-slate-800">{item.description}</div>
                          <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{item.billShop} | {item.billDate}</div>
                        </div>
                        <div className="flex items-center gap-4 w-full md:w-auto">
                          <div className="font-black text-indigo-700">Rs. {item.totalCost.toLocaleString()}</div>
                          <SearchableCategoryDropdown currentValue={`${item.categoryId}|${item.subCategoryId}`} categories={data.groceryCategories} onSelect={(catId, subCatId) => handleCategorizeItem(item.billId!, item.id, catId, subCatId)} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100">
                <div className="flex justify-between items-center mb-8 border-b pb-4">
                    <h3 className="text-xl font-black text-slate-900">Spend by Category Breakdown</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {data.groceryCategories.map(cat => (
                    <div key={cat.id} className="p-6 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col">
                        <div className="flex justify-between items-start mb-6">
                          <span className="text-[11px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-3 py-1 rounded-full">{cat.name}</span>
                          <span className="text-xl font-black text-slate-900">Rs. {Number(categoryTotals[cat.id] || 0).toLocaleString()}</span>
                        </div>
                        <div className="space-y-3 flex-1">
                          {cat.subCategories.map(sub => {
                            const stats = groceryStats[sub.id];
                            if (!stats) return null;
                            return (
                              <div key={sub.id} className="text-xs flex flex-col gap-1 border-t border-slate-200/50 pt-3 mt-1 cursor-pointer hover:bg-white hover:rounded-xl p-2 transition-all group" onClick={() => setShowBreakupSubId(sub.id)}>
                                <div className="flex justify-between font-bold text-slate-700 group-hover:text-indigo-600">
                                  <span className="truncate pr-4">{sub.name}</span>
                                  <span className="whitespace-nowrap">Rs. {Number(stats.totalAmount).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                                  <span>Quantity: {Number(stats.totalQuantity).toFixed(1)}</span>
                                  <span>Items: {stats.itemCount}</span>
                                </div>
                              </div>
                            );
                          })}
                          {(!cat.subCategories.some(s => groceryStats[s.id])) && (
                            <div className="text-[10px] text-slate-400 italic font-bold text-center py-4">No spend recorded</div>
                          )}
                        </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {grocerySubTab === 'bills' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <SummaryCard title="Verified Total" amount={totals.totalVerifiedGroceryAmount} color="green" />
                <SummaryCard title="Unverified Total" amount={totals.totalGrocerySpend - totals.totalVerifiedGroceryAmount} color="red" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {data.groceryBills.length === 0 ? (
                  <div className="col-span-full py-20 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200">
                    <p className="text-slate-400 font-black uppercase tracking-widest">No bills archived yet</p>
                  </div>
                ) : (
                  data.groceryBills.map(bill => (
                    <div key={bill.id} className={`bg-white rounded-3xl shadow-lg border-2 transition-all relative group overflow-hidden ${bill.isVerified ? 'border-green-500 shadow-green-50' : 'border-slate-100 hover:border-indigo-100'}`}>
                      <div className="absolute top-4 left-4 z-20">
                        <input type="checkbox" checked={bill.isVerified || false} onChange={() => handleToggleVerifyBill(bill.id)} className="w-6 h-6 accent-green-600 cursor-pointer shadow-md rounded-md" title="Verify Bill" />
                      </div>
                      <button onClick={() => handleDeleteBill(bill.id)} className="absolute top-4 right-4 z-20 bg-white/90 p-2 rounded-xl text-red-500 hover:bg-red-500 hover:text-white opacity-0 group-hover:opacity-100 transition-all shadow-lg">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                      <div className="relative h-40 bg-slate-100">
                        {bill.imageUrls && bill.imageUrls.length > 0 ? (
                          <div className="relative w-full h-full">
                            <img src={bill.imageUrls[0]} className={`w-full h-full object-cover transition-all ${bill.isVerified ? 'grayscale-0' : 'grayscale'}`} />
                            {bill.imageUrls.length > 1 && (
                              <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] font-black px-2 py-1 rounded-md backdrop-blur-sm border border-white/20">
                                +{bill.imageUrls.length - 1} more
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-full text-slate-300 font-bold bg-slate-200 text-6xl">✍️</div>
                        )}
                        <div className={`absolute inset-0 p-4 flex flex-col justify-end bg-gradient-to-t from-black/70 to-transparent ${bill.isVerified ? 'from-green-900/80' : ''}`}>
                          <h4 className="text-white font-black text-lg truncate">{bill.shopName} {bill.isVerified && '✅'}</h4>
                          <p className="text-white/80 text-xs font-bold uppercase tracking-widest">{bill.date}</p>
                        </div>
                      </div>
                      <div className={`p-5 flex justify-between items-center bg-white ${bill.isVerified ? 'bg-green-50/30' : ''}`}>
                        <div>
                          <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest mb-1">Bill Amount</p>
                          <p className={`text-xl font-black ${bill.isVerified ? 'text-green-700' : 'text-indigo-700'}`}>Rs. {Number(bill.totalAmount).toLocaleString()}</p>
                        </div>
                        <button onClick={() => setShowAuditBillId(bill.id)} className="bg-slate-50 hover:bg-slate-100 text-slate-600 px-4 py-2 rounded-xl text-xs font-black uppercase border border-slate-200">Audit</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {grocerySubTab === 'categories' && (
            <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
              <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                <h3 className="text-xl font-bold">Category Configuration</h3>
                <button onClick={() => setData(prev => ({ ...prev, groceryCategories: [...prev.groceryCategories, { id: `g-cat-${Date.now()}`, name: 'New Category', subCategories: [] }] }))} className="bg-indigo-600 hover:bg-indigo-700 px-5 py-2.5 rounded-xl text-xs font-black uppercase">+ New Category</button>
              </div>
              <div className="p-8 divide-y space-y-12">
                {data.groceryCategories.map((cat, catIdx) => (
                  <div key={cat.id} className="pt-8 first:pt-0 space-y-6">
                    <input value={cat.name} onChange={(e) => { const newCats = [...data.groceryCategories]; newCats[catIdx].name = e.target.value; setData(prev => ({ ...prev, groceryCategories: newCats })); }} className="text-2xl font-black text-slate-900 border-none focus:ring-0 bg-transparent p-0 w-full hover:bg-slate-50 rounded-lg px-2" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 ml-6">
                      {cat.subCategories.map((sub, subIdx) => (
                        <div key={sub.id} className="flex items-center gap-3 bg-white px-4 py-3 rounded-2xl border border-slate-200">
                          <input value={sub.name} onChange={(e) => { const newCats = [...data.groceryCategories]; newCats[catIdx].subCategories[subIdx].name = e.target.value; setData(prev => ({ ...prev, groceryCategories: newCats })); }} className="bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-700 w-full" />
                          <button onClick={() => { const newCats = [...data.groceryCategories]; newCats[catIdx].subCategories = newCats[catIdx].subCategories.filter(s => s.id !== sub.id); setData(prev => ({ ...prev, groceryCategories: newCats })); }} className="text-slate-200 hover:text-red-500">✕</button>
                        </div>
                      ))}
                      <button onClick={() => { const newCats = [...data.groceryCategories]; newCats[catIdx].subCategories.push({ id: `g-sub-${Date.now()}`, name: 'New Sub-item' }); setData(prev => ({ ...prev, groceryCategories: newCats })); }} className="text-[10px] font-black text-indigo-500 border-2 border-dashed border-indigo-100 rounded-2xl px-6 py-3 hover:bg-indigo-50 transition-all uppercase tracking-widest">+ New Subcategory</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MANUAL ENTRY MODAL */}
      {isManualBillModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[80] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-2xl font-black text-slate-900">Manual Bill Entry</h3>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Record a purchase without a receipt photo</p>
              </div>
              <button onClick={() => setIsManualBillModalOpen(false)} className="text-slate-400 hover:text-slate-900 text-3xl font-light p-2">✕</button>
            </div>
            <div className="flex-1 overflow-auto p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <input type="text" placeholder="Shop Name" value={manualBillData.shopName} onChange={(e) => setManualBillData(prev => ({ ...prev, shopName: e.target.value }))} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-4 focus:ring-indigo-50 outline-none transition-all" />
                <input type="date" value={manualBillData.date} onChange={(e) => setManualBillData(prev => ({ ...prev, date: e.target.value }))} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-4 focus:ring-indigo-50 outline-none transition-all" />
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b pb-3"><h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Bill Items</h4><button onClick={() => setManualBillData(prev => ({ ...prev, items: [...prev.items, { id: `m-item-${Date.now()}`, description: '', quantity: 1, unit: 'unit', totalCost: 0, categoryId: 'unassigned', subCategoryId: 'unassigned' }] }))} className="text-indigo-600 text-xs font-black uppercase">+ Add Item</button></div>
                <div className="space-y-3">
                  {manualBillData.items.map(item => (
                    <div key={item.id} className="grid grid-cols-12 gap-3 items-center bg-slate-50/50 p-3 rounded-2xl border border-slate-100 group">
                      <input placeholder="Item Description" value={item.description} onChange={(e) => handleUpdateManualItem(item.id!, 'description', e.target.value)} className="col-span-4 bg-white border-none rounded-lg text-sm font-bold p-2 focus:ring-2 focus:ring-indigo-100" />
                      <input type="number" placeholder="Qty" value={item.quantity} onChange={(e) => handleUpdateManualItem(item.id!, 'quantity', Number(e.target.value))} className="col-span-1 bg-white border-none rounded-lg text-sm font-bold p-2 focus:ring-2 focus:ring-indigo-100 text-center" />
                      <div className="col-span-3">
                        <SearchableCategoryDropdown placeholder="Categorize" currentValue={`${item.categoryId}|${item.subCategoryId}`} categories={data.groceryCategories} onSelect={(catId, subCatId) => { handleUpdateManualItem(item.id!, 'categoryId', catId); handleUpdateManualItem(item.id!, 'subCategoryId', subCatId); }} />
                      </div>
                      <input type="number" placeholder="Total Cost" value={item.totalCost} onChange={(e) => handleUpdateManualItem(item.id!, 'totalCost', Number(e.target.value))} className="col-span-3 bg-white border-none rounded-lg text-sm font-black p-2 focus:ring-2 focus:ring-indigo-100 text-right" />
                      <button onClick={() => setManualBillData(prev => ({ ...prev, items: prev.items.filter(it => it.id !== item.id) }))} className="col-span-1 text-slate-300 hover:text-red-500 text-center opacity-0 group-hover:opacity-100">✕</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-8 bg-slate-50 border-t flex justify-between items-center">
              <div><span className="text-[10px] font-black text-slate-400 uppercase block">Calculated Total</span><span className="text-3xl font-black text-slate-900">Rs. {manualBillData.items.reduce((s, i) => s + (Number(i.totalCost) || 0), 0).toLocaleString()}</span></div>
              <div className="flex gap-4"><button onClick={() => setIsManualBillModalOpen(false)} className="px-8 py-4 rounded-2xl font-black text-xs uppercase text-slate-500 hover:bg-slate-100 transition-all">Cancel</button><button onClick={handleSaveManualBill} className="bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase shadow-xl transform active:scale-95">Save Bill</button></div>
            </div>
          </div>
        </div>
      )}

      {showBreakupSubId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[90] flex items-center justify-center p-4">
           <div className="bg-white rounded-[2.5rem] w-full max-w-6xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="p-8 border-b flex justify-between items-center bg-slate-50">
                <div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">Categorized Items Breakdown</h3>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Review and reassign spend for this category</p>
                </div>
                <button onClick={() => setShowBreakupSubId(null)} className="text-slate-400 hover:text-slate-900 text-3xl font-light p-2">✕</button>
              </div>
              <div className="flex-1 overflow-auto p-8">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-100 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Date</th>
                      <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Shop</th>
                      <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Item Description</th>
                      <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Cost (Rs.)</th>
                      <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest w-64">Move To</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.groceryBills.flatMap(bill => 
                      bill.items.filter(it => it.subCategoryId === showBreakupSubId).map(item => (
                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-4 text-xs font-bold text-slate-400">{bill.date}</td>
                          <td className="px-4 py-4 text-sm font-black text-slate-700">{bill.shopName}</td>
                          <td className="px-4 py-4 text-sm font-medium text-slate-600 italic">"{item.description}"</td>
                          <td className="px-4 py-4 text-sm font-black text-indigo-700">Rs. {Number(item.totalCost).toLocaleString()}</td>
                          <td className="px-4 py-4">
                            <SearchableCategoryDropdown 
                              currentValue={`${item.categoryId}|${item.subCategoryId}`}
                              categories={data.groceryCategories}
                              onSelect={(catId, subCatId) => handleCategorizeItem(bill.id, item.id, catId, subCatId)}
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
           </div>
        </div>
      )}

      {showAuditBillId && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95">
            <div className="p-8 border-b flex justify-between items-center bg-slate-50">
              <h3 className="text-2xl font-black text-slate-900">Audit Scanned Bill</h3>
              <button onClick={() => setShowAuditBillId(null)} className="text-slate-400 hover:text-slate-900 text-3xl font-light p-2">✕</button>
            </div>
            <div className="flex-1 overflow-auto p-8 grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div className="space-y-6">
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Attached Screenshots</h4>
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                  {data.groceryBills.find(b => b.id === showAuditBillId)?.imageUrls?.map((url, i) => (
                    <div key={i} className="rounded-2xl border-2 border-slate-100 overflow-hidden shadow-sm bg-slate-100">
                      <img src={url} className="w-full" alt={`Receipt part ${i + 1}`} />
                    </div>
                  ))}
                  {(!data.groceryBills.find(b => b.id === showAuditBillId)?.imageUrls || data.groceryBills.find(b => b.id === showAuditBillId)?.imageUrls?.length === 0) && (
                    <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl h-64 flex flex-col items-center justify-center text-slate-300">
                      <div className="text-5xl mb-2">✍️</div>
                      <p className="font-black text-xs uppercase">Manual Entry (No Photo)</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-4">
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Extracted Items</h4>
                <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                  {data.groceryBills.find(b => b.id === showAuditBillId)?.items.map(item => (
                    <div key={item.id} className="p-3 bg-slate-50 rounded-xl flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-700">{item.description}</span>
                        <span className="text-[10px] font-medium text-slate-400">Qty: {item.quantity} {item.unit} @ Rs. {item.unitCost.toLocaleString()}</span>
                      </div>
                      <span className="text-sm font-black text-indigo-600">Rs. {item.totalCost.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default App;
