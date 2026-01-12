
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
    
    return {
      totalIncome,
      totalExpenses,
      salaryExpenses,
      rentExpenses,
      balance: totalIncome - totalExpenses,
      totalOneTime,
      salaryRemaining: (data.income.find(i => i.name === 'Salary')?.amount || 0) - salaryExpenses,
      rentRemaining: (data.income.find(i => i.name === 'Rent Income')?.amount || 0) - rentExpenses,
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
    { name: 'Salary', Income: data.income.find(i => i.name === 'Salary')?.amount || 0, Expenses: totals.salaryExpenses },
    { name: 'Rent', Income: data.income.find(i => i.name === 'Rent Income')?.amount || 0, Expenses: totals.rentExpenses },
  ];

  const pieData = [
    { name: 'Expenses', value: totals.totalExpenses, fill: '#6366f1' },
    { name: 'Surplus', value: Math.max(0, totals.balance), fill: '#22c55e' },
  ];

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {activeTab === 'dashboard' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex justify-between items-center">
            <h2 className="text-3xl font-extrabold text-slate-800">Overview</h2>
            <button 
              onClick={runAIAnalysis}
              disabled={isAnalyzing}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium shadow-lg shadow-indigo-200 transition-all flex items-center gap-2"
            >
              {isAnalyzing ? 'Analyzing...' : '✨ Get AI Insights'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard title="Total Income" amount={totals.totalIncome} color="indigo" />
            <SummaryCard title="Monthly Expenses" amount={totals.totalExpenses} color="orange" subtitle={`${((totals.totalExpenses / totals.totalIncome) * 100).toFixed(1)}% of income`} />
            <SummaryCard title="Current Surplus" amount={totals.balance} color={totals.balance >= 0 ? 'green' : 'red'} />
            <SummaryCard title="One-Time Obligations" amount={totals.totalOneTime} color="blue" />
          </div>

          {aiInsight && (
            <div className="bg-white p-6 rounded-2xl border border-indigo-100 shadow-sm relative">
              <button onClick={() => setAiInsight(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">✕</button>
              <h3 className="text-lg font-bold text-indigo-800 mb-4 flex items-center gap-2">
                <span>✨ AI Insights</span>
              </h3>
              <div className="prose prose-slate max-w-none text-slate-600 whitespace-pre-line text-sm leading-relaxed">
                {aiInsight}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-lg font-bold text-slate-800 mb-6">Income vs Expenses by Source</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip cursor={{ fill: '#f8fafc' }} />
                    <Legend />
                    <Bar dataKey="Income" fill="#818cf8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Expenses" fill="#f87171" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-lg font-bold text-slate-800 mb-6">Budget Utilization</h3>
              <div className="h-64 flex justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'income' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <h2 className="text-3xl font-extrabold text-slate-800">Monthly Income</h2>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-500 uppercase">Source</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-500 uppercase">Monthly Amount (LKR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.income.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-700">{item.name}</td>
                    <td className="px-6 py-4">
                      <input
                        type="number"
                        value={item.amount}
                        onChange={(e) => handleUpdateIncome(item.id, Number(e.target.value))}
                        className="w-full max-w-[200px] border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-4">
            <SummaryCard title="Total Monthly Income" amount={totals.totalIncome} color="indigo" />
          </div>
        </div>
      )}

      {activeTab === 'expenses' && (
        <div className="space-y-8 animate-in fade-in duration-300">
          <div className="flex justify-between items-center">
            <h2 className="text-3xl font-extrabold text-slate-800">Monthly Expenses</h2>
          </div>

          <div className="grid grid-cols-1 gap-12">
            {/* Salary Section */}
            <div className="space-y-4">
              <div className="flex justify-between items-end border-b pb-2 border-indigo-200">
                <div>
                  <h3 className="text-xl font-bold text-indigo-700">Expenses Paid by Salary</h3>
                  <p className="text-sm text-slate-500">Managed via direct deposit</p>
                </div>
                <div className="text-right">
                  <span className="text-sm text-slate-500 font-medium">Remaining: </span>
                  <span className={`text-lg font-bold ${totals.salaryRemaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    Rs. {totals.salaryRemaining.toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-indigo-50 border-b border-indigo-100">
                    <tr>
                      <th className="px-6 py-3 text-xs font-bold text-indigo-600 uppercase">Category</th>
                      <th className="px-6 py-3 text-xs font-bold text-indigo-600 uppercase">Description</th>
                      <th className="px-6 py-3 text-xs font-bold text-indigo-600 uppercase">Amount (LKR)</th>
                      <th className="px-6 py-3 text-xs font-bold text-indigo-600 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.expenses.filter(e => e.sourceType === 'Salary').map(item => (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-3">
                          <input
                            value={item.category}
                            onChange={(e) => handleUpdateExpense(item.id, 'category', e.target.value)}
                            className="bg-transparent border-none focus:ring-0 w-full text-slate-500 text-sm font-medium italic"
                          />
                        </td>
                        <td className="px-6 py-3">
                          <input
                            value={item.name}
                            onChange={(e) => handleUpdateExpense(item.id, 'name', e.target.value)}
                            className="w-full border-none focus:ring-0 text-slate-800 font-medium"
                          />
                        </td>
                        <td className="px-6 py-3">
                          <input
                            type="number"
                            value={item.amount}
                            onChange={(e) => handleUpdateExpense(item.id, 'amount', Number(e.target.value))}
                            className="w-full border-none focus:ring-0 text-indigo-600 font-semibold"
                          />
                        </td>
                        <td className="px-6 py-3">
                          <button onClick={() => handleRemoveExpense(item.id)} className="text-slate-300 hover:text-red-500 transition-colors">✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button 
                  onClick={() => handleAddExpense('Salary')}
                  className="w-full py-4 text-sm font-medium text-indigo-600 bg-indigo-50/30 hover:bg-indigo-50 transition-colors border-t border-slate-100"
                >
                  + Add Salary-paid Expense
                </button>
              </div>
            </div>

            {/* Rent Section */}
            <div className="space-y-4">
              <div className="flex justify-between items-end border-b pb-2 border-emerald-200">
                <div>
                  <h3 className="text-xl font-bold text-emerald-700">Expenses Paid by Rent</h3>
                  <p className="text-sm text-slate-500">Managed via rent collection</p>
                </div>
                <div className="text-right">
                  <span className="text-sm text-slate-500 font-medium">Remaining: </span>
                  <span className={`text-lg font-bold ${totals.rentRemaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    Rs. {totals.rentRemaining.toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-emerald-50 border-b border-emerald-100">
                    <tr>
                      <th className="px-6 py-3 text-xs font-bold text-emerald-600 uppercase">Category</th>
                      <th className="px-6 py-3 text-xs font-bold text-emerald-600 uppercase">Description</th>
                      <th className="px-6 py-3 text-xs font-bold text-emerald-600 uppercase">Amount (LKR)</th>
                      <th className="px-6 py-3 text-xs font-bold text-emerald-600 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.expenses.filter(e => e.sourceType === 'Rent').map(item => (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-3">
                          <input
                            value={item.category}
                            onChange={(e) => handleUpdateExpense(item.id, 'category', e.target.value)}
                            className="bg-transparent border-none focus:ring-0 w-full text-slate-500 text-sm font-medium italic"
                          />
                        </td>
                        <td className="px-6 py-3">
                          <input
                            value={item.name}
                            onChange={(e) => handleUpdateExpense(item.id, 'name', e.target.value)}
                            className="w-full border-none focus:ring-0 text-slate-800 font-medium"
                          />
                        </td>
                        <td className="px-6 py-3">
                          <input
                            type="number"
                            value={item.amount}
                            onChange={(e) => handleUpdateExpense(item.id, 'amount', Number(e.target.value))}
                            className="w-full border-none focus:ring-0 text-emerald-600 font-semibold"
                          />
                        </td>
                        <td className="px-6 py-3">
                          <button onClick={() => handleRemoveExpense(item.id)} className="text-slate-300 hover:text-red-500 transition-colors">✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button 
                  onClick={() => handleAddExpense('Rent')}
                  className="w-full py-4 text-sm font-medium text-emerald-600 bg-emerald-50/30 hover:bg-emerald-50 transition-colors border-t border-slate-100"
                >
                  + Add Rent-paid Expense
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'onetime' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="flex justify-between items-center">
            <h2 className="text-3xl font-extrabold text-slate-800">One-Time Payments</h2>
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
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              + Add Item
            </button>
          </div>
          
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Payment Goal</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Target Amount</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Allocated/Paid</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Due Date</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.oneTimePayments.map(item => {
                  const progress = item.totalAmount > 0 ? Math.min(100, (item.paidAmount / item.totalAmount) * 100) : 0;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-all group">
                      <td className="px-6 py-4">
                        <input
                          value={item.title}
                          onChange={(e) => handleUpdateOneTime(item.id, 'title', e.target.value)}
                          className="w-full border-none focus:ring-0 font-medium text-slate-700"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="number"
                          value={item.totalAmount}
                          onChange={(e) => handleUpdateOneTime(item.id, 'totalAmount', Number(e.target.value))}
                          className="w-full border border-slate-200 rounded-lg px-2 py-1 text-sm focus:ring-1 focus:ring-blue-400 outline-none"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="number"
                          value={item.paidAmount}
                          onChange={(e) => handleUpdateOneTime(item.id, 'paidAmount', Number(e.target.value))}
                          className="w-full border border-slate-200 rounded-lg px-2 py-1 text-sm focus:ring-1 focus:ring-green-400 outline-none"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="date"
                          value={item.dueDate}
                          onChange={(e) => handleUpdateOneTime(item.id, 'dueDate', e.target.value)}
                          className="w-full border border-slate-200 rounded-lg px-2 py-1 text-sm focus:ring-1 focus:ring-blue-400 outline-none"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="w-full bg-slate-100 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-500" 
                            style={{ width: `${progress}%` }}
                          ></div>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 mt-1 block uppercase">
                          {progress.toFixed(0)}% Funded
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <SummaryCard title="Total Projected" amount={totals.totalOneTime} color="blue" />
             <SummaryCard title="Total Allocated" amount={data.oneTimePayments.reduce((s,i) => s + i.paidAmount, 0)} color="green" />
          </div>
        </div>
      )}
    </Layout>
  );
};

export default App;
