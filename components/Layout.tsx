
import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab }) => {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'income', label: 'Income', icon: '💰' },
    { id: 'expenses', label: 'Expenses', icon: '💸' },
    { id: 'onetime', label: 'One-Time', icon: '🗓️' },
    { id: 'groceries', label: 'Groceries', icon: '🛒' },
    { id: 'loans', label: 'Loans', icon: '📜' },
    { id: 'bank', label: 'Bank', icon: '🏦' },
    { id: 'cash', label: 'Cash', icon: '💵' },
    { id: 'savings', label: 'Savings', icon: '🐖' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Sidebar / Nav */}
      <nav className="w-full md:w-64 bg-white border-b md:border-r border-slate-200 p-4 sticky top-0 md:h-screen flex md:flex-col justify-between md:justify-start z-10 overflow-x-auto md:overflow-x-visible">
        <div className="flex items-center gap-2 px-2 mb-8 hidden md:flex">
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white text-xl font-bold">B</div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">BudgetPro</h1>
        </div>

        <div className="flex md:flex-col gap-1 w-full overflow-x-auto md:overflow-x-visible">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
};

export default Layout;
