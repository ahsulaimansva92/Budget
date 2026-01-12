
import React from 'react';

interface SummaryCardProps {
  title: string;
  amount: number;
  color: 'blue' | 'green' | 'red' | 'indigo' | 'orange';
  subtitle?: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ title, amount, color, subtitle }) => {
  const colors = {
    blue: 'border-blue-500 text-blue-600 bg-blue-50',
    green: 'border-green-500 text-green-600 bg-green-50',
    red: 'border-red-500 text-red-600 bg-red-50',
    indigo: 'border-indigo-500 text-indigo-600 bg-indigo-50',
    orange: 'border-orange-500 text-orange-600 bg-orange-50',
  };

  return (
    <div className={`p-6 rounded-2xl border-l-4 shadow-sm bg-white ${colors[color].split(' ')[0]}`}>
      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">{title}</h3>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-slate-800">
          {amount.toLocaleString('en-US', { style: 'currency', currency: 'LKR', minimumFractionDigits: 0 }).replace('LKR', 'Rs.')}
        </span>
      </div>
      {subtitle && <p className="mt-1 text-xs text-slate-400 font-medium">{subtitle}</p>}
    </div>
  );
};

export default SummaryCard;
