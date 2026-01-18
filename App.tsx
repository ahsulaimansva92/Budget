
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  BudgetData, IncomeSource, ExpenseItem, OneTimePayment, SavingsEntry, SavingsWithdrawal, 
  CashEntry, GroceryCategory, GrocerySubCategory, GroceryBill, GroceryBillItem 
} from './types';
import { INITIAL_DATA } from './constants';
import Layout from './components/Layout';
import SummaryCard from './components/SummaryCard';
import { analyzeBudget, processGroceryBill } from './services/geminiService';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, PieChart, Pie 
} from 'recharts';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [data, setData] = useState<BudgetData>(() => {
    const saved = localStorage.getItem('home_budget_data');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Ensure all keys exist for backward compatibility
      if (!parsed.savings) parsed.savings = INITIAL_DATA.savings;
      if (!parsed.cash) parsed.cash = INITIAL_DATA.cash;
      if (!parsed.groceryCategories) parsed.groceryCategories = INITIAL_DATA.groceryCategories;
      if (!parsed.groceryBills) parsed.groceryBills = INITIAL_DATA.groceryBills;
      return parsed;
    }
    return INITIAL_DATA;
  });

  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [showAuditBillId, setShowAuditBillId] = useState<string | null>(null);
  const [showBreakupSubId, setShowBreakupSubId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('home_budget_data', JSON.stringify(data));
  }, [data]);

  const totals = useMemo(() => {
    // Explicitly casting all amounts to Number to avoid arithmetic errors
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

    return {
      totalIncome,
      totalExpenses,
      balance: totalIncome - totalExpenses,
      savingsBalance,
      totalSavingsAdditions,
      totalSavingsWithdrawals,
      cashBalance: closingCashBalance,
      totalCashIncome,
      totalCashExpenses,
      totalGrocerySpend,
      salaryIncome,
      rentIncome,
      salaryExpenses,
      rentExpenses,
      salaryRemaining: salaryIncome - salaryExpenses,
      rentRemaining: rentIncome - rentExpenses,
      totalOneTime
    };
  }, [data]);

  // Grocery Analytics
  const groceryStats = useMemo(() => {
    const stats: Record<string, { totalAmount: number; totalQuantity: number; avgUnitCost: number; itemCount: number }> = {};
    
    data.groceryBills.forEach(bill => {
      bill.items.forEach(item => {
        if (!stats[item.subCategoryId]) {
          stats[item.subCategoryId] = { totalAmount: 0, totalQuantity: 0, avgUnitCost: 0, itemCount: 0 };
        }
        // Ensuring numeric types for arithmetic safety
        stats[item.subCategoryId].totalAmount += Number(item.totalCost);
        stats[item.subCategoryId].totalQuantity += Number(item.quantity);
        stats[item.subCategoryId].itemCount += 1;
        stats[item.subCategoryId].avgUnitCost = stats[item.subCategoryId].totalAmount / (stats[item.subCategoryId].totalQuantity || 1);
      });
    });

    return stats;
  }, [data.groceryBills]);

  const categoryTotals = useMemo(() => {
    const catTotals: Record<string, number> = {};
    data.groceryBills.forEach(bill => {
      bill.items.forEach(item => {
        catTotals[item.categoryId] = (catTotals[item.categoryId] || 0) + Number(item.totalCost);
      });
    });
    return catTotals;
  }, [data.groceryBills]);

  const totalCategorizedSpend = useMemo(() => {
    return Object.values(categoryTotals).reduce((sum: number, val: number) => sum + Number(val), 0);
  }, [categoryTotals]);

  // Fixed the error: "The left-hand side of an arithmetic operation must be of type 'any', 'number', 'bigint' or an enum type"
  // by ensuring all operands in the division are recognized as numbers through explicit casting and typing.
  const globalItemAverage = useMemo<number>(() => {
    const statsArray = Object.values(groceryStats);
    const count = Number(statsArray.length);
    if (count === 0) return 0;
    const totalAvgSum = statsArray.reduce((sum: number, s: { avgUnitCost: number }) => sum + Number(s.avgUnitCost || 0), 0);
    return totalAvgSum / count;
  }, [groceryStats]);

  // Specific Sub-category Items for breakup
  const breakupItems = useMemo(() => {
    if (!showBreakupSubId) return [];
    return data.groceryBills.flatMap(bill => 
      bill.items
        .filter(item => item.subCategoryId === showBreakupSubId)
        .map(item => ({ ...item, billDate: bill.date, billShop: bill.shopName }))
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

  // Handlers for Income, Expenses, One-Time
  const handleUpdateIncome = (id: string, amount: number) => {
    setData(prev => ({
      ...prev,
      income: prev.income.map(i => i.id === id ? { ...i, amount: Number(amount) } : i)
    }));
  };

  const handleUpdateExpense = (id: string, field: keyof ExpenseItem, value: any) => {
    setData(prev => ({
      ...prev,
      expenses: prev.expenses.map(e => e.id === id ? { ...e, [field]: (field === 'amount' ? Number(value) : value) } : e)
    }));
  };

  const handleAddExpense = (sourceType: 'Salary' | 'Rent') => {
    const newExp: ExpenseItem = {
      id: `exp-${Date.now()}`,
      name: 'New Expense',
      amount: 0,
      category: 'General',
      sourceType
    };
    setData(prev => ({ ...prev, expenses: [...prev.expenses, newExp] }));
  };

  const handleUpdateOneTime = (id: string, field: keyof OneTimePayment, value: any) => {
    setData(prev => ({
      ...prev,
      oneTimePayments: prev.oneTimePayments.map(p => p.id === id ? { ...p, [field]: (['totalAmount', 'paidAmount'].includes(field) ? Number(value) : value) } : p)
    }));
  };

  // Cash Handlers
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
    setData(prev => ({
      ...prev,
      cash: { ...prev.cash, [type]: prev.cash[type].filter(item => item.id !== id) }
    }));
  };

  // Savings Handlers
  const handleUpdateSavingsOpening = (amount: number) => {
    setData(prev => ({
      ...prev,
      savings: { ...prev.savings, openingBalance: Number(amount) }
    }));
  };

  const handleAddSavingsAddition = () => {
    const newEntry: SavingsEntry = {
      id: `sav-add-${Date.now()}`,
      amount: 0,
      date: new Date().toISOString().split('T')[0]
    };
    setData(prev => ({
      ...prev,
      savings: { ...prev.savings, additions: [...prev.savings.additions, newEntry] }
    }));
  };

  const handleUpdateSavingsAddition = (id: string, field: keyof SavingsEntry, value: any) => {
    setData(prev => ({
      ...prev,
      savings: {
        ...prev.savings,
        additions: prev.savings.additions.map(a => a.id === id ? { ...a, [field]: (field === 'amount' ? Number(value) : value) } : a)
      }
    }));
  };

  const handleRemoveSavingsAddition = (id: string) => {
    setData(prev => ({
      ...prev,
      savings: { ...prev.savings, additions: prev.savings.additions.filter(a => a.id !== id) }
    }));
  };

  const handleAddSavingsWithdrawal = () => {
    const newWithdrawal: SavingsWithdrawal = {
      id: `sav-wd-${Date.now()}`,
      amount: 0,
      date: new Date().toISOString().split('T')[0],
      reason: 'General'
    };
    setData(prev => ({
      ...prev,
      savings: { ...prev.savings, withdrawals: [...prev.savings.withdrawals, newWithdrawal] }
    }));
  };

  const handleUpdateSavingsWithdrawal = (id: string, field: keyof SavingsWithdrawal, value: any) => {
    setData(prev => ({
      ...prev,
      savings: {
        ...prev.savings,
        withdrawals: prev.savings.withdrawals.map(w => w.id === id ? { ...w, [field]: (field === 'amount' ? Number(value) : value) } : w)
      }
    }));
  };

  const handleRemoveSavingsWithdrawal = (id: string) => {
    setData(prev => ({
      ...prev,
      savings: { ...prev.savings, withdrawals: prev.savings.withdrawals.filter(w => w.id !== id) }
    }));
  };

  // Grocery Handlers
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsOcrLoading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      try {
        const result = await processGroceryBill(base64, data.groceryCategories);
        
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
              categoryId: cat?.id || data.groceryCategories[0].id,
              subCategoryId: sub?.id || (cat?.subCategories[0].id || 'misc')
            };
          })
        };

        setData(prev => ({ ...prev, groceryBills: [newBill, ...prev.groceryBills] }));
      } catch (err) {
        alert("Failed to process bill image. Please try again.");
      } finally {
        setIsOcrLoading(false);
      }
    };
    reader.readAsDataURL(file);
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <SummaryCard title="Total Income" amount={totals.totalIncome} color="indigo" />
            <SummaryCard title="Total Expenses" amount={totals.totalExpenses} color="orange" subtitle="Incl. Groceries" />
            <SummaryCard title="Cash Balance" amount={totals.cashBalance} color="green" />
            <SummaryCard title="Monthly Balance" amount={totals.balance} color={totals.balance >= 0 ? 'blue' : 'red'} />
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
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">Revenue Source</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">Monthly Amount (LKR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.income.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-semibold text-base text-slate-800">{item.name}</td>
                    <td className="px-6 py-4">
                      <div className="relative max-w-xs">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">Rs.</span>
                        <input
                          type="number"
                          value={item.amount}
                          onChange={(e) => handleUpdateIncome(item.id, Number(e.target.value))}
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
            {/* Salary Expenses */}
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
                  <div className="border-t border-indigo-100 pt-1">
                    <span className="text-[9px] text-indigo-600 font-bold uppercase tracking-wider block">Unallocated</span>
                    <span className={`text-lg font-black ${totals.salaryRemaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      Rs. {totals.salaryRemaining.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-indigo-600">
                    <tr>
                      <th className="px-6 py-3 text-[10px] font-black text-white uppercase tracking-widest w-1/4">Category</th>
                      <th className="px-6 py-3 text-[10px] font-black text-white uppercase tracking-widest">Description</th>
                      <th className="px-6 py-3 text-[10px] font-black text-white uppercase tracking-widest w-1/4">Amount (Rs.)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.expenses.filter(e => e.sourceType === 'Salary').map(item => (
                      <tr key={item.id} className="hover:bg-indigo-50/30 transition-colors">
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
                <button 
                  onClick={() => handleAddExpense('Salary')}
                  className="w-full py-3.5 text-xs font-black text-indigo-600 bg-indigo-50/50 hover:bg-indigo-100 transition-all border-t border-indigo-100 flex items-center justify-center gap-1.5"
                >
                  <span className="text-lg">+</span> ADD SALARY EXPENSE
                </button>
              </div>
            </div>
            {/* Rent Expenses */}
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b-2 pb-3 border-emerald-500">
                <div>
                  <h3 className="text-xl font-black text-emerald-800">2. Expenses via Rent Income</h3>
                  <p className="text-sm text-slate-500 font-medium">Specific allocations and maintenance funds</p>
                </div>
                <div className="text-right mt-3 md:mt-0 bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100 flex flex-col gap-1 shadow-sm">
                  <div>
                    <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider block">Total Rent Income</span>
                    <span className="text-sm font-bold text-slate-700">Rs. {totals.rentIncome.toLocaleString()}</span>
                  </div>
                  <div className="border-t border-emerald-100 pt-1">
                    <span className="text-[9px] text-emerald-600 font-bold uppercase tracking-wider block">Unallocated</span>
                    <span className={`text-lg font-black ${totals.rentRemaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      Rs. {totals.rentRemaining.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-emerald-600">
                    <tr>
                      <th className="px-6 py-3 text-[10px] font-black text-white uppercase tracking-widest w-1/4">Category</th>
                      <th className="px-6 py-3 text-[10px] font-black text-white uppercase tracking-widest">Description</th>
                      <th className="px-6 py-3 text-[10px] font-black text-white uppercase tracking-widest w-1/4">Amount (Rs.)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.expenses.filter(e => e.sourceType === 'Rent').map(item => (
                      <tr key={item.id} className="hover:bg-emerald-50/30 transition-colors">
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
                            className="w-full border-none focus:ring-0 text-emerald-700 font-bold text-sm"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button 
                  onClick={() => handleAddExpense('Rent')}
                  className="w-full py-3.5 text-xs font-black text-emerald-600 bg-emerald-50/50 hover:bg-emerald-100 transition-all border-t border-emerald-100 flex items-center justify-center gap-1.5"
                >
                  <span className="text-lg">+</span> ADD RENT EXPENSE
                </button>
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
                const newItem: OneTimePayment = {
                  id: `otp-${Date.now()}`,
                  title: 'New Requirement',
                  totalAmount: 0,
                  paidAmount: 0,
                  dueDate: ''
                };
                setData(prev => ({ ...prev, oneTimePayments: [...prev.oneTimePayments, newItem] }));
              }}
              className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold text-xs hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all transform hover:scale-105"
            >
              + ADD NEW PAYMENT
            </button>
          </div>
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-900">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-black text-white uppercase tracking-widest border-b border-slate-800">Payment Goal</th>
                  <th className="px-6 py-4 text-[10px] font-black text-white uppercase tracking-widest border-b border-slate-800">Target (Rs.)</th>
                  <th className="px-6 py-4 text-[10px] font-black text-white uppercase tracking-widest border-b border-slate-800">Paid (Rs.)</th>
                  <th className="px-6 py-4 text-[10px] font-black text-white uppercase tracking-widest border-b border-slate-800 w-32">Due Date</th>
                  <th className="px-6 py-4 text-[10px] font-black text-white uppercase tracking-widest border-b border-slate-800">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.oneTimePayments.map(item => {
                  const progress = Number(item.totalAmount) > 0 ? Math.min(100, (Number(item.paidAmount) / Number(item.totalAmount)) * 100) : 0;
                  return (
                    <tr key={item.id} className="hover:bg-blue-50/20 transition-all group">
                      <td className="px-6 py-4">
                        <input
                          value={item.title}
                          onChange={(e) => handleUpdateOneTime(item.id, 'title', e.target.value)}
                          className="w-full border-none focus:ring-0 font-bold text-sm text-slate-900 bg-transparent"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="number"
                          value={item.totalAmount}
                          onChange={(e) => handleUpdateOneTime(item.id, 'totalAmount', Number(e.target.value))}
                          className="w-full border border-slate-100 rounded-lg px-3 py-1.5 font-bold text-sm text-slate-700 focus:ring-2 focus:ring-blue-50 focus:border-blue-500 outline-none transition-all"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="number"
                          value={item.paidAmount}
                          onChange={(e) => handleUpdateOneTime(item.id, 'paidAmount', Number(e.target.value))}
                          className="w-full border border-slate-100 rounded-lg px-3 py-1.5 font-bold text-sm text-green-700 focus:ring-2 focus:ring-green-50 focus:border-green-500 outline-none transition-all"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="date"
                          value={item.dueDate}
                          onChange={(e) => handleUpdateOneTime(item.id, 'dueDate', e.target.value)}
                          className="w-full border border-slate-100 rounded-lg px-2 py-1.5 font-semibold text-xs text-slate-600 focus:ring-2 focus:ring-blue-50 focus:border-blue-500 outline-none transition-all"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden shadow-inner">
                            <div 
                              className={`h-2.5 rounded-full transition-all duration-1000 ease-out ${progress === 100 ? 'bg-green-500' : 'bg-blue-600'}`} 
                              style={{ width: `${progress}%` }}
                            ></div>
                          </div>
                          <span className="text-[10px] font-black text-slate-900 min-w-[30px]">
                            {progress.toFixed(0)}%
                          </span>
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

      {activeTab === 'groceries' && (
        <div className="space-y-10 animate-in fade-in duration-300 pb-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Grocery Tracker</h2>
            <div className="flex gap-3">
               <input 
                type="file" 
                accept="image/*,application/pdf" 
                capture="environment"
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
                   <><span className="animate-spin text-xl">🌀</span> Scanning Bill...</>
                 ) : (
                   <><span className="text-xl">📷</span> Capture Bill (AI OCR)</>
                 )}
               </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <SummaryCard title="Total Bills Value" amount={totals.totalGrocerySpend} color="blue" />
            <SummaryCard 
              title="Total Categorized" 
              amount={totalCategorizedSpend} 
              color={totals.totalGrocerySpend === totalCategorizedSpend ? "indigo" : "red"} 
              subtitle={totals.totalGrocerySpend === totalCategorizedSpend ? "Verification Successful ✅" : `Mismatch: Rs. ${(totals.totalGrocerySpend - totalCategorizedSpend).toLocaleString()} ❌`} 
            />
            <SummaryCard 
              title="Global Item Average" 
              amount={globalItemAverage} 
              color="green" 
            />
          </div>

          {showBreakupSubId && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
               <div className="bg-white rounded-[2.5rem] w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
                  <div className="p-8 border-b flex justify-between items-center bg-slate-50">
                    <div>
                      <h3 className="text-2xl font-black text-slate-900 tracking-tight">{selectedSubCategoryName}</h3>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Detailed Item Breakdown</p>
                    </div>
                    <button onClick={() => setShowBreakupSubId(null)} className="text-slate-400 hover:text-slate-900 text-3xl font-light p-2">✕</button>
                  </div>
                  <div className="flex-1 overflow-auto p-8">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-100 sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Date</th>
                          <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Shop</th>
                          <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Item Description</th>
                          <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Qty</th>
                          <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Cost (Rs.)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {breakupItems.map(item => (
                          <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-4 text-xs font-bold text-slate-400 whitespace-nowrap">{item.billDate}</td>
                            <td className="px-4 py-4 text-sm font-black text-slate-700 whitespace-nowrap">{item.billShop}</td>
                            <td className="px-4 py-4 text-sm font-medium text-slate-600 italic">"{item.description}"</td>
                            <td className="px-4 py-4 text-sm font-bold text-slate-500">{item.quantity} {item.unit}</td>
                            <td className="px-4 py-4 text-sm font-black text-indigo-700">Rs. {Number(item.totalCost).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-indigo-50 font-black text-indigo-900 sticky bottom-0">
                        <tr>
                          <td colSpan={4} className="px-4 py-4 text-right uppercase text-[10px] tracking-widest">Total Spend</td>
                          <td className="px-4 py-4 text-lg">Rs. {breakupItems.reduce((s, i) => s + Number(i.totalCost), 0).toLocaleString()}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
               </div>
            </div>
          )}

          {showAuditBillId && (
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                  <h3 className="text-xl font-black text-slate-900">Bill Source Audit Trail</h3>
                  <button onClick={() => setShowAuditBillId(null)} className="text-slate-400 hover:text-slate-900 text-2xl font-bold p-2">✕</button>
                </div>
                <div className="flex-1 overflow-auto p-6">
                   <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <div>
                        <h4 className="text-xs font-black text-slate-400 uppercase mb-4 tracking-widest">Original Bill Image</h4>
                        <img src={data.groceryBills.find(b => b.id === showAuditBillId)?.imageUrl} className="rounded-xl border shadow-sm w-full" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-400 uppercase mb-4 tracking-widest">Extracted Data</h4>
                        <table className="w-full text-left text-sm border-collapse">
                          <thead className="bg-slate-100">
                            <tr>
                              <th className="px-3 py-2 border-b">Raw Description</th>
                              <th className="px-3 py-2 border-b">Qty</th>
                              <th className="px-3 py-2 border-b">Cost</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.groceryBills.find(b => b.id === showAuditBillId)?.items.map(item => (
                              <tr key={item.id}>
                                <td className="px-3 py-2 border-b font-medium">{item.rawDescription}</td>
                                <td className="px-3 py-2 border-b">{item.quantity} {item.unit}</td>
                                <td className="px-3 py-2 border-b font-bold">Rs. {Number(item.totalCost)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                   </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-8">
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

          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
             <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                <h3 className="text-xl font-bold">Category Configuration</h3>
                <button 
                  onClick={() => {
                    const newCat: GroceryCategory = { id: `g-cat-${Date.now()}`, name: 'New Category', subCategories: [] };
                    setData(prev => ({ ...prev, groceryCategories: [...prev.groceryCategories, newCat] }));
                  }}
                  className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest"
                >
                  + Add Category
                </button>
             </div>
             <div className="p-6 divide-y space-y-8">
                {data.groceryCategories.map((cat, catIdx) => (
                  <div key={cat.id} className="pt-8 first:pt-0">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="flex flex-col gap-1">
                        <button onClick={() => moveCategory(catIdx, 'up')} className="text-slate-400 hover:text-indigo-600">▲</button>
                        <button onClick={() => moveCategory(catIdx, 'down')} className="text-slate-400 hover:text-indigo-600">▼</button>
                      </div>
                      <input 
                        value={cat.name} 
                        onChange={(e) => {
                          const newCats = [...data.groceryCategories];
                          newCats[catIdx].name = e.target.value;
                          setData(prev => ({ ...prev, groceryCategories: newCats }));
                        }}
                        className="text-xl font-black text-slate-900 border-none focus:ring-0 bg-transparent p-0 w-full" 
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 ml-12">
                      {cat.subCategories.map((sub, subIdx) => (
                        <div key={sub.id} className="group flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100 transition-all hover:bg-white hover:shadow-sm">
                           <div className="flex flex-col text-[10px] text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => moveSubCategory(catIdx, subIdx, 'up')}>▲</button>
                              <button onClick={() => moveSubCategory(catIdx, subIdx, 'down')}>▼</button>
                           </div>
                           <input 
                            value={sub.name}
                            onChange={(e) => {
                              const newCats = [...data.groceryCategories];
                              newCats[catIdx].subCategories[subIdx].name = e.target.value;
                              setData(prev => ({ ...prev, groceryCategories: newCats }));
                            }}
                            className="bg-transparent border-none focus:ring-0 text-sm font-semibold text-slate-600 w-full"
                           />
                           <button 
                             onClick={() => {
                               const newCats = [...data.groceryCategories];
                               newCats[catIdx].subCategories = newCats[catIdx].subCategories.filter(s => s.id !== sub.id);
                               setData(prev => ({ ...prev, groceryCategories: newCats }));
                             }}
                             className="text-slate-300 hover:text-red-500 text-xs"
                           >✕</button>
                        </div>
                      ))}
                      <button 
                        onClick={() => {
                          const newCats = [...data.groceryCategories];
                          const newSub: GrocerySubCategory = { id: `g-sub-${Date.now()}`, name: 'New Item' };
                          newCats[catIdx].subCategories.push(newSub);
                          setData(prev => ({ ...prev, groceryCategories: newCats }));
                        }}
                        className="text-xs font-black text-indigo-500 border border-dashed border-indigo-200 rounded-xl px-4 py-2 hover:bg-indigo-50"
                      >
                        + Add Subcategory
                      </button>
                    </div>
                  </div>
                ))}
             </div>
          </div>

          <div className="space-y-4">
             <h3 className="text-xl font-black text-slate-900">Recent Grocery Bills</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {data.groceryBills.map(bill => (
                  <div key={bill.id} className="bg-white rounded-3xl shadow-lg border border-slate-100 overflow-hidden group">
                     <div className="relative h-32 bg-slate-100">
                        {bill.imageUrl ? (
                          <img src={bill.imageUrl} className="w-full h-full object-cover opacity-60 grayscale group-hover:grayscale-0 transition-all duration-500" />
                        ) : (
                          <div className="flex items-center justify-center h-full text-slate-300 font-bold">No Image</div>
                        )}
                        <div className="absolute inset-0 p-4 flex flex-col justify-end bg-gradient-to-t from-black/50 to-transparent">
                          <h4 className="text-white font-black">{bill.shopName}</h4>
                          <p className="text-white/80 text-xs font-bold">{bill.date}</p>
                        </div>
                     </div>
                     <div className="p-4 flex justify-between items-center">
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Total Spent</p>
                          <p className="text-lg font-black text-indigo-700">Rs. {Number(bill.totalAmount).toLocaleString()}</p>
                        </div>
                        <button 
                          onClick={() => setShowAuditBillId(bill.id)}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest"
                        >
                          View Source (Audit)
                        </button>
                     </div>
                  </div>
                ))}
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
          <div className="grid grid-cols-1 gap-12">
            {/* Cash Income */}
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-emerald-700 border-b-2 pb-2 border-emerald-200">Cash Income</h3>
              <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-emerald-500">
                    <tr>
                      <th className="px-6 py-3 text-[10px] font-black text-white uppercase tracking-widest">Date</th>
                      <th className="px-6 py-3 text-[10px] font-black text-white uppercase tracking-widest">Description</th>
                      <th className="px-6 py-3 text-[10px] font-black text-white uppercase tracking-widest">Amount (Rs.)</th>
                      <th className="px-6 py-3 text-center w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.cash.income.map(item => (
                      <tr key={item.id} className="hover:bg-emerald-50/20">
                        <td className="px-6 py-2">
                          <input type="date" value={item.date} onChange={(e) => handleUpdateCashItem('income', item.id, 'date', e.target.value)} className="bg-transparent border-none focus:ring-0 font-bold text-slate-700 text-sm" />
                        </td>
                        <td className="px-6 py-2">
                          <input value={item.description} onChange={(e) => handleUpdateCashItem('income', item.id, 'description', e.target.value)} className="bg-transparent border-none focus:ring-0 font-bold text-slate-800 text-sm w-full" />
                        </td>
                        <td className="px-6 py-2">
                          <input type="number" value={item.amount} onChange={(e) => handleUpdateCashItem('income', item.id, 'amount', Number(e.target.value))} className="bg-transparent border-none focus:ring-0 font-black text-emerald-700 text-base" />
                        </td>
                        <td className="px-6 py-2 text-center">
                          <button onClick={() => handleRemoveCashItem('income', item.id)} className="text-slate-300 hover:text-red-500">✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button onClick={() => handleAddCashItem('income')} className="w-full py-3 text-xs font-black text-emerald-600 bg-emerald-50/50 hover:bg-emerald-100">+ Add Cash Income</button>
              </div>
            </div>
            {/* Cash Expenses */}
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-orange-700 border-b-2 pb-2 border-orange-200">Cash Expenses</h3>
              <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-orange-500">
                    <tr>
                      <th className="px-6 py-3 text-[10px] font-black text-white uppercase tracking-widest">Date</th>
                      <th className="px-6 py-3 text-[10px] font-black text-white uppercase tracking-widest">Description</th>
                      <th className="px-6 py-3 text-[10px] font-black text-white uppercase tracking-widest">Amount (Rs.)</th>
                      <th className="px-6 py-3 text-center w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.cash.expenses.map(item => (
                      <tr key={item.id} className="hover:bg-orange-50/20">
                        <td className="px-6 py-2">
                          <input type="date" value={item.date} onChange={(e) => handleUpdateCashItem('expenses', item.id, 'date', e.target.value)} className="bg-transparent border-none focus:ring-0 font-bold text-slate-700 text-sm" />
                        </td>
                        <td className="px-6 py-2">
                          <input value={item.description} onChange={(e) => handleUpdateCashItem('expenses', item.id, 'description', e.target.value)} className="bg-transparent border-none focus:ring-0 font-bold text-slate-800 text-sm w-full" />
                        </td>
                        <td className="px-6 py-2">
                          <input type="number" value={item.amount} onChange={(e) => handleUpdateCashItem('expenses', item.id, 'amount', Number(e.target.value))} className="bg-transparent border-none focus:ring-0 font-black text-orange-700 text-base" />
                        </td>
                        <td className="px-6 py-2 text-center">
                          <button onClick={() => handleRemoveCashItem('expenses', item.id)} className="text-slate-300 hover:text-red-500">✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button onClick={() => handleAddCashItem('expenses')} className="w-full py-3 text-xs font-black text-orange-600 bg-orange-50/50 hover:bg-orange-100">+ Add Cash Expense</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'savings' && (
        <div className="space-y-8 animate-in fade-in duration-300">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Savings Management</h2>
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-6 py-3 flex items-center gap-6 shadow-sm">
              <div className="flex flex-col">
                <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">Opening Balance</span>
                <div className="relative mt-1">
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">Rs.</span>
                  <input
                    type="number"
                    value={data.savings.openingBalance}
                    onChange={(e) => handleUpdateSavingsOpening(Number(e.target.value))}
                    className="pl-6 pr-2 py-1 bg-transparent border-none focus:ring-0 font-black text-lg text-slate-900 w-32 outline-none"
                  />
                </div>
              </div>
              <div className="w-[1px] h-10 bg-indigo-200"></div>
              <div className="flex flex-col">
                <span className="text-[10px] text-indigo-600 font-bold uppercase tracking-widest">Current Balance</span>
                <span className="text-xl font-black text-indigo-800 mt-1">
                  Rs. {totals.savingsBalance.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-12">
            {/* Savings Additions */}
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-indigo-700 border-b-2 pb-2 border-indigo-200">Additions (Deposits)</h3>
              <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-indigo-500">
                    <tr>
                      <th className="px-6 py-3 text-[10px] font-black text-white uppercase tracking-widest">Date</th>
                      <th className="px-6 py-3 text-[10px] font-black text-white uppercase tracking-widest">Amount (Rs.)</th>
                      <th className="px-6 py-3 text-center w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.savings.additions.map(item => (
                      <tr key={item.id} className="hover:bg-indigo-50/20">
                        <td className="px-6 py-2">
                          <input type="date" value={item.date} onChange={(e) => handleUpdateSavingsAddition(item.id, 'date', e.target.value)} className="bg-transparent border-none focus:ring-0 font-bold text-slate-700 text-sm" />
                        </td>
                        <td className="px-6 py-2">
                          <input type="number" value={item.amount} onChange={(e) => handleUpdateSavingsAddition(item.id, 'amount', Number(item.amount))} className="bg-transparent border-none focus:ring-0 font-black text-indigo-700 text-base" />
                        </td>
                        <td className="px-6 py-2 text-center">
                          <button onClick={() => handleRemoveSavingsAddition(item.id)} className="text-slate-300 hover:text-red-500">✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button onClick={handleAddSavingsAddition} className="w-full py-3 text-xs font-black text-indigo-600 bg-indigo-50/50 hover:bg-indigo-100">+ Add Deposit</button>
              </div>
            </div>
            {/* Savings Withdrawals */}
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-orange-700 border-b-2 pb-2 border-orange-200">Withdrawals</h3>
              <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-orange-500">
                    <tr>
                      <th className="px-6 py-3 text-[10px] font-black text-white uppercase tracking-widest">Date</th>
                      <th className="px-6 py-3 text-[10px] font-black text-white uppercase tracking-widest">Reason</th>
                      <th className="px-6 py-3 text-[10px] font-black text-white uppercase tracking-widest">Amount (Rs.)</th>
                      <th className="px-6 py-3 text-center w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.savings.withdrawals.map(item => (
                      <tr key={item.id} className="hover:bg-orange-50/20">
                        <td className="px-6 py-2">
                          <input type="date" value={item.date} onChange={(e) => handleUpdateSavingsWithdrawal(item.id, 'date', e.target.value)} className="bg-transparent border-none focus:ring-0 font-bold text-slate-700 text-sm" />
                        </td>
                        <td className="px-6 py-2">
                          <input value={item.reason} onChange={(e) => handleUpdateSavingsWithdrawal(item.id, 'reason', e.target.value)} className="bg-transparent border-none focus:ring-0 font-bold text-slate-800 text-sm w-full" />
                        </td>
                        <td className="px-6 py-2">
                          <input type="number" value={item.amount} onChange={(e) => handleUpdateSavingsWithdrawal(item.id, 'amount', Number(item.amount))} className="bg-transparent border-none focus:ring-0 font-black text-orange-700 text-base" />
                        </td>
                        <td className="px-6 py-2 text-center">
                          <button onClick={() => handleRemoveSavingsWithdrawal(item.id)} className="text-slate-300 hover:text-red-500">✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button onClick={handleAddSavingsWithdrawal} className="w-full py-3 text-xs font-black text-orange-600 bg-orange-50/50 hover:bg-orange-100">+ Add Withdrawal</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default App;
