import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  FileText, Upload, Printer, ChevronRight, Hash, 
  ArrowLeft, Settings, Search,
  CheckCircle2, FileSpreadsheet,
  Table as TableIcon, LayoutDashboard, Edit3, X, Trash,
  Download, Database, Layers, Sparkles, MessageSquare, Loader2,
  TrendingUp, BarChart3, Calculator,
  Cloud, CloudOff, LogOut, Lock, Globe, Container, PlusCircle, Save, History, Trash2, PieChart
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInAnonymously, onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, writeBatch, query, orderBy, where, getDocs
} from 'firebase/firestore';

// --- AI Modal ---
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
    setLoading(true); await onSave(containerNo, amount); setLoading(false);
    setContainerNo(''); setAmount(''); onClose();
  };
  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-800">手動新增中國直出</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div><label className="block text-sm font-medium mb-1">櫃號</label><input type="text" className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500" value={containerNo} onChange={e => setContainerNo(e.target.value)} /></div>
          <div><label className="block text-sm font-medium mb-1">金額</label><input type="number" className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500" value={amount} onChange={e => setAmount(e.target.value)} /></div>
        </div>
        <div className="p-4 bg-slate-50 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg">取消</button>
          <button onClick={handleSubmit} disabled={loading} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2">{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 儲存</button>
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
                    {order['單號']}<br/><span className="text-xs text-slate-400">{order['櫃號']} {order['出貨地'] === 'CN' ? '(CN)' : ''}</span>
                  </td>
                  <td className="py-3 text-slate-600">{order['品名'] || 'General Item'}</td>
                  
                  {/* 印出自動換算後的明細，例如: 50*2R+45=145Y */}
                  <td className="py-3 text-right font-bold text-slate-800 whitespace-nowrap">
                    {order['數量明細'] || Number(order['數量']).toLocaleString()}
                  </td>
                  
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
                <span>Total:</span><span>USD {total.toLocaleString()}</span>
              </div>
            </div>
          </div>
          <div className="absolute bottom-8 left-8 right-8 text-center text-xs text-slate-400">Thank you for your business.</div>
        </div>
      </div>
    </div>
  );
};

