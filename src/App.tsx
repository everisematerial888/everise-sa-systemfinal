import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  FileText, Upload, Printer, ChevronRight, Hash, 
  ArrowLeft, Settings, Search,
  CheckCircle2, FileSpreadsheet,
  Table as TableIcon, LayoutDashboard, Edit3, X, Trash,
  Download, Database, Layers, Sparkles, MessageSquare, Loader2,
  TrendingUp, BarChart3, Calculator,
  Cloud, CloudOff, LogOut, Lock, Globe, Container, PlusCircle, Save, History, Trash2
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, signInAnonymously 
} from 'firebase/auth';
import { 
  getFirestore, collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, writeBatch, query, orderBy, where, getDocs
} from 'firebase/firestore';

// --- 獨立的 AI Modal (維持原樣) ---
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
            placeholder="輸入您的問題..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSend()}
          />
          <button 
            onClick={onSend}
            disabled={loading || !prompt}
            className="bg-purple-600 text-white px-6 py-2 rounded-lg font-bold disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
            送出
          </button>
        </div>
      </div>
    </div>
  );
};

// --- (新功能 1) 手動新增視窗 ---
const ManualAddModal = ({ show, onClose, onSave }) => {
  const [containerNo, setContainerNo] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  if (!show) return null;

  const handleSubmit = async () => {
    if (!containerNo || !amount) return alert('請填寫完整資訊');
    setLoading(true);
    await onSave(containerNo, amount);
    setLoading(false);
    setContainerNo('');
    setAmount('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-800">手動新增中國直出</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">櫃號 (Container No.)</label>
            <input 
              type="text" 
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
              placeholder="例如: CN-888"
              value={containerNo}
              onChange={e => setContainerNo(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">總金額 (Amount)</label>
            <input 
              type="number" 
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
              placeholder="例如: 50000"
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />
          </div>
        </div>
        <div className="p-4 bg-slate-50 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg font-medium">取消</button>
          <button 
            onClick={handleSubmit} 
            disabled={loading}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            儲存紀錄
          </button>
        </div>
      </div>
    </div>
  );
};

// --- (新功能 2) 匯入紀錄管理視窗 ---
const HistoryModal = ({ show, onClose, history, onDelete }) => {
  if (!show) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <History className="w-5 h-5" /> 匯入紀錄管理
          </h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-4 bg-yellow-50 text-yellow-800 text-sm border-b border-yellow-100">
           💡 提示：如果您發現資料匯入錯誤或重複，可以點擊紅色的刪除按鈕，該次匯入的所有訂單會整批消失。
        </div>
        <div className="flex-1 overflow-auto p-0">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b sticky top-0">
              <tr>
                <th className="px-6 py-4">時間</th>
                <th className="px-6 py-4">檔案名稱 / 備註</th>
                <th className="px-6 py-4">筆數</th>
                <th className="px-6 py-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.length === 0 ? (
                <tr><td colSpan="4" className="p-8 text-center text-slate-400">目前沒有紀錄</td></tr>
              ) : (
                history.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-slate-500">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="px-6 py-4 font-bold text-slate-700">{log.fileName}</td>
                    <td className="px-6 py-4">{log.count} 筆</td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => onDelete(log.id)}
                        className="text-red-500 hover:bg-red-50 hover:text-red-700 px-3 py-1.5 rounded border border-red-200 flex items-center gap-1 ml-auto transition-colors"
                      >
                        <Trash2 className="w-3 h-3" /> 刪除整批
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="p-4 bg-slate-50 border-t text-right">
          <button onClick={onClose} className="px-6 py-2 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-700">
            關閉
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
  const [isUploading, setIsUploading] = useState(false); 

  // UI State (維持您原本的 SA 邏輯)
  const [activeClient, setActiveClient] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // New Feature States
  const [showManualModal, setShowManualModal] = useState(false); // 手動視窗
  const [showHistoryModal, setShowHistoryModal] = useState(false); // 歷史紀錄視窗
  const [uploadHistory, setUploadHistory] = useState([]); // 歷史紀錄資料

  // AI State
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Auth
  useEffect(() => {
    onAuthStateChanged(auth, (u) => { setUser(u); if (!u) signInAnonymously(auth); });
  }, []);

  // Sync Data
  useEffect(() => {
    // 1. Sync Orders
    const unsubOrders = onSnapshot(collection(db, 'orders'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => new Date(b['日期']) - new Date(a['日期']));
      setMasterData(data);
    });

    // 2. Sync History (新功能)
    const qHistory = query(collection(db, 'upload_logs'), orderBy('timestamp', 'desc'));
    const unsubHistory = onSnapshot(qHistory, (snapshot) => {
      const history = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUploadHistory(history);
    });

    return () => { unsubOrders(); unsubHistory(); };
  }, []);

  // --- Helpers ---
  const formatCurrency = (val, currency = 'USD') => {
    const num = Number(val) || 0;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(num);
  };

  const isChinaOrder = (order) => {
    const origin = String(order['出貨地'] || order['Origin'] || '');
    return ['CN', 'China', '中國', 'Shanghai', 'Guangzhou'].some(k => origin.includes(k)) || origin.includes('FROM CHINA');
  };

  // --- (新功能) 手動儲存 ---
  const handleManualSave = async (containerNo, amount) => {
    const batchId = `Manual-${Date.now()}`;
    const orderId = `CN-Manual-${Date.now()}`;
    
    // 寫入訂單
    await setDoc(doc(db, "orders", orderId), {
      batchId, // 綁定批次ID，方便刪除
      fileName: '手動輸入',
      '單號': orderId,
      '日期': new Date().toISOString().split('T')[0],
      '櫃號': containerNo,
      '客戶': '🇨🇳 中國直出', 
      '出貨地': 'CN', 
      '總價': Number(amount),
      '數量': 1,
      '單價': Number(amount),
      '品名': 'Direct Shipment'
    });
    
    // 寫入紀錄
    await setDoc(doc(db, 'upload_logs', batchId), {
      id: batchId,
      fileName: `手動: ${containerNo}`,
      timestamp: Date.now(),
      count: 1,
      type: 'Manual'
    });
    
    alert('新增成功！');
  };

  // --- (新功能) 刪除整批 ---
  const handleDeleteBatch = async (batchId) => {
    if (!window.confirm('確定要刪除這筆紀錄嗎？\n該次匯入的所有訂單都會被移除。')) return;
    
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
      alert(`成功刪除！`);
    } catch (error) {
      alert('刪除失敗：' + error.message);
    }
  };

  // --- 匯入功能 (加入簡單版Excel判斷 + 批次ID) ---
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

      const isSimpleChina = headers.includes('櫃號') && headers.includes('金額') && headers.length <= 4;

      for (let i = 1; i < rows.length; i++) {
        const values = rows[i].split(',');
        if (values.length < 2) continue;

        const rowData = { batchId, fileName }; // 綁定批次
        
        if (isSimpleChina) {
          const containerIdx = headers.indexOf('櫃號');
          const amountIdx = headers.indexOf('金額');
          rowData['櫃號'] = values[containerIdx]?.trim();
          rowData['總價'] = Number(values[amountIdx]?.trim()) || 0;
          rowData['數量'] = 1; rowData['單價'] = rowData['總價'];
          rowData['客戶'] = '🇨🇳 中國直出';
          rowData['出貨地'] = 'CN';
          rowData['日期'] = new Date().toISOString().split('T')[0];
          rowData['單號'] = `Auto-CN-${batchId}-${i}`;
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

      // 寫入 Log
      batch.set(doc(db, 'upload_logs', batchId), {
        id: batchId, fileName, timestamp: Date.now(), count, type: 'Upload'
      });

      try {
        await batch.commit();
        alert(`成功匯入 ${count} 筆資料！`);
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
    const context = `資料庫有 ${masterData.length} 筆訂單。請回答: "${aiPrompt}"。`;
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: context }] }] })
      });
      const data = await res.json();
      setAiResponse(data.candidates?.[0]?.content?.parts?.[0]?.text || "AI 思考失敗");
    } catch (error) {
      setAiResponse("連線錯誤：" + error.message);
    } finally {
      setIsAiLoading(false);
    }
  };

  // --- 原本的篩選邏輯 ---
  const clients = useMemo(() => {
    const list = [...new Set(masterData.map(o => o['客戶']))].filter(Boolean).sort();
    return ['ALL', ...list];
  }, [masterData]);

  const filteredData = useMemo(() => {
    let data = masterData;
    if (activeClient && activeClient !== 'ALL') {
      data = data.filter(o => o['客戶'] === activeClient);
    }
    if (searchTerm) {
      data = data.filter(o => Object.values(o).some(v => String(v).toLowerCase().includes(searchTerm.toLowerCase())));
    }
    return data;
  }, [masterData, activeClient, searchTerm]);

  // --- Render ---
  return (
    <div className="min-h-screen bg-[#F4F7F6] font-sans text-slate-600">
      <nav className="bg-[#0F172A] text-white px-6 py-4 shadow-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="bg-emerald-500 p-2 rounded-lg shadow-lg shadow-emerald-500/20">
              <Layers className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-wide flex items-center gap-2">
                EVERISE <span className="text-emerald-400 text-xs bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">System</span>
              </h1>
              <p className="text-xs text-slate-400">訂單管理系統</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             {/* 新功能 1: 手動記帳 */}
             <button 
               onClick={() => setShowManualModal(true)}
               className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-lg flex items-center gap-2 font-bold transition-all shadow-lg"
             >
               <PlusCircle className="w-4 h-4" /> 手動記帳
             </button>

             {/* 新功能 2: 匯入紀錄管理 */}
             <button 
               onClick={() => setShowHistoryModal(true)}
               className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-lg flex items-center gap-2 font-bold transition-all shadow-lg"
             >
               <History className="w-4 h-4" /> 匯入紀錄
             </button>

             <button 
              onClick={() => { setShowAiModal(true); setAiResponse(''); }}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-lg shadow-purple-600/20"
            >
              <Sparkles className="w-4 h-4" /> AI 分析
            </button>
            <div className="h-8 w-px bg-slate-700 mx-2"></div>
             <label className="cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-lg shadow-emerald-600/20">
              {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              <span className="font-medium">{isUploading ? '處理中...' : '匯入/更新 CSV'}</span>
              <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
            </label>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6 space-y-8">
        {/* 原本的版面結構，完全沒動 */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-wrap gap-4 items-center justify-between">
           <div className="flex items-center gap-4">
             <div className="flex items-center gap-2">
               <span className="font-bold text-slate-700">客戶篩選:</span>
               <select 
                 className="bg-slate-50 border rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-slate-700"
                 value={activeClient || 'ALL'}
                 onChange={(e) => setActiveClient(e.target.value)}
               >
                 {clients.map(c => <option key={c} value={c}>{c}</option>)}
               </select>
             </div>
             <button className="bg-emerald-100 text-emerald-700 px-4 py-2 rounded-lg font-bold text-sm hover:bg-emerald-200 flex items-center gap-2 transition-colors">
                <FileText className="w-4 h-4" /> 產生 SA 請款單
             </button>
           </div>
           
           <div className="relative">
             <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
             <input 
               type="text" 
               placeholder="搜尋單號、櫃號..." 
               className="pl-9 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none w-64"
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
             />
           </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-medium border-b">
                <tr>
                  <th className="px-6 py-4">日期</th>
                  <th className="px-6 py-4">櫃號</th>
                  <th className="px-6 py-4">單號</th>
                  <th className="px-6 py-4">出貨地</th>
                  <th className="px-6 py-4">客戶</th>
                  <th className="px-6 py-4">品名</th>
                  <th className="px-6 py-4 text-right">數量</th>
                  <th className="px-6 py-4 text-right">單價</th>
                  <th className="px-6 py-4 text-right">總價</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredData.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-3 text-slate-500 font-mono">{row['日期']}</td>
                    <td className="px-6 py-3 text-slate-700 font-bold flex items-center gap-2">
                      <Container className="w-4 h-4 text-slate-400" />
                      {row['櫃號'] || '-'}
                    </td>
                    <td className="px-6 py-3 font-medium text-slate-700">
                      {row['單號']}
                    </td>
                     <td className="px-6 py-3 text-slate-500 text-xs">
                      {isChinaOrder(row) ? (
                        <span className="bg-red-100 text-red-600 px-2 py-1 rounded font-bold">China</span>
                      ) : (
                        row['出貨地'] || '-'
                      )}
                    </td>
                    <td className="px-6 py-3 font-bold text-slate-700">{row['客戶']}</td>
                    <td className="px-6 py-3 text-slate-600 max-w-[200px] truncate" title={row['品名']}>{row['品名']}</td>
                    <td className="px-6 py-3 text-right font-mono text-slate-600">{Number(row['數量']).toLocaleString()}</td>
                    <td className="px-6 py-3 text-right font-mono text-slate-600">{Number(row['單價']).toFixed(2)}</td>
                    <td className="px-6 py-3 text-right font-mono font-bold text-emerald-600">
                      {formatCurrency(Number(row['總價']) || (Number(row['數量']) * Number(row['單價'])))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <AiModal show={showAiModal} onClose={() => setShowAiModal(false)} prompt={aiPrompt} setPrompt={setAiPrompt} onSend={handleAiAnalysis} response={aiResponse} loading={isAiLoading} />
      
      {/* 兩個新功能的視窗 */}
      <ManualAddModal show={showManualModal} onClose={() => setShowManualModal(false)} onSave={handleManualSave} />
      <HistoryModal show={showHistoryModal} onClose={() => setShowHistoryModal(false)} history={uploadHistory} onDelete={handleDeleteBatch} />
    </div>
  );
};

export default App;