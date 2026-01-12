
import React, { useState, useEffect, useMemo } from 'react';
import { BudgetData, IncomeSource, ExpenseItem, OneTimePayment } from './types';
import { INITIAL_DATA } from './constants';
import Layout from './components/Layout';
import SummaryCard from './components/SummaryCard';
import { analyzeBudget } from './services/geminiService';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, PieChart, Pie 
} from 'recharts';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [data, setData] = useState<BudgetData>(() => {
    const saved = localStorage.getItem('home_budget_data');
    return saved ? JSON.parse(saved) : INITIAL_DATA;
  });
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    localStorage.setItem('home_budget_data', JSON.stringify(data));
  }, [data]);

  const totals = useMemo(() => {
    const totalIncome = data.income.reduce((sum, item) => sum + item.amount, 0);
    const totalExpenses = data.expenses.reduce((sum, item) => sum + item.amount, 0);
    const salaryExpenses = data.expenses.filter(e => e.sourceType === 'Salary').reduce((sum, e) => sum + e.amount, 0);
    const rentExpenses = data.expenses.filter(e => e.sourceType === 'Rent').reduce((sum, e) => sum + e.amount, 0);
    const totalOneTime = data.oneTimePayments.reduce((sum, item) => sum + item.totalAmount, 0);
    
    const salaryIncome = data.income.find(i => i.name === 'Salary')?.amount || 0;
    const rentIncome = data.income.find(i => i.name === 'Rent Income')?.amount || 0;

    return {
      totalIncome,
      totalExpenses,
      salaryExpenses,
      rentExpenses,
      balance: totalIncome - totalExpenses,
      totalOneTime,
      salaryIncome,
      rentIncome,
      salaryRemaining: salaryIncome - salaryExpenses,
      rentRemaining: rentIncome - rentExpenses,
    };
  }, [data]);

  const handleUpdateIncome = (id: string, amount: number) => {
    setData(prev => ({
      ...prev,
      income: prev.income.map(i => i.id === id ? { ...i, amount } : i)
    }));
  };

  const handleUpdateExpense = (id: string, field: keyof ExpenseItem, value: any) => {
    setData(prev => ({
      ...prev,
      expenses: prev.expenses.map(e => e.id === id ? { ...e, [field]: value } : e)
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

  const handleRemoveExpense = (id: string) => {
    setData(prev => ({ ...prev, expenses: prev.expenses.filter(e => e.id !== id) }));
  };

  const handleUpdateOneTime = (id: string, field: keyof OneTimePayment, value: any) => {
    setData(prev => ({
      ...prev,
      oneTimePayments: prev.oneTimePayments.map(p => p.id === id ? { ...p, [field]: value } : p)
    }));
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
            <SummaryCard title="Total Monthly Income" amount={totals.totalIncome} color="indigo" />
            <SummaryCard title="Monthly Expenses" amount={totals.totalExpenses} color="orange" subtitle={`${((totals.totalExpenses / totals.totalIncome) * 100).toFixed(1)}% of income`} />
            <SummaryCard title="Monthly Net Balance" amount={totals.balance} color={totals.balance >= 0 ? 'green' : 'red'} />
            <SummaryCard title="One-Time Obligations" amount={totals.totalOneTime} color="blue" />
          </div>

          {aiInsight && (
            <div className="bg-white p-6 rounded-3xl border-2 border-indigo-100 shadow-xl relative animate-in zoom-in-95 duration-300">
              <button onClick={() => setAiInsight(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-900 text-xl font-bold p-2">✕</button>
              <h3 className="text-lg font-black text-indigo-900 mb-4 flex items-center gap-2">
                <span className="text-xl">✨</span> AI Financial Assessment
              </h3>
              <div className="prose prose-sm prose-slate max-w-none text-slate-700 whitespace-pre-line font-medium leading-relaxed">
                {aiInsight}
              </div>
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
            {/* Salary Section */}
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

            {/* Rent Section */}
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
                  const progress = item.totalAmount > 0 ? Math.min(100, (item.paidAmount / item.totalAmount) * 100) : 0;
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <SummaryCard title="Total Projected Outlay" amount={totals.totalOneTime} color="blue" />
             <SummaryCard title="Total Funds Allocated" amount={data.oneTimePayments.reduce((s,i) => s + i.paidAmount, 0)} color="green" />
          </div>
        </div>
      )}
    </Layout>
  );
};

export default App;
