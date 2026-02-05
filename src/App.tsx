import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  FileText, Upload, Printer, ChevronRight, Hash, 
  ArrowLeft, Settings, Search,
  CheckCircle2, FileSpreadsheet,
  Table as TableIcon, LayoutDashboard, Edit3, X, Trash,
  Download, Database, Layers, Sparkles, MessageSquare, Loader2,
  TrendingUp, BarChart3, Calculator,
  Cloud, CloudOff, LogOut, Lock, Globe, Container, PieChart, Users, History, Trash2
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, signInAnonymously 
} from 'firebase/auth';
import { 
  getFirestore, collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, writeBatch, query, where, getDocs, orderBy
} from 'firebase/firestore';

// --- 獨立的 AI Modal 組件 ---
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
              <p className="text-xs mt-2">例如：「PAT 客人的中國直出比例高嗎？」</p>
            </div>
          )}
        </div>
        <div className="p-4 bg-white border-t flex gap-2">
          <input 
            type="text" 
            className="flex-1 border rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 focus:outline-none"
            placeholder="輸入您的問題..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSend()}
            autoFocus
          />
          <button 
            onClick={onSend}
            disabled={loading || !prompt}
            className="bg-purple-600 text-white px-6 py-2 rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
            {loading ? '分析中...' : '送出'}
          </button>
        </div>
      </div>
    </div>
  );
};

