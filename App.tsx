
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  BudgetData, IncomeSource, ExpenseItem, OneTimePayment, SavingsEntry, SavingsWithdrawal, 
  CashEntry, GroceryCategory, GrocerySubCategory, GroceryBill, GroceryBillItem, CategoryOverride,
  LoanAccount, LoanTransaction, LoanTransactionType
} from './types';
import { INITIAL_DATA } from './constants';
import Layout from './components/Layout';
import SummaryCard from './components/SummaryCard';
import { analyzeBudget, processGroceryBill, processGeneralBill, processLoanScreenshot } from './services/geminiService';

// Helper to compress and resize images for faster API processing
const compressImage = async (base64Str: string, maxWidth = 1280, quality = 0.6): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxWidth) {
          width *= maxWidth / height;
          height = maxWidth;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
      }
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
  });
};

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

const CameraScanner: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onCapture: (images: string[]) => void;
}> = ({ isOpen, onClose, onCapture }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [isFlashActive, setIsFlashActive] = useState(false);

  useEffect(() => {
    if (isOpen) startCamera(); else stopCamera();
    return () => stopCamera();
  }, [isOpen]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      setStream(mediaStream);
      if (videoRef.current) videoRef.current.srcObject = mediaStream;
    } catch (err) {
      console.error("Camera access denied:", err);
      alert("Please allow camera access to scan bills.");
      onClose();
    }
  };

  const stopCamera = () => { if (stream) { stream.getTracks().forEach(track => track.stop()); setStream(null); } };

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (context) {
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        setCapturedImages(prev => [...prev, imageData]);
        setIsFlashActive(true);
        setTimeout(() => setIsFlashActive(false), 100);
      }
    }
  };

  const removePhoto = (index: number) => setCapturedImages(prev => prev.filter((_, i) => i !== index));

  const handleDone = () => {
    if (capturedImages.length > 0) { onCapture(capturedImages); setCapturedImages([]); onClose(); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black z-[250] flex flex-col items-center justify-between overflow-hidden touch-none">
      <div className="w-full p-4 flex justify-between items-center bg-black/50 backdrop-blur-md z-10">
        <button onClick={onClose} className="text-white bg-white/10 p-2 rounded-full hover:bg-white/20">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <h3 className="text-white font-black text-sm uppercase tracking-widest">Scanning Receipt</h3>
        <div className="w-10"></div>
      </div>
      <div className="relative flex-1 w-full bg-slate-900 flex items-center justify-center overflow-hidden">
        <video ref={videoRef} autoPlay playsInline className={`w-full h-full object-cover transition-opacity duration-300 ${isFlashActive ? 'opacity-0' : 'opacity-100'}`} />
        {isFlashActive && <div className="absolute inset-0 bg-white z-20" />}
        <canvas ref={canvasRef} className="hidden" />
        <div className="absolute inset-0 border-[3rem] border-black/40 pointer-events-none flex items-center justify-center">
          <div className="w-full h-[60%] border-2 border-dashed border-white/40 rounded-xl" />
        </div>
      </div>
      <div className="w-full px-4 pt-2 bg-black/80 backdrop-blur-md">
        <div className="flex gap-2 overflow-x-auto py-2 custom-scrollbar min-h-[80px]">
          {capturedImages.map((img, idx) => (
            <div key={idx} className="relative flex-shrink-0">
              <img src={img} className="h-16 w-12 object-cover rounded-md border border-white/20" />
              <button onClick={() => removePhoto(idx)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          ))}
        </div>
      </div>
      <div className="w-full p-8 flex justify-between items-center bg-black">
        <div className="w-16"></div>
        <button onClick={takePhoto} className="w-20 h-20 bg-white rounded-full p-1 ring-4 ring-white/20 active:scale-90 transition-transform flex items-center justify-center">
          <div className="w-full h-full bg-white rounded-full border-4 border-black/10" />
        </button>
        <div className="w-16">
          {capturedImages.length > 0 && (
            <button onClick={handleDone} className="bg-indigo-600 text-white p-4 rounded-full font-black flex items-center justify-center shadow-lg shadow-indigo-500/20 active:scale-95">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
            </button>
          )}
        </div>
      </div>
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
  const [ocrStatus, setOcrStatus] = useState("Preparing Document...");
  const [showAuditBillId, setShowAuditBillId] = useState<string | null>(null);
  const [showBreakupSubId, setShowBreakupSubId] = useState<string | null>(null);
  const [isManualBillModalOpen, setIsManualBillModalOpen] = useState(false);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [showCaptureOptions, setShowCaptureOptions] = useState(false);
  
  const [scannedBillResult, setScannedBillResult] = useState<any | null>(null);

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
  const generalScanInputRef = useRef<HTMLInputElement>(null);
  const loanScanInputRef = useRef<HTMLInputElement>(null);

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
      salaryIncome, rentIncome, totalLoanDebt
    };
  }, [data]);

  const groceryStats = useMemo(() => {
    const stats: Record<string, { totalAmount: number; totalQuantity: number; avgUnitCost: number; itemCount: number }> = {};
    data.groceryBills.forEach(bill => {
      bill.items.forEach(item => {
        const subId = item.subCategoryId || 'unassigned';
        if (!stats[subId]) stats[subId] = { totalAmount: 0, totalQuantity: 0, avgUnitCost: 0, itemCount: 0 };
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

  const handleUpdateIncome = (id: string, field: keyof IncomeSource, value: any) => {
    setData(prev => syncCashData({ ...prev, income: prev.income.map(i => i.id === id ? { ...i, [field]: value } : i) }));
  };

  const handleUpdateExpense = (id: string, field: keyof ExpenseItem, value: any) => {
    setData(prev => syncCashData({ ...prev, expenses: prev.expenses.map(e => e.id === id ? { ...e, [field]: (field === 'amount' ? Number(value) : value) } : e) }));
  };

  const handleAddExpense = (sourceType: 'Salary' | 'Rent') => {
    const newExp: ExpenseItem = { id: `exp-${Date.now()}`, name: 'New Expense', amount: 0, category: 'General', sourceType, isCashHandled: false };
    setData(prev => ({ ...prev, expenses: [...prev.expenses, newExp] }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;
    const base64Images = await Promise.all(files.map(file => new Promise<string>(resolve => {
      const r = new FileReader(); r.onload = ev => resolve(ev.target?.result as string); r.readAsDataURL(file);
    })));
    processImagesForGrocery(base64Images);
    e.target.value = '';
  };

  const processImagesForGrocery = async (base64Images: string[]) => {
    setIsOcrLoading(true);
    setOcrStatus("Transcribing Table...");
    try {
      const compressedImages = await Promise.all(base64Images.map(img => compressImage(img)));
      setOcrStatus("Capturing Item Data...");
      const result = await processGroceryBill(compressedImages, data.groceryCategories, data.mappingOverrides || {});
      const newBill: GroceryBill = {
        id: `bill-ocr-${Date.now()}`,
        date: result.date || new Date().toISOString().split('T')[0],
        shopName: result.shopName || 'Unknown Shop',
        imageUrls: compressedImages,
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
    } catch (err) { alert("Bill Capture Failed."); console.error(err); } 
    finally { setIsOcrLoading(false); setOcrStatus("Preparing Document..."); }
  };

  const handleGeneralScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;
    setIsOcrLoading(true);
    setOcrStatus("Transcribing...");
    try {
      const base64Images = await Promise.all(files.map(file => new Promise<string>(resolve => {
        const r = new FileReader(); r.onload = ev => resolve(ev.target?.result as string); r.readAsDataURL(file);
      })));
      const compressed = await Promise.all(base64Images.map(img => compressImage(img)));
      setOcrStatus("Extracting Summary...");
      const result = await processGeneralBill(compressed);
      setScannedBillResult({ ...result, imageUrls: compressed });
    } catch (err) { alert("Scan Failed."); } 
    finally { setIsOcrLoading(false); setOcrStatus("Preparing Document..."); e.target.value = ''; }
  };

  const handleApplyScannedBill = (targetId: string, targetType: 'expense' | 'onetime' | 'income') => {
    if (!scannedBillResult) return;
    setData(prev => {
      let newData = { ...prev };
      if (targetType === 'expense') newData.expenses = prev.expenses.map(e => e.id === targetId ? { ...e, amount: scannedBillResult.amount } : e);
      else if (targetType === 'onetime') newData.oneTimePayments = prev.oneTimePayments.map(p => p.id === targetId ? { ...p, paidAmount: scannedBillResult.amount, dueDate: scannedBillResult.date } : p);
      else if (targetType === 'income') newData.income = prev.income.map(i => i.id === targetId ? { ...i, amount: scannedBillResult.amount } : i);
      return syncCashData(newData);
    });
    setScannedBillResult(null);
  };

  const handleCategorizeItem = (billId: string, itemId: string, catId: string, subCatId: string) => {
    const cat = data.groceryCategories.find(c => c.id === catId);
    const sub = cat?.subCategories.find(s => s.id === subCatId);
    setData(prev => {
      const item = prev.groceryBills.find(b => b.id === billId)?.items.find(i => i.id === itemId);
      const rawDesc = item?.rawDescription || item?.description;
      const newOverrides = { ...(prev.mappingOverrides || {}) };
      if (rawDesc && cat && sub) newOverrides[rawDesc] = { categoryName: cat.name, subCategoryName: sub.name };
      return {
        ...prev, mappingOverrides: newOverrides,
        groceryBills: prev.groceryBills.map(b => b.id !== billId ? b : { ...b, items: b.items.map(it => it.id === itemId ? { ...it, categoryId: catId, subCategoryId: subCatId } : it) })
      };
    });
  };

  const handleToggleVerifyBill = (billId: string) => {
    setData(prev => ({
      ...prev,
      groceryBills: prev.groceryBills.map(b => b.id === billId ? { ...b, isVerified: !b.isVerified } : b)
    }));
  };

  const handleDeleteBill = (billId: string) => {
    if (confirm("Permanently delete this bill from archives?")) {
      setData(prev => ({ ...prev, groceryBills: prev.groceryBills.filter(b => b.id !== billId) }));
    }
  };

  // Helper for updating manual bill entry items
  const updateManualBillItem = (id: string, updates: Partial<GroceryBillItem>) => {
    setManualBillData(prev => ({
      ...prev,
      items: prev.items.map(it => it.id === id ? { ...it, ...updates } : it)
    }));
  };

  const handleSaveManualBill = () => {
    if (!manualBillData.shopName || manualBillData.items.length === 0) {
      alert("Please enter shop name and items.");
      return;
    }
    const totalAmount = manualBillData.items.reduce((s, i) => s + (Number(i.totalCost) || 0), 0);
    const newBill: GroceryBill = {
      id: `bill-manual-${Date.now()}`,
      date: manualBillData.date,
      shopName: manualBillData.shopName,
      totalAmount,
      isVerified: true,
      items: manualBillData.items.map(i => ({
        id: i.id || `item-${Math.random()}`,
        description: i.description || 'Manual Entry',
        quantity: Number(i.quantity) || 0,
        unit: i.unit || 'unit',
        unitCost: (Number(i.totalCost) || 0) / (Number(i.quantity) || 1),
        totalCost: Number(i.totalCost) || 0,
        categoryId: i.categoryId || 'unassigned',
        subCategoryId: i.subCategoryId || 'unassigned'
      })) as GroceryBillItem[]
    };
    setData(prev => ({ ...prev, groceryBills: [newBill, ...prev.groceryBills] }));
    setIsManualBillModalOpen(false);
    setManualBillData({
      shopName: '',
      date: new Date().toISOString().split('T')[0],
      items: [{ id: `m-item-${Date.now()}`, description: '', quantity: 1, unit: 'unit', totalCost: 0, categoryId: 'unassigned', subCategoryId: 'unassigned' }]
    });
  };

  // Helper for editing an existing bill in the Audit modal
  const updateExistingBill = (billId: string, updates: Partial<GroceryBill>) => {
    setData(prev => ({
      ...prev,
      groceryBills: prev.groceryBills.map(b => {
        if (b.id !== billId) return b;
        const updatedBill = { ...b, ...updates };
        // If items changed, re-calculate grand total
        if (updates.items) {
          updatedBill.totalAmount = updates.items.reduce((s, i) => s + Number(i.totalCost || 0), 0);
        }
        return updatedBill;
      })
    }));
  };

  const updateExistingBillItem = (billId: string, itemId: string, updates: Partial<GroceryBillItem>) => {
    setData(prev => ({
      ...prev,
      groceryBills: prev.groceryBills.map(b => {
        if (b.id !== billId) return b;
        const newItems = b.items.map(it => it.id === itemId ? { ...it, ...updates } : it);
        return {
          ...b,
          items: newItems,
          totalAmount: newItems.reduce((s, i) => s + Number(i.totalCost || 0), 0)
        };
      })
    }));
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      <input type="file" multiple accept="image/*" ref={generalScanInputRef} onChange={handleGeneralScan} className="hidden" />
      <CameraScanner isOpen={isCameraModalOpen} onClose={() => setIsCameraModalOpen(false)} onCapture={processImagesForGrocery} />

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
          <div className="flex justify-between items-center">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Monthly Income</h2>
            <button onClick={() => generalScanInputRef.current?.click()} className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-lg font-bold text-xs border border-indigo-200 hover:bg-indigo-100 transition-all flex items-center gap-2">📄 Scan Invoice</button>
          </div>
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50">
                <tr><th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 text-center">In Cash?</th><th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">Revenue Source</th><th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">Monthly Amount (LKR)</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.income.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-center"><input type="checkbox" checked={item.isCashHandled || false} onChange={(e) => handleUpdateIncome(item.id, 'isCashHandled', e.target.checked)} className="w-5 h-5 accent-indigo-600 cursor-pointer" /></td>
                    <td className="px-6 py-4 font-semibold text-base text-slate-800">{item.name}</td>
                    <td className="px-6 py-4"><div className="relative max-w-xs"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">Rs.</span><input type="number" value={item.amount} onChange={(e) => handleUpdateIncome(item.id, 'amount', Number(e.target.value))} className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-base text-indigo-700 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all" /></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'expenses' && (
        <div className="space-y-10 animate-in fade-in duration-300">
          <div className="flex justify-between items-center">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Recurring Expenses</h2>
            <button onClick={() => generalScanInputRef.current?.click()} className="bg-orange-50 text-orange-700 px-4 py-2 rounded-lg font-bold text-xs border border-orange-200 hover:bg-orange-100 transition-all flex items-center gap-2">📄 Scan Utility Bill</button>
          </div>
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
                      <tr><th className="px-6 py-3 text-[10px] font-black text-white uppercase tracking-widest w-16 text-center">Cash?</th><th className="px-6 py-3 text-[10px] font-black text-white uppercase tracking-widest">Category</th><th className="px-6 py-3 text-[10px] font-black text-white uppercase tracking-widest">Description</th><th className="px-6 py-3 text-[10px] font-black text-white uppercase tracking-widest">Amount (Rs.)</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.expenses.filter(e => e.sourceType === source).map(item => (
                        <tr key={item.id} className="hover:bg-indigo-50/30 transition-colors">
                          <td className="px-6 py-2 text-center"><input type="checkbox" checked={item.isCashHandled || false} onChange={(e) => handleUpdateExpense(item.id, 'isCashHandled', e.target.checked)} className="w-4 h-4 accent-indigo-600" /></td>
                          <td className="px-6 py-2"><input value={item.category} onChange={(e) => handleUpdateExpense(item.id, 'category', e.target.value)} className="bg-transparent border-none focus:ring-0 w-full text-slate-500 text-[11px] font-bold italic" /></td>
                          <td className="px-6 py-2"><input value={item.name} onChange={(e) => handleUpdateExpense(item.id, 'name', e.target.value)} className="w-full border-none focus:ring-0 text-slate-800 font-semibold text-sm" /></td>
                          <td className="px-6 py-2"><input type="number" value={item.amount} onChange={(e) => handleUpdateExpense(item.id, 'amount', Number(e.target.value))} className="w-full border-none focus:ring-0 text-indigo-700 font-bold text-sm" /></td>
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

      {activeTab === 'onetime' && (
        <div className="space-y-6 animate-in fade-in duration-300">
           <div className="flex justify-between items-center">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">One-Time Payments</h2>
            <button onClick={() => generalScanInputRef.current?.click()} className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg font-bold text-xs border border-blue-200 hover:bg-blue-100 transition-all flex items-center gap-2">🏷️ Scan Receipt</button>
          </div>
          <div className="grid grid-cols-1 gap-4">
             {data.oneTimePayments.map(payment => (
                <div key={payment.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                   <div className="flex-1"><h3 className="text-lg font-black text-slate-800">{payment.title}</h3><p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Due: {payment.dueDate || 'No date set'}</p></div>
                   <div className="flex gap-4 items-end">
                      <div className="flex flex-col gap-1"><span className="text-[10px] font-black text-slate-400 uppercase">Total Bill</span><input type="number" value={payment.totalAmount} onChange={(e) => setData(prev => ({...prev, oneTimePayments: prev.oneTimePayments.map(p => p.id === payment.id ? {...p, totalAmount: Number(e.target.value)} : p)}))} className="w-32 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 outline-none" /></div>
                      <div className="flex flex-col gap-1"><span className="text-[10px] font-black text-indigo-400 uppercase">Paid Amount</span><input type="number" value={payment.paidAmount} onChange={(e) => setData(prev => ({...prev, oneTimePayments: prev.oneTimePayments.map(p => p.id === payment.id ? {...p, paidAmount: Number(e.target.value)} : p)}))} className="w-32 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg text-sm font-bold text-indigo-700 outline-none" /></div>
                      <div className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider ${payment.paidAmount >= payment.totalAmount && payment.totalAmount > 0 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{payment.paidAmount >= payment.totalAmount && payment.totalAmount > 0 ? 'Settled' : 'Pending'}</div>
                   </div>
                </div>
             ))}
             <button onClick={() => setData(prev => ({...prev, oneTimePayments: [...prev.oneTimePayments, { id: `otp-${Date.now()}`, title: 'New Payment', totalAmount: 0, paidAmount: 0, dueDate: '' }]}))} className="py-6 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-black uppercase tracking-widest hover:bg-slate-50 transition-all">+ Add New Entry</button>
          </div>
        </div>
      )}

      {activeTab === 'groceries' && (
        <div className="space-y-10 animate-in fade-in duration-300 pb-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Grocery Tracker</h2>
            <div className="flex flex-wrap gap-3 relative">
              <button onClick={() => setIsManualBillModalOpen(true)} className="bg-white text-indigo-600 border border-indigo-200 px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-sm transition-all hover:bg-indigo-50 active:scale-95">✍️ Manual Entry</button>
              <button onClick={() => setShowCaptureOptions(!showCaptureOptions)} disabled={isOcrLoading} className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-emerald-100 transition-all hover:scale-105 active:scale-95">
                {isOcrLoading ? <><span className="animate-spin text-xl">🌀</span> Scanning...</> : <><span className="text-xl">📷</span> Capture Bill(s)</>}
              </button>
              {showCaptureOptions && (
                <div className="absolute top-full mt-2 right-0 w-56 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-[150] animate-in slide-in-from-top-2">
                  <button onClick={() => { setIsCameraModalOpen(true); setShowCaptureOptions(false); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-50 rounded-xl text-sm font-black text-slate-700 transition-colors">📸 Scan with Camera</button>
                  <button onClick={() => { fileInputRef.current?.click(); setShowCaptureOptions(false); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-50 rounded-xl text-sm font-black text-slate-700 transition-colors">📁 Upload from Files</button>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-1 bg-slate-100 p-1.5 rounded-2xl w-full max-w-2xl">
            {[{ id: 'analysis', label: 'Spend Analysis', icon: '📊' }, { id: 'bills', label: 'Bills Archive', icon: '🧾' }, { id: 'categories', label: 'Manage Categories', icon: '⚙️' }].map((tab) => (
              <button key={tab.id} onClick={() => setGrocerySubTab(tab.id as any)} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${grocerySubTab === tab.id ? 'bg-white text-indigo-700 shadow-md' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}><span>{tab.icon}</span> {tab.label}</button>
            ))}
          </div>
          {grocerySubTab === 'analysis' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <SummaryCard title="Total Bills Value" amount={totals.totalGrocerySpend} color="blue" />
                <SummaryCard title="Verified Amount" amount={totals.totalVerifiedGroceryAmount} color="green" />
                <SummaryCard title="Categorized Total" amount={totalCategorizedSpend} color={totals.totalGrocerySpend === totalCategorizedSpend ? "indigo" : "red"} subtitle={totals.totalGrocerySpend === totalCategorizedSpend ? "Full Reconciled ✅" : `Mismatch: Rs. ${(totals.totalGrocerySpend - totalCategorizedSpend).toLocaleString()} ❌`} />
              </div>
              <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {data.groceryCategories.map(cat => (
                    <div key={cat.id} className="p-6 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col">
                        <div className="flex justify-between items-start mb-6"><span className="text-[11px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-3 py-1 rounded-full">{cat.name}</span><span className="text-xl font-black text-slate-900">Rs. {Number(categoryTotals[cat.id] || 0).toLocaleString()}</span></div>
                        <div className="space-y-3 flex-1">{cat.subCategories.map(sub => {
                            const stats = groceryStats[sub.id]; if (!stats) return null;
                            return (
                              <div key={sub.id} className="text-xs flex flex-col gap-1 border-t border-slate-200/50 pt-3 mt-1 cursor-pointer hover:bg-white hover:rounded-xl p-2 transition-all group" onClick={() => setShowBreakupSubId(sub.id)}>
                                <div className="flex justify-between font-bold text-slate-700 group-hover:text-indigo-600"><span>{sub.name}</span><span>Rs. {Number(stats.totalAmount).toLocaleString()}</span></div>
                              </div>
                            );
                        })}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {grocerySubTab === 'bills' && (
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
          )}
        </div>
      )}

      {activeTab === 'loans' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="flex justify-between items-center">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Loan Tracking</h2>
            <button onClick={() => {
              const name = prompt("Loan Name/Creditor?"); if (name) setData(prev => ({ ...prev, loans: [...prev.loans, { id: `loan-${Date.now()}`, name, openingBalance: 0, transactions: [] }] }));
            }} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-xs shadow-lg transition-all hover:scale-105">+ Add Loan</button>
          </div>
          <div className="grid grid-cols-1 gap-8">
            {data.loans.map(loan => (
              <div key={loan.id} className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
                <div className="p-6 bg-slate-50 border-b flex justify-between items-center">
                  <div><h3 className="text-xl font-black text-slate-800">{loan.name}</h3><p className="text-xs font-bold text-slate-400">Opening: Rs. {loan.openingBalance.toLocaleString()}</p></div>
                  <div className="flex gap-2">
                    <button onClick={() => { const amt = Number(prompt("Amount?")); const desc = prompt("Desc?"); if(amt && desc) setData(prev => ({ ...prev, loans: prev.loans.map(l => l.id === loan.id ? { ...l, transactions: [{ id: `t-${Date.now()}`, date: new Date().toISOString().split('T')[0], description: desc, amount: amt, type: 'taken' }, ...l.transactions] } : l) })); }} className="bg-red-50 text-red-700 px-3 py-1.5 rounded-lg text-xs font-black uppercase border border-red-100">+ Borrow</button>
                    <button onClick={() => { const amt = Number(prompt("Amount?")); const desc = prompt("Desc?"); if(amt && desc) setData(prev => ({ ...prev, loans: prev.loans.map(l => l.id === loan.id ? { ...l, transactions: [{ id: `t-${Date.now()}`, date: new Date().toISOString().split('T')[0], description: desc, amount: amt, type: 'repayment' }, ...l.transactions] } : l) })); }} className="bg-green-50 text-green-700 px-3 py-1.5 rounded-lg text-xs font-black uppercase border border-green-100">+ Repay</button>
                  </div>
                </div>
                <div className="p-6">
                  <table className="w-full text-left text-sm">
                    <thead><tr className="text-[10px] font-black text-slate-400 uppercase border-b"><th className="py-2">Date</th><th className="py-2">Description</th><th className="py-2 text-right">Amount</th></tr></thead>
                    <tbody className="divide-y">{loan.transactions.map(t => (
                      <tr key={t.id}><td className="py-2 font-bold text-slate-400">{t.date}</td><td className="py-2 font-semibold text-slate-700">{t.description}</td><td className={`py-2 font-black text-right ${t.type === 'taken' ? 'text-red-600' : 'text-green-600'}`}>{t.type === 'taken' ? '+' : '-'} Rs. {t.amount.toLocaleString()}</td></tr>
                    ))}</tbody>
                  </table>
                  <div className="mt-4 pt-4 border-t flex justify-between items-center"><span className="text-xs font-black text-slate-400 uppercase">Balance</span><span className="text-xl font-black text-slate-900">Rs. {(loan.openingBalance + loan.transactions.reduce((s, t) => t.type === 'taken' ? s + t.amount : s - t.amount, 0)).toLocaleString()}</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'cash' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Cash on Hand</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-200">
               <h3 className="text-lg font-black text-emerald-700 mb-6 flex justify-between items-center">Income <button onClick={() => { const d = prompt("Reason?"); const a = Number(prompt("Amount?")); if(d && a) setData(prev => ({ ...prev, cash: { ...prev.cash, income: [{ id: `c-${Date.now()}`, date: new Date().toISOString().split('T')[0], description: d, amount: a }, ...prev.cash.income] } })); }} className="text-[10px] bg-emerald-50 px-2 py-1 rounded">+ Add</button></h3>
               <div className="space-y-2">{data.cash.income.map(item => (<div key={item.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl"><span className="text-sm font-bold">{item.description}</span><span className="font-black text-emerald-600">Rs. {item.amount.toLocaleString()}</span></div>))}</div>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-200">
               <h3 className="text-lg font-black text-red-700 mb-6 flex justify-between items-center">Expenses <button onClick={() => { const d = prompt("Reason?"); const a = Number(prompt("Amount?")); if(d && a) setData(prev => ({ ...prev, cash: { ...prev.cash, expenses: [{ id: `c-${Date.now()}`, date: new Date().toISOString().split('T')[0], description: d, amount: a }, ...prev.cash.expenses] } })); }} className="text-[10px] bg-red-50 px-2 py-1 rounded">+ Add</button></h3>
               <div className="space-y-2">{data.cash.expenses.map(item => (<div key={item.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl"><span className="text-sm font-bold">{item.description}</span><span className="font-black text-red-600">Rs. {item.amount.toLocaleString()}</span></div>))}</div>
            </div>
          </div>
          <div className="bg-indigo-900 p-8 rounded-3xl text-white flex justify-between items-center shadow-2xl">
             <div><p className="text-xs font-black text-indigo-300 uppercase mb-1">Available Cash</p><h4 className="text-4xl font-black">Rs. {totals.cashBalance.toLocaleString()}</h4></div>
             <div className="text-right"><p className="text-[10px] font-black text-indigo-300 uppercase mb-1">Opening Bal.</p><input type="number" value={data.cash.openingBalance} onChange={e => setData(prev => ({...prev, cash: {...prev.cash, openingBalance: Number(e.target.value)}}))} className="bg-indigo-800 border-none rounded text-sm font-bold text-white w-24 text-right" /></div>
          </div>
        </div>
      )}

      {activeTab === 'savings' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Savings Tracker</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-200">
               <h3 className="text-lg font-black text-indigo-700 mb-6 flex justify-between items-center">Additions <button onClick={() => { const a = Number(prompt("Amount?")); if(a) setData(prev => ({...prev, savings: {...prev.savings, additions: [{id: `sa-${Date.now()}`, amount: a, date: new Date().toISOString().split('T')[0]}, ...prev.savings.additions]}})); }} className="text-[10px] bg-indigo-50 px-2 py-1 rounded">+ Add</button></h3>
               <div className="space-y-2">{data.savings.additions.map(item => (<div key={item.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl"><span className="text-sm font-bold text-slate-400">{item.date}</span><span className="font-black text-indigo-600">Rs. {item.amount.toLocaleString()}</span></div>))}</div>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-200">
               <h3 className="text-lg font-black text-slate-700 mb-6 flex justify-between items-center">Withdrawals <button onClick={() => { const r = prompt("Reason?"); const a = Number(prompt("Amount?")); if(r && a) setData(prev => ({...prev, savings: {...prev.savings, withdrawals: [{id: `sw-${Date.now()}`, amount: a, date: new Date().toISOString().split('T')[0], reason: r}, ...prev.savings.withdrawals]}})); }} className="text-[10px] bg-slate-100 px-2 py-1 rounded">+ Log</button></h3>
               <div className="space-y-2">{data.savings.withdrawals.map(item => (<div key={item.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl"><div className="flex flex-col"><span className="text-sm font-bold">{item.reason}</span><span className="text-[10px] font-bold text-slate-400 uppercase">{item.date}</span></div><span className="font-black text-slate-900">Rs. {item.amount.toLocaleString()}</span></div>))}</div>
            </div>
          </div>
          <div className="bg-white p-8 rounded-3xl border-2 border-indigo-100 flex justify-between items-center shadow-lg">
             <div><p className="text-xs font-black text-slate-400 uppercase mb-1">Savings Balance</p><h4 className="text-4xl font-black text-indigo-900">Rs. {totals.savingsBalance.toLocaleString()}</h4></div>
             <div className="text-right"><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Opening Bal.</p><input type="number" value={data.savings.openingBalance} onChange={e => setData(prev => ({...prev, savings: {...prev.savings, openingBalance: Number(e.target.value)}}))} className="bg-slate-50 border border-slate-200 rounded text-sm font-bold text-slate-800 w-24 text-right" /></div>
          </div>
        </div>
      )}

      {/* Modals and Overlays */}
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
                <input type="text" placeholder="Shop Name" value={manualBillData.shopName} onChange={(e) => setManualBillData(prev => ({ ...prev, shopName: e.target.value }))} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none" />
                <input type="date" value={manualBillData.date} onChange={(e) => setManualBillData(prev => ({ ...prev, date: e.target.value }))} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none" />
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b pb-3"><h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Bill Items</h4><button onClick={() => setManualBillData(prev => ({ ...prev, items: [...prev.items, { id: `m-item-${Date.now()}`, description: '', quantity: 1, unit: 'unit', totalCost: 0, categoryId: 'unassigned', subCategoryId: 'unassigned' }] }))} className="text-indigo-600 text-xs font-black uppercase">+ Add Item</button></div>
                <div className="space-y-3">
                  {manualBillData.items.map(item => (
                    <div key={item.id} className="grid grid-cols-12 gap-3 items-center bg-slate-50/50 p-3 rounded-2xl border border-slate-100 group">
                      <input 
                        placeholder="Item Description" 
                        value={item.description} 
                        onChange={(e) => updateManualBillItem(item.id!, { description: e.target.value })} 
                        className="col-span-4 bg-white border-none rounded-lg text-sm font-bold p-2 focus:ring-2 focus:ring-indigo-100" 
                      />
                      <input 
                        type="number" 
                        placeholder="Qty" 
                        value={item.quantity || ''} 
                        onChange={(e) => updateManualBillItem(item.id!, { quantity: e.target.value === '' ? 0 : parseFloat(e.target.value) })} 
                        className="col-span-1 bg-white border-none rounded-lg text-sm font-bold p-2 text-center focus:ring-2 focus:ring-indigo-100" 
                      />
                      <div className="col-span-3">
                        <SearchableCategoryDropdown 
                          placeholder="Categorize" 
                          currentValue={`${item.categoryId}|${item.subCategoryId}`} 
                          categories={data.groceryCategories} 
                          onSelect={(catId, subCatId) => updateManualBillItem(item.id!, { categoryId: catId, subCategoryId: subCatId })} 
                        />
                      </div>
                      <input 
                        type="number" 
                        placeholder="Total Cost" 
                        value={item.totalCost || ''} 
                        onChange={(e) => updateManualBillItem(item.id!, { totalCost: e.target.value === '' ? 0 : parseFloat(e.target.value) })} 
                        className="col-span-3 bg-white border-none rounded-lg text-sm font-black p-2 text-right focus:ring-2 focus:ring-indigo-100" 
                      />
                      <button onClick={() => setManualBillData(prev => ({ ...prev, items: prev.items.filter(it => it.id !== item.id) }))} className="col-span-1 text-slate-300 hover:text-red-500 text-center opacity-0 group-hover:opacity-100">✕</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-8 bg-slate-50 border-t flex justify-between items-center">
              <div><span className="text-[10px] font-black text-slate-400 uppercase block">Total</span><span className="text-3xl font-black text-slate-900">Rs. {manualBillData.items.reduce((s, i) => s + (Number(i.totalCost) || 0), 0).toLocaleString()}</span></div>
              <div className="flex gap-4"><button onClick={() => setIsManualBillModalOpen(false)} className="px-8 py-4 rounded-2xl font-black text-xs uppercase text-slate-500 hover:bg-slate-100 transition-all">Cancel</button><button onClick={handleSaveManualBill} className="bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase shadow-xl transform active:scale-95">Save Bill</button></div>
            </div>
          </div>
        </div>
      )}

      {showAuditBillId && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95">
            <div className="p-8 border-b flex justify-between items-center bg-slate-50">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Edit & Audit Bill</h3>
              <button onClick={() => setShowAuditBillId(null)} className="text-slate-400 hover:text-slate-900 text-3xl font-light p-2">✕</button>
            </div>
            <div className="flex-1 overflow-auto p-8 grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div className="space-y-6">
                <div className="space-y-4">
                  <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Bill Details</h4>
                  <div className="space-y-3">
                    <input 
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-lg font-black text-slate-800 focus:ring-2 focus:ring-indigo-100 outline-none" 
                      value={data.groceryBills.find(b => b.id === showAuditBillId)?.shopName || ''}
                      onChange={(e) => updateExistingBill(showAuditBillId, { shopName: e.target.value })}
                    />
                    <input 
                      type="date"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-500 focus:ring-2 focus:ring-indigo-100 outline-none" 
                      value={data.groceryBills.find(b => b.id === showAuditBillId)?.date || ''}
                      onChange={(e) => updateExistingBill(showAuditBillId, { date: e.target.value })}
                    />
                  </div>
                </div>
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Attached Screenshot</h4>
                <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
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
                <div className="flex justify-between items-center"><h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Extracted Items</h4><span className="text-[10px] font-black text-indigo-500 uppercase">Grand Total: Rs. {Number(data.groceryBills.find(b => b.id === showAuditBillId)?.totalAmount || 0).toLocaleString()}</span></div>
                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                  {data.groceryBills.find(b => b.id === showAuditBillId)?.items.map(item => (
                    <div key={item.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3 group hover:border-indigo-200 transition-all">
                      <input 
                        className="w-full bg-transparent border-none p-0 text-sm font-bold text-slate-700 focus:ring-0" 
                        value={item.description}
                        onChange={(e) => updateExistingBillItem(showAuditBillId, item.id, { description: e.target.value })}
                      />
                      <div className="flex items-center gap-4">
                        <div className="flex-1 flex flex-col">
                          <label className="text-[8px] font-black text-slate-400 uppercase mb-1">Quantity</label>
                          <input 
                            type="number"
                            className="w-full bg-white border border-slate-100 rounded-lg p-1 text-xs font-bold text-slate-500 focus:ring-2 focus:ring-indigo-100" 
                            value={item.quantity || ''}
                            onChange={(e) => updateExistingBillItem(showAuditBillId, item.id, { quantity: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                          />
                        </div>
                        <div className="flex-1 flex flex-col">
                          <label className="text-[8px] font-black text-slate-400 uppercase mb-1">Total Cost (LKR)</label>
                          <input 
                            type="number"
                            className="w-full bg-indigo-50 border border-indigo-100 rounded-lg p-1 text-xs font-black text-indigo-700 focus:ring-2 focus:ring-indigo-200" 
                            value={item.totalCost || ''}
                            onChange={(e) => updateExistingBillItem(showAuditBillId, item.id, { totalCost: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                          />
                        </div>
                      </div>
                      <SearchableCategoryDropdown 
                        currentValue={`${item.categoryId}|${item.subCategoryId}`} 
                        categories={data.groceryCategories} 
                        onSelect={(catId, subCatId) => handleCategorizeItem(showAuditBillId, item.id, catId, subCatId)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isOcrLoading && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[300] flex flex-col items-center justify-center">
           <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl flex flex-col items-center gap-6">
             <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
             <div className="text-center">
               <h4 className="text-xl font-black text-slate-900">{ocrStatus}</h4>
               <p className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-widest">Step 1: Clean Table Transcription...</p>
             </div>
           </div>
        </div>
      )}
    </Layout>
  );
};

export default App;
