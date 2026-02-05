import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  FileText, Upload, Printer, ChevronRight, Hash, 
  ArrowLeft, Settings, Search,
  CheckCircle2, FileSpreadsheet,
  Table as TableIcon, LayoutDashboard, Edit3, X, Trash,
  Download, Database, Layers, Sparkles, MessageSquare, Loader2,
  TrendingUp, BarChart3, Calculator,
  Cloud, CloudOff, LogOut, Lock, Globe, Container, PieChart, Users, History, Trash2, PlusCircle, Save
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, onAuthStateChanged, signInAnonymously 
} from 'firebase/auth';
import { 
  getFirestore, collection, doc, setDoc, onSnapshot, writeBatch, query, where, getDocs, orderBy
} from 'firebase/firestore';

// --- 獨立的 AI Modal ---
const AiModal = ({ show, onClose, prompt, setPrompt, onSend, response, loading }) => {
  if (!show) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
          <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" /> AI 訂單數據分析
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full"><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <div className="flex-1 overflow-auto p-6 bg-slate-50">
          {response ? (
             <div className="prose prose-sm max-w-none bg-white p-6 rounded-xl shadow-sm border border-slate-100">
               <div className="whitespace-pre-wrap leading-relaxed text-slate-700">{response}</div>
             </div>
          ) : (
            <div className="text-center py-12 text-slate-400">
              <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>輸入問題，讓 AI 幫您分析當前的訂單數據...</p>
            </div>
          )}
        </div>
        <div className="p-4 bg-white border-t flex gap-2">
          <input 
            type="text" 
            className="flex-1 border rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 focus:outline-none"
            placeholder="輸入問題..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSend()}
          />
          <button onClick={onSend} disabled={loading || !prompt} className="bg-purple-600 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />} 送出
          </button>
        </div>
      </div>
    </div>
  );
};

// --- 手動新增 Modal ---
const ManualAddModal = ({ show, onClose, onSave }) => {
  const [containerNo, setContainerNo] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  if (!show) return null;
  const handleSubmit = async () => {
    if (!containerNo || !amount) return alert('請填寫完整');
    setLoading(true);
    await onSave(containerNo, amount);
    setLoading(false); setContainerNo(''); setAmount(''); onClose();
  };
  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-800">手動新增中國直出</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">櫃號</label>
            <input type="text" className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500" placeholder="例如: CN-888" value={containerNo} onChange={e => setContainerNo(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">金額</label>
            <input type="number" className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500" placeholder="例如: 50000" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
        </div>
        <div className="p-4 bg-slate-50 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg">取消</button>
          <button onClick={handleSubmit} disabled={loading} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 儲存
          </button>
        </div>
      </div>
    </div>
  );
};