const App = () => {
  // --- 請在此填入您的 Key ---
  const apiKey = "AIzaSyAxuPefSSv7M2iJKtE-rXkx1m3mJIhe9oY"; 

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

  // --- State ---
  const [user, setUser] = useState(null);
  const [masterData, setMasterData] = useState([]); 
  const [uploadHistory, setUploadHistory] = useState([]);
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'client' | 'settings'
  const [isUploading, setIsUploading] = useState(false); 

  // UI State
  const [searchTerm, setSearchTerm] = useState('');

  // AI State
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  // --- Auth Listener ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) signInAnonymously(auth);
    });
    return () => unsubscribe();
  }, []);

  // --- Real-time Data Sync ---
  useEffect(() => {
    // 1. 訂單資料
    const unsubOrders = onSnapshot(collection(db, 'orders'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => new Date(b['日期']) - new Date(a['日期']));
      setMasterData(data);
    });

    // 2. 上傳紀錄 (V15.0 New)
    const q = query(collection(db, 'upload_logs'), orderBy('timestamp', 'desc'));
    const unsubHistory = onSnapshot(q, (snapshot) => {
      const history = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUploadHistory(history);
    });

    return () => { unsubOrders(); unsubHistory(); };
  }, []);

  // --- Helpers ---
  const formatCurrency = (val, currency = 'USD') => {
    const num = Number(val) || 0;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(num);
  };

  const isChinaOrder = (order) => {
    const origin = String(order['出貨地'] || order['Origin'] || '');
    return ['CN', 'China', '中國', 'Shanghai', 'Guangzhou'].some(k => origin.includes(k)) || origin.includes('FROM CHINA');
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('zh-TW');
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    return new Date(ts).toLocaleString('zh-TW');
  };

  // --- 刪除整批上傳 (V15.0 核心功能) ---
  const handleDeleteBatch = async (batchId) => {
    if (!window.confirm('確定要刪除這批上傳紀錄嗎？\n這將會移除該次上傳的所有訂單資料。')) return;
    
    try {
      // 1. 找出該批次的所有訂單
      const q = query(collection(db, 'orders'), where('batchId', '==', batchId));
      const snapshot = await getDocs(q);
      
      // 2. 批次刪除
      const batch = writeBatch(db);
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      // 3. 刪除紀錄檔
      batch.delete(doc(db, 'upload_logs', batchId));
      
      await batch.commit();
      alert(`成功刪除 ${snapshot.size} 筆資料！`);
    } catch (error) {
      console.error(error);
      alert('刪除失敗：' + error.message);
    }
  };

  // --- 客戶數據分析 ---
  const clientStats = useMemo(() => {
    const stats = {};
    masterData.forEach(order => {
      const clientName = (order['客戶'] || 'Unknown').trim();
      const amount = Number(order['數量']) * Number(order['單價']) || Number(order['總價']) || 0;
      if (!stats[clientName]) stats[clientName] = { name: clientName, total: 0, china: 0, warehouse: 0, ordersCount: 0 };
      stats[clientName].total += amount;
      stats[clientName].ordersCount += 1;
      if (isChinaOrder(order)) stats[clientName].china += amount;
      else stats[clientName].warehouse += amount;
    });
    return Object.values(stats).filter(c => c.total > 0).sort((a, b) => b.total - a.total);
  }, [masterData]);

  // --- 智能匯入邏輯 (V15.0 三通道) ---
  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const fileName = file.name;
    const batchId = Date.now().toString(); // 產生批次 ID
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result;
      const rows = text.split('\n').map(row => row.trim()).filter(row => row);
      const headers = rows[0].split(',').map(h => h.trim());
      
      const batch = writeBatch(db);
      let count = 0;

      // 判斷格式
      const isMonthlyReport = headers.some(h => h.includes('請款金額') || h.includes('No.'));
      // V15.0 New: 判斷是否為「簡易中國直出」 (只有 櫃號 + 金額)
      const isSimpleChina = headers.length <= 4 && headers.includes('櫃號') && headers.includes('金額');

      for (let i = 1; i < rows.length; i++) {
        const values = rows[i].split(',');
        if (values.length < 2) continue; 

        const rowData = { batchId, fileName }; // 標記批次ID

        if (isSimpleChina) {
          // --- 通道 C: 簡易中國直出 (V15.0 New) ---
          const containerIdx = headers.indexOf('櫃號');
          const amountIdx = headers.indexOf('金額');
          
          rowData['櫃號'] = values[containerIdx]?.trim() || '-';
          rowData['總價'] = Number(values[amountIdx]?.trim()) || 0;
          rowData['數量'] = 1;
          rowData['單價'] = rowData['總價'];
          rowData['客戶'] = '🇨🇳 中國直出'; // 自動歸類
          rowData['出貨地'] = 'CN';
          rowData['日期'] = new Date().toISOString().split('T')[0]; // 今天
          rowData['單號'] = `CN-Fast-${batchId}-${i}`;

        } else if (isMonthlyReport) {
          // --- 通道 B: 月結報表 ---
          const rawClient = values[1]?.trim();
          if (!rawClient) continue;
          rowData['客戶'] = rawClient;
          const rawAmount = values[2]?.replace(/[A-Za-z,]/g, '').trim();
          rowData['總價'] = Number(rawAmount) || 0;
          rowData['數量'] = 1;
          rowData['單價'] = rowData['總價'];
          const remark = values[3]?.toUpperCase() || '';
          if (remark.includes('CHINA') || remark.includes('CN')) rowData['出貨地'] = 'CN';
          else rowData['出貨地'] = 'TW';
          rowData['單號'] = `Auto-${fileName}-${i}`;
          rowData['日期'] = fileName.replace('.csv', '') || new Date().toISOString().split('T')[0];
          rowData['櫃號'] = '-';

        } else {
          // --- 通道 A: 標準明細 ---
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

      // 寫入上傳紀錄
      batch.set(doc(db, 'upload_logs', batchId), {
        id: batchId,
        fileName,
        timestamp: Date.now(),
        count,
        type: isSimpleChina ? 'China Fast' : (isMonthlyReport ? 'Monthly Report' : 'Standard')
      });

      try {
        await batch.commit();
        alert(`成功匯入 ${count} 筆資料！\n批次ID: ${batchId}`);
      } catch (error) {
        alert("匯入失敗：" + error.message);
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsText(file);
  };

  const handleAiAnalysis = async () => {
    if (!prompt && !aiPrompt) return;
    setIsAiLoading(true);
    const question = aiPrompt || "請分析目前的訂單狀況";
    const dataSummary = JSON.stringify(masterData.slice(0, 50)); 
    const context = `資料庫有 ${masterData.length} 筆訂單。前50筆樣本: ${dataSummary}。請回答: "${question}"。`;

    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: context }] }] })
      });
      const data = await res.json();
      setAiResponse(data.candidates?.[0]?.content?.parts?.[0]?.text || "AI 無法回答");
    } catch (error) {
      setAiResponse("連線錯誤：" + error.message);
    } finally {
      setIsAiLoading(false);
    }
  };

  const globalStats = useMemo(() => {
    const totalRev = masterData.reduce((sum, item) => sum + (Number(item['數量']) * Number(item['單價']) || Number(item['總價']) || 0), 0);
    const chinaOrders = masterData.filter(isChinaOrder);
    const chinaRev = chinaOrders.reduce((sum, item) => sum + (Number(item['數量']) * Number(item['單價']) || Number(item['總價']) || 0), 0);
    return { totalRev, totalOrders: masterData.length, chinaRev, chinaCount: chinaOrders.length };
  }, [masterData]);

  return (
    <div className="min-h-screen bg-[#F4F7F6] font-sans text-slate-600">
      {/* Navbar */}
      <nav className="bg-[#0F172A] text-white px-6 py-4 shadow-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="bg-emerald-500 p-2 rounded-lg shadow-lg shadow-emerald-500/20">
              <Layers className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-wide flex items-center gap-2">
                EVERISE <span className="text-emerald-400 text-xs bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">V15.0 Ultimate</span>
              </h1>
              <p className="text-xs text-slate-400">旗艦版：批次管理 & 智能匯入</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <button onClick={() => { setShowAiModal(true); setAiResponse(''); }} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-lg shadow-purple-600/20">
              <Sparkles className="w-4 h-4" /> AI 分析
            </button>
            <div className="h-8 w-px bg-slate-700 mx-2"></div>
             <label className="cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-lg shadow-emerald-600/20">
              {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              <span className="font-medium">{isUploading ? '處理中...' : '匯入 CSV'}</span>
              <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
            </label>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition-shadow">
            <div className="p-4 bg-blue-50 text-blue-600 rounded-xl"><BarChart3 className="w-8 h-8" /></div>
            <div>
              <p className="text-sm text-slate-400 font-medium">總營收</p>
              <h3 className="text-2xl font-black text-slate-800">{formatCurrency(globalStats.totalRev)}</h3>
              <p className="text-xs text-blue-600 flex items-center mt-1">{globalStats.totalOrders} 筆訂單</p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition-shadow border-l-4 border-l-red-500">
            <div className="p-4 bg-red-50 text-red-600 rounded-xl"><Globe className="w-8 h-8" /></div>
            <div>
              <p className="text-sm text-slate-400 font-medium">中國直出 (CN)</p>
              <h3 className="text-2xl font-black text-slate-800">{formatCurrency(globalStats.chinaRev)}</h3>
              <p className="text-xs text-red-600 flex items-center mt-1">佔比 {((globalStats.chinaRev/globalStats.totalRev)*100 || 0).toFixed(1)}%</p>
            </div>
          </div>
           <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition-shadow">
            <div className="p-4 bg-orange-50 text-orange-600 rounded-xl"><Users className="w-8 h-8" /></div>
            <div>
              <p className="text-sm text-slate-400 font-medium">活躍客戶數</p>
              <h3 className="text-2xl font-black text-slate-800">{clientStats.length}</h3>
              <p className="text-xs text-slate-400 mt-1">已自動合併歸戶</p>
            </div>
          </div>
        </div>

        {/* Mode Switcher */}
        <div className="flex gap-2 bg-slate-200/50 p-1 rounded-xl w-fit">
          <button 
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${viewMode === 'list' ? 'bg-white shadow text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <TableIcon className="w-4 h-4" /> 訂單明細
          </button>
          <button 
            onClick={() => setViewMode('client')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${viewMode === 'client' ? 'bg-white shadow text-purple-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <PieChart className="w-4 h-4" /> 客戶營收分析
          </button>
           <button 
            onClick={() => setViewMode('settings')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${viewMode === 'settings' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Settings className="w-4 h-4" /> 設定與管理
          </button>
        </div>

        {/* Content Area */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden min-h-[500px]">
          
          {/* 1. 客戶分析模式 */}
          {viewMode === 'client' && (
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-purple-600" /> 客戶採購分佈圖
                </h2>
                <div className="flex gap-4 text-xs font-bold">
                  <span className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-500 rounded-sm"></div> 倉庫 (Warehouse)</span>
                  <span className="flex items-center gap-1"><div className="w-3 h-3 bg-red-500 rounded-sm"></div> 中國直出 (China)</span>
                </div>
              </div>

              <div className="space-y-6">
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
                         <div style={{ width: `${whPercent}%` }} className="h-full bg-blue-500 group-hover:bg-blue-600 transition-all flex items-center justify-center relative">
                           {whPercent > 10 && <span className="text-[10px] text-white font-bold">{formatCurrency(client.warehouse)}</span>}
                         </div>
                         <div style={{ width: `${chinaPercent}%` }} className="h-full bg-red-500 group-hover:bg-red-600 transition-all flex items-center justify-center relative">
                            {chinaPercent > 10 && <span className="text-[10px] text-white font-bold">{formatCurrency(client.china)}</span>}
                         </div>
                      </div>
                      <div className="flex justify-between mt-1 text-[10px] text-slate-400">
                         <span>總訂單: {client.ordersCount} 筆</span>
                         <span className="flex gap-2">
                           <span className="text-blue-500">倉庫: {whPercent.toFixed(0)}%</span>
                           <span className="text-red-500">中國: {chinaPercent.toFixed(0)}%</span>
                         </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. 訂單明細模式 */}
          {viewMode === 'list' && (
            <div>
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                 <div className="flex items-center gap-3">
                   <TableIcon className="w-5 h-5 text-slate-400" />
                   <h2 className="font-bold text-slate-700">訂單明細表</h2>
                 </div>
                 <div className="relative">
                   <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                   <input 
                     type="text" 
                     placeholder="搜尋..." 
                     className="pl-9 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none w-64"
                     value={searchTerm}
                     onChange={(e) => setSearchTerm(e.target.value)}
                   />
                 </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 font-medium border-b">
                    <tr>
                      <th className="px-6 py-4">日期</th>
                      <th className="px-6 py-4">櫃號</th>
                      <th className="px-6 py-4">單號</th>
                      <th className="px-6 py-4">出貨地</th>
                      <th className="px-6 py-4">客戶</th>
                      <th className="px-6 py-4 text-right">總價</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {masterData.filter(item => Object.values(item).some(val => String(val).toLowerCase().includes(searchTerm.toLowerCase()))).map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-3 text-slate-500 font-mono">{formatDate(row['日期'])}</td>
                        <td className="px-6 py-3 text-slate-700 font-bold flex items-center gap-2"><Container className="w-4 h-4 text-slate-400" />{row['櫃號'] || '-'}</td>
                        <td className="px-6 py-3 font-medium text-slate-700">
                          {row['單號']}
                          {isChinaOrder(row) && <span className="ml-2 text-[10px] bg-red-100 text-red-600 px-1.5 rounded border border-red-200">CN</span>}
                        </td>
                         <td className="px-6 py-3 text-slate-500 text-xs">{row['出貨地'] || '-'}</td>
                        <td className="px-6 py-3 font-bold text-slate-700">{row['客戶']}</td>
                        <td className="px-6 py-3 text-right font-mono font-bold text-emerald-600">{formatCurrency(Number(row['總價'] || (Number(row['數量']) * Number(row['單價']))))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

           {/* 3. 設定與管理 (V15.0 New) */}
           {viewMode === 'settings' && (
            <div className="p-6">
               <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <History className="w-5 h-5 text-slate-600" /> 匯入紀錄管理
                </h2>
                <p className="text-xs text-slate-400">您可以刪除舊的匯入紀錄以解決資料重複問題</p>
              </div>

              <div className="bg-slate-50 rounded-xl border border-slate-100 overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-100 text-slate-500 font-medium border-b">
                    <tr>
                      <th className="px-6 py-4">匯入時間</th>
                      <th className="px-6 py-4">檔案名稱</th>
                      <th className="px-6 py-4">筆數</th>
                      <th className="px-6 py-4">類型</th>
                      <th className="px-6 py-4 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {uploadHistory.length === 0 ? (
                      <tr><td colSpan="5" className="px-6 py-8 text-center text-slate-400">目前沒有匯入紀錄</td></tr>
                    ) : (
                      uploadHistory.map((log) => (
                        <tr key={log.id} className="hover:bg-white transition-colors">
                          <td className="px-6 py-4 text-slate-600">{formatTime(log.timestamp)}</td>
                          <td className="px-6 py-4 font-bold text-slate-700">{log.fileName}</td>
                          <td className="px-6 py-4 text-slate-600">{log.count} 筆</td>
                          <td className="px-6 py-4">
                             <span className={`px-2 py-1 rounded text-xs font-bold border ${
                               log.type === 'China Fast' ? 'bg-red-50 text-red-600 border-red-200' : 
                               log.type === 'Monthly Report' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                               'bg-emerald-50 text-emerald-600 border-emerald-200'
                             }`}>
                               {log.type}
                             </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button 
                              onClick={() => handleDeleteBatch(log.id)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors flex items-center gap-1 ml-auto"
                            >
                              <Trash2 className="w-4 h-4" /> 刪除
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
           )}
        </div>
      </main>

      <AiModal show={showAiModal} onClose={() => setShowAiModal(false)} prompt={aiPrompt} setPrompt={setAiPrompt} onSend={handleAiAnalysis} response={aiResponse} loading={isAiLoading} />
    </div>
  );
};

export default App;