const App = () => {
  // --- 🚨 1. 請填回您的 AI Key 🚨 ---
  const apiKey = "AIzaSyD6v4BGNqEzJwAUlSmijajj_jUU715wnXc"; 

  // --- 🚨 2. 請填回您的 Firebase Config 🚨 ---
  const firebaseConfig = {
    apiKey: "AIzaSyDsGkGsWS4sRIn3o9XzWmqGSbZg4i5Dc9g",
  authDomain: "sa-test-96792.firebaseapp.com",
  projectId: "sa-test-96792",
  storageBucket: "sa-test-96792.firebasestorage.app",
  messagingSenderId: "736271192466",
  appId: "1:736271192466:web:1517c3d40e3e61d1c1b14b",
  measurementId: "G-1X3X3FWSM7"
};

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  const [user, setUser] = useState(null);
  const [masterData, setMasterData] = useState([]); 
  const [uploadHistory, setUploadHistory] = useState([]);
  
  const [viewMode, setViewMode] = useState('sa'); 
  const [isUploading, setIsUploading] = useState(false); 

  const [searchTerm, setSearchTerm] = useState('');
  const [saClient, setSaClient] = useState('');
  const [showSaPreview, setShowSaPreview] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
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
    const unsubHistory = onSnapshot(query(collection(db, 'upload_logs'), orderBy('timestamp', 'desc')), snap => {
      setUploadHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubOrders(); unsubHistory(); };
  }, []);

  const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(val) || 0);
  const isChinaOrder = (o) => ['CN', 'China', '中國'].some(k => String(o['出貨地']||o['Origin']||'').includes(k));

  const handleManualSave = async (containerNo, amount) => {
    const batchId = `Manual-${Date.now()}`;
    const orderId = `CN-Manual-${Date.now()}`;
    await setDoc(doc(db, "orders", orderId), {
      batchId, fileName: '手動輸入', '單號': orderId, '日期': new Date().toISOString().split('T')[0],
      '櫃號': containerNo, '客戶': '🇨🇳 中國直出', '出貨地': 'CN', '總價': Number(amount),
      '數量': 1, '數量明細': '1', '單價': Number(amount), '品名': 'Direct Shipment'
    });
    await setDoc(doc(db, 'upload_logs', batchId), { id: batchId, fileName: `手動: ${containerNo}`, timestamp: Date.now(), count: 1, type: 'Manual' });
    alert('新增成功！');
  };

  const handleDeleteBatch = async (batchId) => {
    if (!window.confirm('確定刪除這批紀錄？該次匯入的所有訂單都會消失喔！')) return;
    try {
      const snap = await getDocs(query(collection(db, 'orders'), where('batchId', '==', batchId)));
      const batch = writeBatch(db);
      snap.docs.forEach((doc) => batch.delete(doc.ref));
      batch.delete(doc(db, 'upload_logs', batchId));
      await batch.commit();
    } catch (error) { alert('刪除失敗：' + error.message); }
  };

  // --- 🌟 自動判斷每捲碼數 (YPR) 的邏輯 ---
  const getRollSize = (itemName) => {
    const name = String(itemName || '').toUpperCase();
    if (name.includes('210 PU') || name.includes('210D PU')) return 150;
    if (name.includes('CHACK FACE') || name.includes('CRACKED FACE')) return 40;
    if (name.includes('KEVLAR')) return 40;
    if (name.includes('LACOSTE')) return 40;
    if (name.includes('VACUUM')) return 40;
    if (name.includes('CHECKER')) return 40;
    if (name.includes('385')) return 40;
    if (name.includes('305')) return 40;
    return 50; // 預設 50Y/R
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
      const rows = text.split('\n').map(r => r.trim()).filter(r => r);
      const headers = rows[0].split(',').map(h => h.trim());
      const batch = writeBatch(db);
      let count = 0;
      const isSimpleChina = headers.includes('櫃號') && headers.includes('金額') && headers.length <= 4;

      for (let i = 1; i < rows.length; i++) {
        const values = rows[i].split(',');
        if (values.length < 2) continue;
        const rowData = { batchId, fileName }; 
        
        if (isSimpleChina) {
          rowData['櫃號'] = values[headers.indexOf('櫃號')]?.trim();
          rowData['總價'] = Number(values[headers.indexOf('金額')]?.trim()) || 0;
          rowData['數量'] = 1; rowData['數量明細'] = '1'; rowData['單價'] = rowData['總價'];
          rowData['客戶'] = '🇨🇳 中國直出'; rowData['出貨地'] = 'CN';
          rowData['日期'] = new Date().toISOString().split('T')[0];
          rowData['單號'] = `Auto-CN-${batchId}-${i}`;
        } else {
          headers.forEach((header, index) => {
            rowData[header] = values[index]?.trim();
          });

          // 🌟 處理數量的轉換邏輯
          const qtyVal = rowData['數量'] || '';
          if (qtyVal.includes('=') || qtyVal.includes('＝')) {
            rowData['數量明細'] = qtyVal;
            rowData['數量'] = parseFloat(qtyVal.split(/=|＝/)[1].replace(/[^0-9.-]/g, '')) || 0;
          } else {
            let totalQty = parseFloat(qtyVal.replace(/[^0-9.-]/g, '')) || 0;
            rowData['數量'] = totalQty;
            
            if (totalQty > 0) {
              let ypr = getRollSize(rowData['品名']); 
              let rolls = Math.floor(totalQty / ypr);
              let remainder = Math.round((totalQty - (rolls * ypr)) * 100) / 100; 
              
              if (rolls > 0 && remainder > 0) {
                rowData['數量明細'] = `${ypr}*${rolls}R+${remainder}=${totalQty}Y`;
              } else if (rolls > 0 && remainder === 0) {
                rowData['數量明細'] = `${ypr}*${rolls}R=${totalQty}Y`;
              } else {
                rowData['數量明細'] = `${totalQty}Y`; 
              }
            } else {
              rowData['數量明細'] = qtyVal; 
            }
          }
          
          rowData['單價'] = Number(rowData['單價']) || 0;
          rowData['單號'] = rowData['單號'] || rowData['訂單編號'] || `AutoID-${Date.now()}-${i}`;
        }
        
        const docRef = doc(db, "orders", String(rowData['單號']));
        batch.set(docRef, rowData, { merge: true }); count++;
      }
      batch.set(doc(db, 'upload_logs', batchId), { id: batchId, fileName, timestamp: Date.now(), count, type: 'Upload' });
      await batch.commit();
      alert(`成功匯入 ${count} 筆！`);
      setIsUploading(false);
    };
    reader.readAsText(file);
  };

  const handleAiAnalysis = async () => { /* AI Logic */ };

  const clients = useMemo(() => ['ALL', ...new Set(masterData.map(o => o['客戶']).filter(Boolean))].sort(), [masterData]);
  const saFilteredOrders = useMemo(() => saClient && saClient !== 'ALL' ? masterData.filter(o => o['客戶'] === saClient) : [], [saClient, masterData]);
  
  const clientStats = useMemo(() => {
    const stats = {};
    masterData.forEach(o => {
      const name = (o['客戶']||'Unknown').trim();
      const amt = Number(o['總價']) || (Number(o['數量'])*Number(o['單價'])) || 0;
      if (!stats[name]) stats[name] = { name, total: 0, china: 0, warehouse: 0 };
      stats[name].total += amt;
      isChinaOrder(o) ? stats[name].china += amt : stats[name].warehouse += amt;
    });
    return Object.values(stats).sort((a,b) => b.total - a.total);
  }, [masterData]);

  return (
    <div className="min-h-screen bg-[#F4F7F6] font-sans text-slate-600">
      <nav className="bg-[#0F172A] text-white px-6 py-4 shadow-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="bg-emerald-500 p-2 rounded-lg shadow-lg"><Layers className="w-6 h-6 text-white" /></div>
            <h1 className="text-xl font-bold tracking-wide">EVERISE <span className="text-emerald-400 text-xs px-2 border rounded-full">V21.0</span></h1>
          </div>
          <div className="flex items-center gap-3">
             <button onClick={() => setShowManualModal(true)} className="bg-orange-500 hover:bg-orange-600 px-3 py-2 rounded-lg flex items-center gap-2 font-bold shadow-lg text-white"><PlusCircle className="w-4 h-4"/> 手動記帳</button>
             <button onClick={() => { setShowAiModal(true); setAiResponse(''); }} className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg text-white"><Sparkles className="w-4 h-4" /> AI</button>
            <div className="h-8 w-px bg-slate-700 mx-2"></div>
             <label className="cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg">
              {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              <span className="font-medium">{isUploading ? '處理中...' : '匯入資料'}</span>
              <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
            </label>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex flex-wrap gap-2 bg-white p-2 rounded-xl shadow-sm w-full md:w-fit">
          <button onClick={() => setViewMode('sa')} className={`px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${viewMode === 'sa' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}><FileText className="w-4 h-4"/> 📄 SA 請款單</button>
          <button onClick={() => setViewMode('list')} className={`px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${viewMode === 'list' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}><TableIcon className="w-4 h-4"/> 📋 年度明細</button>
          <button onClick={() => setViewMode('client')} className={`px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${viewMode === 'client' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}><PieChart className="w-4 h-4"/> 📊 營業額總攬</button>
          <button onClick={() => setViewMode('settings')} className={`px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${viewMode === 'settings' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}><History className="w-4 h-4"/> ⚙️ 資料來源管理</button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden min-h-[500px]">
          
          {/* SA 請款單 */}
          {viewMode === 'sa' && (
            <div className="p-8">
              <div className="flex flex-col md:flex-row justify-between items-center bg-emerald-50 p-6 rounded-xl border border-emerald-100 mb-6">
                <div>
                  <h2 className="text-2xl font-black text-emerald-800 mb-2">SA 請款單製作</h2>
                  <p className="text-emerald-600 text-sm">請選擇客戶以生成並列印請款單</p>
                </div>
                <div className="flex gap-3 mt-4 md:mt-0">
                   <select className="border border-emerald-200 rounded-lg px-4 py-3 bg-white font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 min-w-[200px]" value={saClient} onChange={e => setSaClient(e.target.value)}>
                     <option value="">-- 請選擇客戶 --</option>
                     {clientStats.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                   </select>
                   <button onClick={() => setShowSaPreview(true)} disabled={!saClient} className="bg-emerald-600 text-white px-6 py-3 rounded-lg font-bold disabled:opacity-50 hover:bg-emerald-700 shadow-lg">
                     預覽並列印
                   </button>
                </div>
              </div>
              
              {saClient && (
                <div className="overflow-x-auto border rounded-xl">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-600 font-bold border-b">
                      <tr><th className="px-6 py-4">日期</th><th className="px-6 py-4">單號 / 櫃號</th><th className="px-6 py-4">品名</th><th className="px-6 py-4 text-right">數量明細</th><th className="px-6 py-4 text-right">總價</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {saFilteredOrders.map(row => (
                        <tr key={row.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4 font-mono">{row['日期']}</td>
                          <td className="px-6 py-4 font-bold">{row['單號']} <span className="text-slate-400 text-xs ml-2">{row['櫃號']}</span></td>
                          <td className="px-6 py-4">{row['品名'] || '-'}</td>
                          <td className="px-6 py-4 text-right font-bold text-blue-600">{row['數量明細'] || Number(row['數量']).toLocaleString()}</td>
                          <td className="px-6 py-4 text-right font-mono font-bold text-emerald-600">{(Number(row['總價']) || (Number(row['數量'])*Number(row['單價']))).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 年度明細 */}
          {viewMode === 'list' && (
            <div>
              <div className="p-4 bg-slate-50 border-b flex items-center gap-2"><Search className="w-4 h-4 text-slate-400"/><input type="text" placeholder="搜尋任何資料..." className="bg-transparent outline-none text-sm w-full" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/></div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 font-medium border-b">
                    <tr><th className="px-6 py-4">日期</th><th className="px-6 py-4">單號</th><th className="px-6 py-4">出貨地</th><th className="px-6 py-4">客戶</th><th className="px-6 py-4 text-right">數量</th><th className="px-6 py-4 text-right">總價</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {masterData.filter(i => Object.values(i).some(v => String(v).toLowerCase().includes(searchTerm.toLowerCase()))).map(row => (
                      <tr key={row.id} className="hover:bg-slate-50">
                        <td className="px-6 py-3 font-mono text-slate-500">{row['日期']}</td>
                        <td className="px-6 py-3 font-bold">{row['單號']}</td>
                        <td className="px-6 py-3">{isChinaOrder(row) ? <span className="text-red-600 bg-red-50 px-2 py-1 rounded font-bold">China</span> : 'Warehouse'}</td>
                        <td className="px-6 py-3 font-bold">{row['客戶']}</td>
                        <td className="px-6 py-3 text-right text-slate-500">{row['數量明細'] || Number(row['數量']).toLocaleString()}</td>
                        <td className="px-6 py-3 text-right font-mono font-bold text-emerald-600">{(Number(row['總價']) || (Number(row['數量'])*Number(row['單價']))).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 營業額總攬 */}
          {viewMode === 'client' && (
             <div className="p-8 space-y-6">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-6"><PieChart className="w-6 h-6 text-purple-600"/> 營業額結構分析 (紅藍圖)</h2>
                {clientStats.map(client => {
                  const max = clientStats[0]?.total || 1; 
                  const wP = (client.warehouse/client.total)*100;
                  const cP = (client.china/client.total)*100;
                  return (
                    <div key={client.name} className="group mb-4">
                      <div className="flex justify-between items-end mb-1"><span className="font-bold text-slate-700">{client.name}</span><span className="font-mono font-bold">{formatCurrency(client.total)}</span></div>
                      <div className="h-6 w-full bg-slate-100 rounded-full overflow-hidden flex"><div style={{width:`${wP}%`}} className="bg-blue-500 flex items-center justify-center">{wP>10 && <span className="text-[10px] text-white font-bold">{formatCurrency(client.warehouse)}</span>}</div><div style={{width:`${cP}%`}} className="bg-red-500 flex items-center justify-center">{cP>10 && <span className="text-[10px] text-white font-bold">{formatCurrency(client.china)}</span>}</div></div>
                    </div>
                  );
                })}
             </div>
          )}

          {/* 資料來源管理 */}
          {viewMode === 'settings' && (
             <div className="p-8">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><History className="w-6 h-6 text-blue-600"/> 匯入紀錄與資料來源</h2>
                  <span className="text-sm bg-yellow-100 text-yellow-800 px-4 py-2 rounded-lg font-bold">💡 如果資料重複，請刪除舊的匯入紀錄</span>
                </div>
                <div className="border rounded-xl overflow-hidden">
                   <table className="w-full text-sm text-left">
                     <thead className="bg-slate-50 border-b"><tr><th className="p-4">匯入時間</th><th className="p-4">檔案/來源</th><th className="p-4">筆數</th><th className="p-4 text-right">操作</th></tr></thead>
                     <tbody className="divide-y">
                       {uploadHistory.map(log => (
                         <tr key={log.id} className="hover:bg-slate-50">
                            <td className="p-4 text-slate-500">{new Date(log.timestamp).toLocaleString()}</td>
                            <td className="p-4 font-bold text-slate-700">{log.fileName} <span className="text-xs bg-slate-200 px-2 py-0.5 rounded ml-2">{log.type}</span></td>
                            <td className="p-4">{log.count} 筆</td>
                            <td className="p-4 text-right"><button onClick={() => handleDeleteBatch(log.id)} className="text-red-500 hover:bg-red-50 px-3 py-1.5 border border-red-200 rounded flex items-center gap-1 ml-auto"><Trash2 className="w-3 h-3"/> 刪除整批</button></td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                </div>
             </div>
          )}
        </div>
      </main>

      <AiModal show={showAiModal} onClose={() => setShowAiModal(false)} prompt={aiPrompt} setPrompt={setAiPrompt} onSend={handleAiAnalysis} response={aiResponse} loading={isAiLoading} />
      <ManualAddModal show={showManualModal} onClose={() => setShowManualModal(false)} onSave={handleManualSave} />
      <SaPreviewModal show={showSaPreview} onClose={() => setShowSaPreview(false)} client={saClient} orders={saFilteredOrders} />
    </div>
  );
};

export default App;