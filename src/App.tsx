import React, { useState, useMemo } from 'react';
import { 
  Package, TrendingDown, AlertTriangle, CheckCircle, 
  Search, Upload, Download, Trash2, Filter, LayoutGrid, 
  BarChart3, Settings, ShieldAlert
} from 'lucide-react';

/** * 1. 數據清洗引擎 (Data Sanitization Layer)
 */
const normalizeText = (input: string) => input?.trim().toLowerCase() || '';

const parseQuantity = (input: string): number => {
  if (!input) return 0;
  let target = input.toUpperCase();
  
  // 規格規範：若含等號，擷取等號後方
  if (target.includes('=')) {
    target = target.split('=')[1];
  }
  
  // 清除所有單位字元，僅保留數字與小數點
  const sanitized = target.replace(/[^\d.]/g, '');
  return parseFloat(sanitized) || 0;
};

const App = () => {
  // 模擬多來源資料
  const [inboundData, setInboundData] = useState<any[]>([]); // 進貨與期初
  const [orderData, setOrderData] = useState<any[]>([]);     // 出貨訂單
  const [searchTerm, setSearchTerm] = useState('');

  /**
   * 2. 庫存彙整邏輯 (Composite Key Logic)
   */
  const inventoryStatus = useMemo(() => {
    const stockMap: Record<string, { product: string, color: string, totalIn: number, totalOut: number }> = {};

    // 處理進貨 (Inbound)
    inboundData.forEach(item => {
      const key = `${normalizeText(item.product)}_${normalizeText(item.color)}`;
      if (!stockMap[key]) {
        stockMap[key] = { product: item.product, color: item.color, totalIn: 0, totalOut: 0 };
      }
      stockMap[key].totalIn += parseQuantity(item.quantity);
    });

    // 處理訂單出貨 (Outbound)
    orderData.forEach(item => {
      const key = `${normalizeText(item.product)}_${normalizeText(item.color)}`;
      if (!stockMap[key]) {
        stockMap[key] = { product: item.product, color: item.color, totalIn: 0, totalOut: 0 };
      }
      stockMap[key].totalOut += parseQuantity(item.quantity);
    });

    return Object.values(stockMap).map(s => ({
      ...s,
      currentBalance: s.totalIn - s.totalOut,
      status: (s.totalIn - s.totalOut) <= 0 ? 'OVERSOLD' : (s.totalIn - s.totalOut) < 500 ? 'WARNING' : 'SAFE'
    }));
  }, [inboundData, orderData]);

  /**
   * 3. UI 視覺組件 (Premium Dark Mode)
   */
  return (
    <div className="min-h-screen bg-[#1A1A1A] text-[#E5E7EB] font-sans selection:bg-blue-500/30">
      {/* 側邊導航欄 - 簡約高級風 */}
      <nav className="fixed left-0 top-0 h-full w-20 bg-[#111111] border-r border-[#2D2D2D] flex flex-col items-center py-8 gap-10">
        <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center font-black text-white">E</div>
        <LayoutGrid className="w-6 h-6 text-slate-500 hover:text-blue-500 cursor-pointer" />
        <BarChart3 className="w-6 h-6 text-slate-500 hover:text-blue-500 cursor-pointer" />
        <Settings className="w-6 h-6 text-slate-500 hover:text-blue-500 cursor-pointer" />
      </nav>

      {/* 主要內容區 */}
      <main className="pl-28 pr-10 py-10">
        <header className="flex justify-between items-end mb-12">
          <div>
            <h1 className="text-4xl font-black tracking-tighter mb-2 italic">EIMS / EVERISE</h1>
            <p className="text-slate-500 font-medium">Inventory Management Spec v2.0</p>
          </div>
          <div className="flex gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                type="text" 
                placeholder="快速搜尋品名或顏色..." 
                className="bg-[#2D2D2D] border-none rounded-lg pl-10 pr-4 py-2 w-64 focus:ring-2 focus:ring-blue-600 outline-none transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <label className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-bold cursor-pointer transition-colors flex items-center gap-2">
              <Upload className="w-4 h-4" /> 匯入 CSV
              <input type="file" className="hidden" />
            </label>
          </div>
        </header>

        {/* 庫存水位概覽卡片 */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-[#2D2D2D] p-6 rounded-2xl border border-white/5">
            <div className="flex justify-between items-start mb-4">
              <ShieldAlert className="text-red-500 w-8 h-8" />
              <span className="text-[10px] font-black bg-red-500/10 text-red-500 px-2 py-1 rounded">CRITICAL</span>
            </div>
            <div className="text-3xl font-black">{inventoryStatus.filter(s => s.status === 'OVERSOLD').length}</div>
            <div className="text-slate-500 text-sm font-bold">目前超賣品項</div>
          </div>
          {/* 其他卡片以此類推... */}
        </section>

        {/* 核心庫存表格 */}
        <div className="bg-[#2D2D2D] rounded-3xl overflow-hidden border border-white/5">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#333333] text-[10px] uppercase tracking-[0.2em] font-black text-slate-400">
              <tr>
                <th className="p-5">Item Specification</th>
                <th className="p-5">Color</th>
                <th className="p-5 text-right">Inbound (Y)</th>
                <th className="p-5 text-right">Outbound (Y)</th>
                <th className="p-5 text-right">Balance</th>
                <th className="p-5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {inventoryStatus.map((item, idx) => (
                <tr key={idx} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="p-5 font-bold text-white uppercase tracking-tight">{item.product}</td>
                  <td className="p-5 text-slate-400 text-sm">{item.color}</td>
                  <td className="p-5 text-right font-mono text-slate-500">{item.totalIn.toLocaleString()}</td>
                  <td className="p-5 text-right font-mono text-slate-500">{item.totalOut.toLocaleString()}</td>
                  <td className={`p-5 text-right font-mono font-black text-xl ${item.currentBalance < 0 ? 'text-red-500' : 'text-emerald-400'}`}>
                    {item.currentBalance.toLocaleString()}
                  </td>
                  <td className="p-5">
                    <div className="flex justify-center">
                      {item.status === 'OVERSOLD' && (
                        <div className="flex items-center gap-2 text-red-500 animate-pulse bg-red-500/10 px-3 py-1 rounded-full text-[10px] font-black">
                          <AlertTriangle className="w-3 h-3" /> OVERSOLD
                        </div>
                      )}
                      {item.status === 'WARNING' && (
                        <div className="flex items-center gap-2 text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full text-[10px] font-black">
                          <TrendingDown className="w-3 h-3" /> LOW STOCK
                        </div>
                      )}
                      {item.status === 'SAFE' && (
                        <div className="flex items-center gap-2 text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-full text-[10px] font-black">
                          <CheckCircle className="w-3 h-3" /> SAFE
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
};

export default App;