// --- SA 請款單預覽 Modal ---
const SaPreviewModal = ({ show, onClose, client, orders }) => {
  if (!show || !client) return null;
  const total = orders.reduce((sum, o) => sum + (Number(o['總價']) || (Number(o['數量'])*Number(o['單價']))), 0);
  
  return (
    <div className="fixed inset-0 bg-black/80 z-[200] flex flex-col items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl h-[90vh] overflow-y-auto rounded-lg shadow-2xl p-8 print:p-0 print:w-full print:h-auto print:shadow-none">
        <div className="flex justify-between items-start mb-8 print:hidden">
          <h2 className="text-2xl font-bold text-slate-800">請款單預覽</h2>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"><Printer className="w-4 h-4"/> 列印</button>
            <button onClick={onClose} className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300"><X className="w-4 h-4"/></button>
          </div>
        </div>

        {/* Invoice Layout */}
        <div className="border-2 border-slate-800 p-8 min-h-[800px] relative">
          <div className="text-center mb-8 border-b-2 border-slate-800 pb-4">
            <h1 className="text-4xl font-black tracking-widest text-slate-900 mb-2">EVERISE</h1>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Billing Statement / Invoice</p>
          </div>
          
          <div className="flex justify-between mb-8">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase mb-1">Bill To:</p>
              <h3 className="text-xl font-bold text-slate-800">{client}</h3>
              <p className="text-sm text-slate-500 mt-1">Date: {new Date().toLocaleDateString()}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-slate-400 uppercase mb-1">Invoice Total:</p>
              <h3 className="text-3xl font-black text-emerald-600">USD {total.toLocaleString()}</h3>
            </div>
          </div>

          <table className="w-full text-sm mb-8">
            <thead className="border-b-2 border-slate-800 text-slate-600">
              <tr>
                <th className="py-2 text-left">Date</th>
                <th className="py-2 text-left">Order / Container</th>
                <th className="py-2 text-left">Item</th>
                <th className="py-2 text-right">Qty</th>
                <th className="py-2 text-right">Unit Price</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {orders.map((order, idx) => (
                <tr key={idx}>
                  <td className="py-3 text-slate-500">{order['日期']}</td>
                  <td className="py-3 font-mono font-bold text-slate-700">
                    {order['單號']}<br/>
                    <span className="text-xs text-slate-400">{order['櫃號']} {order['出貨地'] === 'CN' ? '(CN)' : ''}</span>
                  </td>
                  <td className="py-3 text-slate-600">{order['品名'] || 'General Item'}</td>
                  <td className="py-3 text-right">{Number(order['數量']).toLocaleString()}</td>
                  <td className="py-3 text-right">{Number(order['單價']).toFixed(2)}</td>
                  <td className="py-3 text-right font-bold text-slate-800">
                    {(Number(order['總價']) || (Number(order['數量'])*Number(order['單價']))).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end border-t-2 border-slate-800 pt-4">
            <div className="w-1/3">
              <div className="flex justify-between py-2 font-bold text-lg">
                <span>Total:</span>
                <span>USD {total.toLocaleString()}</span>
              </div>
            </div>
          </div>
          
          <div className="absolute bottom-8 left-8 right-8 text-center text-xs text-slate-400">
            Thank you for your business.
          </div>
        </div>
      </div>
    </div>
  );
};

const App = () => {
  // --- 請務必填回您的 Keys ---
  const apiKey = "AIzaSyAxuPefSSv7M2iJKtE-rXkx1m3mJIhe9oYY"; 
  const firebaseConfig = {
    apiKey: "AIzaSyDsGkGsWS4sRIn3o9XzWmqGSbZg4i5Dc9g",
    authDomain: "sa-test-96792.firebaseapp.com",
    projectId: "sa-test-96792",
    storageBucket: "sa-test-96792.firebasestorage.app",
    messagingSenderId: "736271192466",
    appId: "1:736271192466:web:1517c3d40e3e61d1c1b14b",
    measurementId: "G-1X3X3FWSM7"
  };;

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  const [user, setUser] = useState(null);
  const [masterData, setMasterData] = useState([]); 
  const [uploadHistory, setUploadHistory] = useState([]);
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'client' | 'sa' | 'settings'
  const [isUploading, setIsUploading] = useState(false); 
  const [showManualModal, setShowManualModal] = useState(false);
  
  // SA State
  const [saClient, setSaClient] = useState('');
  const [saSelectedOrders, setSaSelectedOrders] = useState([]);
  const [showSaPreview, setShowSaPreview] = useState(false);

  // Search & AI State
  const [searchTerm, setSearchTerm] = useState('');
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  useEffect(() => {
    onAuthStateChanged(auth, u => { setUser(u); if (!u) signInAnonymously(auth); });
    const unsubOrders = onSnapshot(collection(db, 'orders'), snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => new Date(b['日期']) - new Date(a['日期']));
      setMasterData(data);
    });
    const unsubHist = onSnapshot(query(collection(db, 'upload_logs'), orderBy('timestamp', 'desc')), snap => {
      setUploadHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubOrders(); unsubHist(); };
  }, []);

  const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(val)||0);
  const isChinaOrder = (o) => {
    const origin = String(o['出貨地'] || o['Origin'] || '');
    return ['CN', 'China', '中國'].some(k => origin.includes(k));
  };

  const handleManualSave = async (containerNo, amount) => {
    const batchId = `Manual-${Date.now()}`;
    const orderId = `CN-Manual-${Date.now()}`;
    await setDoc(doc(db, "orders", orderId), {
      batchId, fileName: '手動輸入', '櫃號': containerNo, '總價': Number(amount), '數量': 1, '單價': Number(amount),
      '客戶': '🇨🇳 中國直出', '出貨地': 'CN', '日期': new Date().toISOString().split('T')[0], '單號': orderId
    });
    await setDoc(doc(db, 'upload_logs', batchId), { id: batchId, fileName: `手動: ${containerNo}`, timestamp: Date.now(), count: 1, type: 'Manual' });
    alert('新增成功');
  };

  const handleDeleteBatch = async (batchId) => {
    if(!window.confirm('確定刪除?')) return;
    const snap = await getDocs(query(collection(db, 'orders'), where('batchId', '==', batchId)));
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    batch.delete(doc(db, 'upload_logs', batchId));
    await batch.commit();
    alert('已刪除');
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const fileName = file.name;
    const batchId = Date.now().toString(); 
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result;
      const rows = text.split('\n').map(row => row.trim()).filter(row => row);
      const headers = rows[0].split(',').map(h => h.trim());
      const batch = writeBatch(db);
      let count = 0;
      const isMonthlyReport = headers.some(h => h.includes('請款金額') || h.includes('No.'));
      const isSimpleChina = headers.length <= 4 && headers.includes('櫃號') && headers.includes('金額');

      for (let i = 1; i < rows.length; i++) {
        const values = rows[i].split(',');
        if (values.length < 2) continue; 
        const rowData = { batchId, fileName };
        if (isSimpleChina) {
          const containerIdx = headers.indexOf('櫃號');
          const amountIdx = headers.indexOf('金額');
          rowData['櫃號'] = values[containerIdx]?.trim() || '-';
          rowData['總價'] = Number(values[amountIdx]?.trim()) || 0;
          rowData['數量'] = 1; rowData['單價'] = rowData['總價'];
          rowData['客戶'] = '🇨🇳 中國直出'; rowData['出貨地'] = 'CN';
          rowData['日期'] = new Date().toISOString().split('T')[0];
          rowData['單號'] = `CN-Fast-${batchId}-${i}`;
        } else if (isMonthlyReport) {
          const rawClient = values[1]?.trim();
          if (!rawClient) continue;
          rowData['客戶'] = rawClient;
          const rawAmount = values[2]?.replace(/[A-Za-z,]/g, '').trim();
          rowData['總價'] = Number(rawAmount) || 0;
          rowData['數量'] = 1; rowData['單價'] = rowData['總價'];
          const remark = values[3]?.toUpperCase() || '';
          if (remark.includes('CHINA') || remark.includes('CN')) rowData['出貨地'] = 'CN';
          else rowData['出貨地'] = 'TW';
          rowData['單號'] = `Auto-${fileName}-${i}`;
          rowData['日期'] = fileName.replace('.csv', '') || new Date().toISOString().split('T')[0];
          rowData['櫃號'] = '-';
        } else {
          headers.forEach((header, index) => { rowData[header] = values[index]?.trim(); });
          const orderId = rowData['單號'] || rowData['訂單編號'] || `AutoID-${Date.now()}-${i}`;
          rowData['單號'] = orderId;
          rowData['數量'] = Number(rowData['數量']) || 0;
          rowData['單價'] = Number(rowData['單價']) || 0;
        }
        const docRef = doc(db, "orders", String(rowData['單號']));
        batch.set(docRef, rowData, { merge: true }); 
        count++;
      }
      batch.set(doc(db, 'upload_logs', batchId), { id: batchId, fileName, timestamp: Date.now(), count, type: isSimpleChina ? 'China Fast' : 'Standard' });
      await batch.commit();
      alert(`成功匯入 ${count} 筆`);
      setIsUploading(false);
    };
    reader.readAsText(file);
  };

  const handleAiAnalysis = async () => {
    if (!prompt && !aiPrompt) return;
    setIsAiLoading(true);
    const context = `訂單數 ${masterData.length}。樣本: ${JSON.stringify(masterData.slice(0, 30))}。問題: "${aiPrompt}"`;
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: context }] }] })
      });
      const data = await res.json();
      setAiResponse(data.candidates?.[0]?.content?.parts?.[0]?.text || "AI 思考失敗");
    } catch (e) { setAiResponse("錯誤: " + e.message); }
    setIsAiLoading(false);
  };

  const clientStats = useMemo(() => {
    const stats = {};
    masterData.forEach(o => {
      const name = (o['客戶']||'Unknown').trim();
      const amt = Number(o['數量'])*Number(o['單價']) || Number(o['總價']) || 0;
      if (!stats[name]) stats[name] = { name, total: 0, china: 0, warehouse: 0 };
      stats[name].total += amt;
      if (isChinaOrder(o)) stats[name].china += amt; else stats[name].warehouse += amt;
    });
    return Object.values(stats).sort((a,b) => b.total - a.total);
  }, [masterData]);

  // SA Filter
  const saFilteredOrders = useMemo(() => {
    if (!saClient) return [];
    return masterData.filter(o => (o['客戶']||'').trim() === saClient);
  }, [saClient, masterData]);

  return (
    <div className="min-h-screen bg-[#F4F7F6] font-sans text-slate-600">
      <nav className="bg-[#0F172A] text-white px-6 py-4 shadow-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="bg-emerald-500 p-2 rounded-lg shadow-lg"><Layers className="w-6 h-6 text-white" /></div>
            <h1 className="text-xl font-bold tracking-wide">EVERISE <span className="text-emerald-400 text-xs px-2 border border-emerald-500/50 rounded-full">V17.0</span></h1>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowManualModal(true)} className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-lg flex items-center gap-2 font-bold shadow-lg shadow-orange-500/20"><PlusCircle className="w-4 h-4"/> 手動記帳</button>
            <button onClick={() => { setShowAiModal(true); setAiResponse(''); }} className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg flex items-center gap-2 shadow-lg shadow-purple-600/20"><Sparkles className="w-4 h-4"/> AI</button>
            <div className="h-8 w-px bg-slate-700 mx-1"></div>
            <label className="cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg shadow-emerald-600/20">
              {isUploading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Upload className="w-4 h-4"/>}
              <span className="font-medium">{isUploading ? '處理中...' : '匯入'}</span>
              <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
            </label>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 bg-white p-2 rounded-xl shadow-sm w-full md:w-fit">
          <button onClick={() => setViewMode('list')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${viewMode === 'list' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}><TableIcon className="w-4 h-4"/> 訂單明細</button>
          <button onClick={() => setViewMode('client')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${viewMode === 'client' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-500 hover:bg-purple-50 hover:text-purple-600'}`}><PieChart className="w-4 h-4"/> 營收分析</button>
          {/* SA Billing Button Restored! */}
          <button onClick={() => setViewMode('sa')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${viewMode === 'sa' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500 hover:bg-emerald-50 hover:text-emerald-600'}`}><FileText className="w-4 h-4"/> SA 請款單</button>
          <button onClick={() => setViewMode('settings')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${viewMode === 'settings' ? 'bg-slate-200 text-slate-800' : 'text-slate-500 hover:bg-slate-100'}`}><Settings className="w-4 h-4"/> 管理</button>
        </div>

        {/* --- View Content --- */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 min-h-[500px] overflow-hidden">
          
          {/* 1. SA Billing View (The Requested Feature) */}
          {viewMode === 'sa' && (
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-emerald-800 flex items-center gap-2"><FileText className="w-6 h-6"/> SA 請款單製作</h2>
                <div className="flex gap-2">
                   <select 
                     className="border rounded-lg px-4 py-2 bg-slate-50 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
                     value={saClient} onChange={e => setSaClient(e.target.value)}
                   >
                     <option value="">-- 請選擇客戶 --</option>
                     {clientStats.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                   </select>
                   <button 
                     onClick={() => setShowSaPreview(true)} 
                     disabled={!saClient}
                     className="bg-emerald-600 text-white px-6 py-2 rounded-lg font-bold disabled:opacity-50 hover:bg-emerald-700 shadow-lg shadow-emerald-500/20"
                   >
                     生成請款單
                   </button>
                </div>
              </div>

              {saClient ? (
                <div className="overflow-x-auto border rounded-xl">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-emerald-50 text-emerald-700 font-bold">
                      <tr>
                        <th className="px-6 py-4">日期</th>
                        <th className="px-6 py-4">單號 / 櫃號</th>
                        <th className="px-6 py-4">品名</th>
                        <th className="px-6 py-4 text-right">金額</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-emerald-100">
                      {saFilteredOrders.map((row) => (
                        <tr key={row.id} className="hover:bg-emerald-50/30">
                          <td className="px-6 py-3 font-mono">{row['日期']}</td>
                          <td className="px-6 py-3 font-bold">{row['單號']} <span className="text-slate-400 text-xs ml-2">{row['櫃號']}</span></td>
                          <td className="px-6 py-3">{row['品名'] || 'General Item'}</td>
                          <td className="px-6 py-3 text-right font-mono font-bold">
                             {(Number(row['總價']) || (Number(row['數量'])*Number(row['單價']))).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                      {saFilteredOrders.length === 0 && <tr><td colSpan="4" className="p-8 text-center text-slate-400">此客戶無訂單資料</td></tr>}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-24 text-slate-400 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                  <FileText className="w-16 h-16 mx-auto mb-4 opacity-20"/>
                  <p>請先從上方選單選擇一位客戶</p>
                </div>
              )}
            </div>
          )}

          {/* 2. Analysis View (Red/Blue Charts) */}
          {viewMode === 'client' && (
             <div className="p-6 space-y-6">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><PieChart className="w-5 h-5 text-purple-600"/> 客戶營收結構分析</h2>
                {clientStats.map((client) => {
                  const maxTotal = clientStats[0]?.total || 1; 
                  const widthPercent = (client.total / maxTotal) * 100;
                  const chinaPercent = (client.china / client.total) * 100;
                  const whPercent = (client.warehouse / client.total) * 100;
                  return (
                    <div key={client.name} className="group">
                      <div className="flex justify-between items-end mb-1">
                        <span className="font-bold text-slate-700 text-sm">{client.name}</span>
                        <span className="font-mono font-bold text-slate-800">{formatCurrency(client.total)}</span>
                      </div>
                      <div className="h-6 w-full bg-slate-100 rounded-full overflow-hidden flex relative">
                         <div style={{ width: `${whPercent}%` }} className="h-full bg-blue-500 flex items-center justify-center relative">{whPercent > 10 && <span className="text-[10px] text-white font-bold">{formatCurrency(client.warehouse)}</span>}</div>
                         <div style={{ width: `${chinaPercent}%` }} className="h-full bg-red-500 flex items-center justify-center relative">{chinaPercent > 10 && <span className="text-[10px] text-white font-bold">{formatCurrency(client.china)}</span>}</div>
                      </div>
                    </div>
                  );
                })}
             </div>
          )}

          {/* 3. List View */}
          {viewMode === 'list' && (
            <div className="overflow-x-auto">
              <div className="p-4 bg-slate-50 border-b flex items-center gap-2"><Search className="w-4 h-4 text-slate-400"/><input type="text" placeholder="搜尋..." className="bg-transparent outline-none text-sm w-full" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/></div>
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 font-medium border-b">
                  <tr><th className="px-6 py-4">日期</th><th className="px-6 py-4">櫃號</th><th className="px-6 py-4">單號</th><th className="px-6 py-4">出貨地</th><th className="px-6 py-4">客戶</th><th className="px-6 py-4 text-right">總價</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {masterData.filter(i => Object.values(i).some(v => String(v).toLowerCase().includes(searchTerm.toLowerCase()))).map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td className="px-6 py-3 font-mono text-slate-500">{row['日期']}</td>
                      <td className="px-6 py-3 font-bold text-slate-700">{row['櫃號']}</td>
                      <td className="px-6 py-3">{row['單號']}</td>
                      <td className="px-6 py-3 text-xs">{row['出貨地'] === 'CN' ? <span className="text-red-600 bg-red-50 px-2 py-1 rounded">China</span> : 'Warehouse'}</td>
                      <td className="px-6 py-3 font-bold">{row['客戶']}</td>
                      <td className="px-6 py-3 text-right font-mono font-bold text-emerald-600">{(Number(row['總價']) || (Number(row['數量'])*Number(row['單價']))).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 4. Settings View */}
          {viewMode === 'settings' && (
             <div className="p-6">
                <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><History className="w-5 h-5"/> 上傳紀錄管理</h2>
                <div className="border rounded-xl overflow-hidden">
                   {uploadHistory.map(log => (
                     <div key={log.id} className="flex justify-between items-center p-4 border-b hover:bg-slate-50">
                        <div>
                          <p className="font-bold text-slate-700">{log.fileName}</p>
                          <p className="text-xs text-slate-400">{new Date(log.timestamp).toLocaleString()} • {log.count} 筆 • {log.type}</p>
                        </div>
                        <button onClick={() => handleDeleteBatch(log.id)} className="text-red-500 hover:bg-red-50 p-2 rounded"><Trash2 className="w-4 h-4"/></button>
                     </div>
                   ))}
                   {uploadHistory.length === 0 && <p className="p-8 text-center text-slate-400">無紀錄</p>}
                </div>
             </div>
          )}
        </div>
      </main>

      {/* Modals */}
      <AiModal show={showAiModal} onClose={() => setShowAiModal(false)} prompt={aiPrompt} setPrompt={setAiPrompt} onSend={handleAiAnalysis} response={aiResponse} loading={isAiLoading} />
      <ManualAddModal show={showManualModal} onClose={() => setShowManualModal(false)} onSave={handleManualSave} />
      <SaPreviewModal show={showSaPreview} onClose={() => setShowSaPreview(false)} client={saClient} orders={saFilteredOrders} />
    </div>
  );
};

export default App;