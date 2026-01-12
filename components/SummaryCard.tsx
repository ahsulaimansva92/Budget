
import React from 'react';

interface SummaryCardProps {
  title: string;
  amount: number;
  color: 'blue' | 'green' | 'red' | 'indigo' | 'orange';
  subtitle?: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ title, amount, color, subtitle }) => {
  const colors = {
    blue: 'border-blue-600 text-blue-700 bg-blue-50',
    green: 'border-green-600 text-green-700 bg-green-50',
    red: 'border-red-600 text-red-700 bg-red-50',
    indigo: 'border-indigo-600 text-indigo-700 bg-indigo-50',
    orange: 'border-orange-600 text-orange-700 bg-orange-50',
  };

  return (
    <div className={`p-6 rounded-2xl border-l-4 shadow-md bg-white ${colors[color].split(' ')[0]}`}>
      <h3 className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-1">{title}</h3>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-extrabold text-slate-900 leading-tight">
          {amount.toLocaleString('en-US', { style: 'currency', currency: 'LKR', minimumFractionDigits: 0 }).replace('LKR', 'Rs.')}
        </span>
      </div>
      {subtitle && <p className="mt-2 text-sm text-slate-500 font-semibold">{subtitle}</p>}
    </div>
  );
};

export default SummaryCard;
