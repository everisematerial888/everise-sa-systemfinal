import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  FileText, Upload, Printer, ChevronRight, Hash, 
  ArrowLeft, Settings, Search,
  CheckCircle2, FileSpreadsheet,
  Table as TableIcon, LayoutDashboard, Edit3, X, Trash,
  Download, Database, Layers, Sparkles, MessageSquare, Loader2,
  TrendingUp, DollarSign, Calendar, PieChart, BarChart3, Calculator,
  Cloud, CloudOff, Save, Archive, Plus, Trash2, MapPin, Package, KeyRound,
  RotateCcw, History, RefreshCw
} from 'lucide-react';

// --- Firebase Imports ---
import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInAnonymously, onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, collection, doc, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot, writeBatch, query, orderBy, limit, getDocs, where
} from 'firebase/firestore';

// --- 設定區：請在此填入您的 Firebase 設定 ---
const firebaseConfig = {
    apiKey: "AIzaSyDsGkGsWS4sRIn3o9XzWmqGSbZg4i5Dc9g",
    authDomain: "sa-test-96792.firebaseapp.com",
    projectId: "sa-test-96792",
    storageBucket: "sa-test-96792.firebasestorage.app",
    messagingSenderId: "736271192466",
    appId: "1:736271192466:web:1517c3d40e3e61d1c1b14b",
    measurementId: "G-1X3X3FWSM7"
  };

// --- API Key Default ---
const apiKey = ""; 

// --- 輔助組件：永久駐留的操作歷史列 (Persistent Undo Bar) ---
const PersistentUndoBar = ({ message, onUndo, onDismiss, visible }) => {
  if (!visible) return null;
  return (
    <div className="fixed bottom-6 left-6 right-auto bg-slate-900 text-white pl-4 pr-2 py-3 rounded-lg shadow-2xl flex items-center gap-4 z-[200] animate-in slide-in-from-bottom-5 fade-in duration-300 border border-slate-700 max-w-md print:hidden">
      <div className="flex items-center gap-3 flex-1">
        <div className="bg-emerald-500 rounded-full p-1"><CheckCircle2 className="w-3 h-3 text-white" /></div>
        <span className="font-bold text-sm">{message}</span>
      </div>
      <div className="flex items-center gap-1 border-l border-slate-700 pl-2">
        {onUndo && (
          <button 
            onClick={onUndo} 
            className="hover:bg-slate-700 text-emerald-400 px-3 py-2 rounded text-xs font-black uppercase tracking-wider flex items-center gap-1 transition-colors"
          >
            <RotateCcw className="w-3 h-3" /> 復原 (Undo)
          </button>
        )}
        <button onClick={onDismiss} className="p-2 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// --- 獨立的 AI Modal 組件 ---
const AiModal = ({ show, onClose, prompt, setPrompt, onSend, response, loading, hasKey }) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200 print:hidden">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
          <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" /> AI 訂單數據分析
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full"><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <div className="flex-1 overflow-auto p-6 bg-slate-50">
          {!hasKey && (
            <div className="mb-4 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm flex gap-2 items-start">
               <KeyRound className="w-5 h-5 shrink-0" />
               <div>
                 <p className="font-bold">尚未設定 Gemini API Key</p>
                 <p>請前往「設定」頁面輸入您的 API Key 才能使用 AI 分析功能。</p>
               </div>
            </div>
          )}
          
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
            className="flex-1 border rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 focus:outline-none disabled:bg-slate-100"
            placeholder="例如：統計本月南泰廠商的出貨總量？"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !loading && hasKey && onSend()}
            disabled={!hasKey}
            autoFocus
          />
          <button 
            onClick={onSend}
            disabled={loading || !prompt || !hasKey}
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

// --- Manual Revenue Modal ---
const ManualRevenueModal = ({ show, onClose, onSave }) => {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [client, setClient] = useState('');
    const [cabinetNo, setCabinetNo] = useState('');
    const [amount, setAmount] = useState('');
    const [source, setSource] = useState('China');
    const [note, setNote] = useState('');

    if (!show) return null;

    const handleSubmit = () => {
        if (!amount || !client || !date) {
            alert("請填寫完整資訊 (日期、客戶、金額)");
            return;
        }
        onSave({ 
            date, 
            client: client.toUpperCase(), 
            cabinetNo: cabinetNo || 'N/A',
            amount: parseFloat(amount), 
            source, 
            note 
        });
        setClient('');
        setCabinetNo('');
        setAmount('');
        setNote('');
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200 print:hidden">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                        <Plus className="w-5 h-5 text-emerald-600" /> 新增額外營收
                    </h3>
                    <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
                </div>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">出貨日期</label>
                            <input type="date" className="w-full border rounded-lg px-3 py-2 font-mono" value={date} onChange={e => setDate(e.target.value)} />
                        </div>
                        <div>
                             <label className="block text-xs font-bold text-slate-500 mb-1">出貨來源</label>
                             <select className="w-full border rounded-lg px-3 py-2 bg-slate-50" value={source} onChange={e => setSource(e.target.value)}>
                                 <option value="China">China (中國直送)</option>
                                 <option value="Warehouse">Warehouse (倉庫)</option>
                                 <option value="Other">Other (其他)</option>
                             </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">客戶名稱</label>
                            <input type="text" className="w-full border rounded-lg px-3 py-2 font-bold uppercase" value={client} onChange={e => setClient(e.target.value)} placeholder="例如：APS" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">客戶櫃號/單號</label>
                            <input type="text" className="w-full border rounded-lg px-3 py-2" value={cabinetNo} onChange={e => setCabinetNo(e.target.value)} placeholder="例如：SRR#114" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">出貨金額 (THB)</label>
                        <input type="number" className="w-full border rounded-lg px-3 py-2 font-mono text-xl text-emerald-600 font-bold bg-emerald-50 border-emerald-200" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" autoFocus />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">備註 (來源說明)</label>
                        <input type="text" className="w-full border rounded-lg px-3 py-2" value={note} onChange={e => setNote(e.target.value)} placeholder="例如：C4 SHINY" />
                    </div>
                </div>
                <div className="mt-8 flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 rounded-lg font-bold text-slate-500 hover:bg-slate-100">關閉</button>
                    <button onClick={handleSubmit} className="flex-[2] py-3 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200">儲存並新增下一筆</button>
                </div>
            </div>
        </div>
    );
};

const App = () => {
  // --- Firebase Init ---
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const appId = 'default-app-id'; 

  // --- State ---
  const [user, setUser] = useState(null);
  const [dbReady, setDbReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState('idle');
  
  const [masterData, setMasterData] = useState([]); 
  const [manualRevenueData, setManualRevenueData] = useState([]); 
  const [revenueData, setRevenueData] = useState([]); 
  const [viewMode, setViewMode] = useState('dashboard'); 

  const [activeClient, setActiveClient] = useState(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeMasterClient, setActiveMasterClient] = useState('ALL');

  const [editingId, setEditingId] = useState(null);
  const editValues = useRef({}); 

  // --- Undo System States (Persistent) ---
  const [toast, setToast] = useState({ visible: false, message: '', undoAction: null });

  // --- AI States ---
  const [userApiKey, setUserApiKey] = useState(() => localStorage.getItem('everise_gemini_key') || '');
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  
  const [showRevenueModal, setShowRevenueModal] = useState(false); 

  // --- Config State ---
  const [clientConfig, setClientConfig] = useState({
    "AP": { startNo: 954, prefix: "AP" },
    "PV": { startNo: 210, prefix: "PV" },
    "DP": { startNo: 423, prefix: "DP" },
    "APS": { startNo: 857, prefix: "APS" }
  });

  const [vendorRules, setVendorRules] = useState([
    { id: 1, keyword: "SANDWICH", vendor: "南泰" },
    { id: 2, keyword: "SPONGE", vendor: "南泰" },
    { id: 3, keyword: "600D", vendor: "龍利達" },
    { id: 4, keyword: "LACOSTE", vendor: "南泰" },
    { id: 5, keyword: "VACUMN", vendor: "龍利達" },
    { id: 6, keyword: "CC", vendor: "南泰" }
  ]);

  // --- Auth & Data Sync ---
  useEffect(() => {
    signInAnonymously(auth).catch((error) => console.error("Auth Error:", error));
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) setDbReady(true);
    });
    return () => unsubscribeAuth();
  }, [auth]);

  useEffect(() => {
    if (!user) return;
    setSyncStatus('syncing');

    const masterDataRef = collection(db, 'artifacts', appId, 'users', user.uid, 'master_data');
    const unsubMaster = onSnapshot(masterDataRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMasterData(data);
      setSyncStatus('idle');
    }, (error) => { console.error(error); setSyncStatus('error'); });

    const settingsRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'config');
    const unsubSettings = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists() && docSnap.data().clientConfig) {
        setClientConfig(docSnap.data().clientConfig);
      }
    }, (error) => console.error(error));

    const revenueRef = collection(db, 'artifacts', appId, 'users', user.uid, 'manual_revenue');
    const unsubRevenue = onSnapshot(revenueRef, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setManualRevenueData(data);
    }, (error) => console.error(error));

    return () => { unsubMaster(); unsubSettings(); unsubRevenue(); };
  }, [user, db, appId]);

  // --- Helper: Show Persistent Undo ---
  const showToast = (message, undoAction = null) => {
      // 移除 setTimeout，讓它永久顯示直到被替換或關閉
      setToast({ visible: true, message, undoAction });
  };

  const dismissToast = () => {
      setToast(prev => ({ ...prev, visible: false }));
  };

  // --- Firestore Actions ---
  const saveMasterDataRow = async (row) => {
    if (!user) return;
    const { id, ...data } = row;
    await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'master_data', id), data);
  };

  const saveClientConfig = async (newConfig) => {
    if (!user) return;
    await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'config'), { clientConfig: newConfig }, { merge: true });
  };

  const updateMasterDataRow = async (id, updates) => {
    if (!user) return;
    const originalDoc = masterData.find(d => d.id === id);
    if (!originalDoc) return;

    await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'master_data', id), updates);

    showToast("已更新資料", async () => {
        const { id: _, ...revertData } = originalDoc;
        await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'master_data', id), revertData);
        dismissToast();
    });
  };

  const deleteMasterDataRow = async (id) => {
    if (!user) return;
    const deletedDoc = masterData.find(d => d.id === id);
    if(!deletedDoc) return;

    await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'master_data', id));

    showToast("已刪除 1 筆資料", async () => {
        const { id: docId, ...data } = deletedDoc;
        await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'master_data', docId), data);
        dismissToast();
    });
  };

  const deleteBatchBySource = async (sourceName) => {
      if (!user || !sourceName) return;
      const targets = masterData.filter(d => d.source === sourceName);
      if (targets.length === 0) return;

      if (!window.confirm(`警告：您確定要刪除所有來自 "${sourceName}" 的資料嗎？(${targets.length}筆)`)) return;

      setSyncStatus('syncing');
      try {
          const batch = writeBatch(db);
          targets.forEach(docData => {
              const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'master_data', docData.id);
              batch.delete(ref);
          });
          await batch.commit();
          setSyncStatus('idle');
          showToast(`已成功刪除 ${targets.length} 筆資料`, null); // Batch delete no undo for safety
      } catch (err) {
          console.error("Batch delete error:", err);
          setSyncStatus('error');
          alert("刪除失敗，請稍後再試。");
      }
  };

  // --- Intelligence ---
  const getPredictiveVendor = (client, product) => {
      const history = masterData
          .filter(d => d.client === client && d.product === product && d.vendor && d.vendor !== "待查")
          .sort((a, b) => b.timestamp - a.timestamp);
      if (history.length > 0) return history[0].vendor;
      const matchedRule = vendorRules.find(rule => product.toUpperCase().includes(rule.keyword.toUpperCase()));
      if (matchedRule) return matchedRule.vendor;
      return "待查";
  };

  const getNextCabinetNumber = (client) => {
      // 1. 優先查詢 Config (這是手動設定的基準)
      const config = clientConfig[client];
      
      // 2. 查詢歷史最大值
      const clientOrders = masterData.filter(d => d.client === client && d.cabinetNo);
      let maxNum = 0;
      const regex = /(\d+)$/;
      clientOrders.forEach(d => {
          const match = d.cabinetNo.match(regex);
          if (match) {
              const num = parseInt(match[1], 10);
              if (num > maxNum) maxNum = num;
          }
      });

      // 3. 邏輯判定：如果歷史最大值大於 Config 設定的起始值，就用歷史值+1，否則用 Config
      // 這確保了如果使用者在 Config 設定了新的起始值 (例如 800)，系統會從 800 開始
      const startNum = config ? config.startNo : 1;
      
      if (maxNum >= startNum) {
          return maxNum + 1;
      } else {
          return startNum;
      }
  };

  // --- Import ---
  const parseCSVLine = (line) => {
    const result = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      let char = line[i];
      if (char === '"') inQuote = !inQuote;
      else if (char === ',' && !inQuote) {
        result.push(cur.trim());
        cur = '';
      } else cur += char;
    }
    result.push(cur.trim());
    return result;
  };

  const cleanNumber = (str) => {
    if (!str) return 0;
    const match = str.toString().replace(/[^\d.-]/g, '');
    return match ? parseFloat(match) : 0;
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setSyncStatus('syncing');

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target.result;
        const rows = text.split(/\r?\n/).filter(r => r.trim());
        if (rows.length < 1) return;
        const headers = parseCSVLine(rows[0]).map(h => h.trim().toLowerCase());
        
        if (headers.includes('client') && (headers.includes('number') || rows[0].includes(',')) && rows[0].length < 50) {
          const newConfig = { ...clientConfig };
          rows.slice(1).forEach(row => {
            const [client, num] = parseCSVLine(row);
            if (client && num) {
              newConfig[client.toUpperCase().trim()] = { startNo: parseInt(num) || 1, prefix: client.toUpperCase().trim() };
            }
          });
          saveClientConfig(newConfig); 
          return;
        }
        parseMasterDataCSV(file, rows, headers);
      };
      reader.readAsText(file);
    });
    e.target.value = '';
  };

  const parseMasterDataCSV = async (file, rows, headers) => {
    const getIdx = (keys) => headers.findIndex(h => keys.some(k => h.includes(k)));
    const idx = {
        date: getIdx(['ship date', 'date', '日期', '下單日期']),
        client: getIdx(['client | ลูกค้า', 'client', '客戶', 'ลูกค้า']),
        product: getIdx(['product name', '品名', 'ชื่อสินค้า', 'spec']),
        color: getIdx(['color', '顏色', 'สี', 'item/顏色']),
        orderQty: getIdx(['訂單數量', 'order quantity']), 
        shippedQty: getIdx(['quantity', '數量', 'จำนวน', '實際出貨', '出貨數量']),
        unshipped: getIdx(['未出貨', '訂單未出貨數量', 'balance']),
        price: getIdx(['unit price', '單價', 'ราคา', '客人單價']),
        order: getIdx(['order', '訂單', 'p/o', 'note']),
        cabinet: getIdx(['cabinet', '櫃號', 'c/no']),
        vendor: getIdx(['vendor', '廠商']),
        status: getIdx(['status', '結案', '是否已結案']),
        note: getIdx(['note', '備註'])
    };

    const promises = [];
    const tempCabinetCounter = {}; 

    rows.slice(1).forEach((row, rIdx) => {
        const cols = parseCSVLine(row);
        if (cols.length < 3) return;

        let clientName = cols[idx.client] || (file.name.includes('AP') ? 'AP' : 'Unknown');
        if (file.name.includes('APS')) clientName = 'APS'; 
        clientName = clientName.toUpperCase().trim();

        const productName = cols[idx.product] ? cols[idx.product].trim() : '';
        let vendor = idx.vendor !== -1 && cols[idx.vendor] ? cols[idx.vendor] : getPredictiveVendor(clientName, productName);
        let cabinetNo = cols[idx.cabinet] || '';
        
        if (!cabinetNo) {
            if (tempCabinetCounter[clientName] === undefined) {
                tempCabinetCounter[clientName] = getNextCabinetNumber(clientName);
            }
            const currentNum = tempCabinetCounter[clientName];
            const prefix = clientConfig[clientName]?.prefix || clientName;
            cabinetNo = `${prefix}#${currentNum}`;
        }

        const data = {
            id: `${file.name}-${rIdx}-${Date.now()}`,
            date: cols[idx.date] || '',
            client: clientName,
            product: productName,
            color: cols[idx.color] || '',
            orderQty: cleanNumber(cols[idx.orderQty]) || cleanNumber(cols[idx.shippedQty]), 
            shippedQty: cleanNumber(cols[idx.shippedQty]),
            unshipped: cleanNumber(cols[idx.unshipped]),
            price: cleanNumber(cols[idx.price]) || cleanNumber(cols[idx.order]?.match(/THB\s*(\d+)/)?.[1]),
            vendor: vendor,
            cabinetNo: cabinetNo,
            orderNo: cols[idx.order]?.match(/ORD-\d+/) ? cols[idx.order].match(/ORD-\d+/)[0] : (cols[idx.order] || 'N/A'),
            status: cols[idx.status] || '',
            note: cols[idx.note] || '',
            source: file.name,
            timestamp: Date.now()
        };
        promises.push(saveMasterDataRow(data));
    });

    await Promise.all(promises);
    setSyncStatus('idle');
    showToast(`成功匯入 ${promises.length} 筆資料`, null); // No undo for import in this version
    if (viewMode !== 'revenueStats') setViewMode('dashboard');
  };

  // --- Revenue ---
  const generateRevenueData = () => {
    const stats = {};
    const initMonth = (monthKey, year, month) => { if (!stats[monthKey]) stats[monthKey] = { monthKey, year, month, total: 0, warehouseTotal: 0, chinaTotal: 0, otherTotal: 0, clientMap: {} }; };
    const addAmount = (monthKey, client, amount, source) => {
        if (!client) return;
        const m = stats[monthKey];
        m.total += amount;
        if (source === 'Warehouse') m.warehouseTotal += amount; else if (source === 'China') m.chinaTotal += amount; else m.otherTotal += amount;
        if (!m.clientMap[client]) m.clientMap[client] = { total: 0, sources: {} };
        m.clientMap[client].total += amount;
        m.clientMap[client].sources[source] = (m.clientMap[client].sources[source] || 0) + amount;
    };

    masterData.forEach(order => {
        if (!order.shippedQty || !order.price) return;
        let dateObj = new Date(order.date);
        if (isNaN(dateObj.getTime())) return;
        const year = dateObj.getFullYear();
        const month = dateObj.getMonth() + 1; 
        const monthKey = `${year}-${String(month).padStart(2, '0')}`;
        initMonth(monthKey, year, month);
        addAmount(monthKey, order.client, order.shippedQty * order.price, "Warehouse");
    });

    manualRevenueData.forEach(item => {
        let year, month;
        if (item.date) { const d = new Date(item.date); year = d.getFullYear(); month = d.getMonth() + 1; } 
        else { year = item.year; month = item.month; }
        if (!year || !month) return;
        const monthKey = `${year}-${String(month).padStart(2, '0')}`;
        initMonth(monthKey, year, month);
        addAmount(monthKey, item.client, item.amount, item.source || "China");
    });

    const combinedData = Object.values(stats).map(item => {
        const clients = Object.entries(item.clientMap).map(([client, data]) => ({ client, amount: data.total, sources: data.sources })).sort((a, b) => b.amount - a.amount);
        return { ...item, clients };
    }).sort((a, b) => b.monthKey.localeCompare(a.monthKey));

    setRevenueData(combinedData);
  };

  useEffect(() => { if (masterData.length > 0 || manualRevenueData.length > 0) generateRevenueData(); }, [masterData, manualRevenueData]);

  // --- UI Handlers ---
  const startEditing = (record) => { setEditingId(record.id); editValues.current = { ...record }; };
  const handleEditChange = (field, value) => { editValues.current[field] = value; };
  const saveEdit = () => { if (!editingId) return; updateMasterDataRow(editingId, editValues.current); setEditingId(null); editValues.current = {}; };
  const handleDelete = (id) => { if(window.confirm("確定要刪除此筆資料嗎？")) deleteMasterDataRow(id); };
  
  const handleSaveApiKey = (newKey) => { setUserApiKey(newKey); localStorage.setItem('everise_gemini_key', newKey); };
  const handleClientConfigChange = (client, field, value) => {
      setClientConfig(prev => {
          const newConfig = { ...prev, [client]: { ...prev[client], [field]: value } };
          saveClientConfig(newConfig); // Auto save to cloud
          return newConfig;
      });
  };

  const callGemini = async () => {
    const keyToUse = userApiKey || apiKey;
    if (!aiPrompt.trim()) return;
    setIsAiLoading(true); setAiResponse('');
    try {
      const dataSummary = filteredMasterData.slice(0, 50).map(d => ({ date: d.date, client: d.client, product: d.product, qty: d.shippedQty, price: d.price, total: d.shippedQty * d.price }));
      const revenueSummary = revenueData.slice(0, 6).map(r => `${r.monthKey}: 總營收 $${r.total.toLocaleString()} THB (倉庫: $${r.warehouseTotal.toLocaleString()}, 中國: $${r.chinaTotal.toLocaleString()})`).join('\n      ');
      const systemInstruction = `您是專業的訂單數據分析師。所有金額單位皆為泰銖 (THB)。\n\n【月度營收摘要】:\n${revenueSummary}\n\n【詳細訂單範例】:\n${JSON.stringify(dataSummary)}\n\n請根據上述資訊回答問題。`;
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${keyToUse}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: `${systemInstruction}\n\nUser Question: ${aiPrompt}` }] }] }) });
      if (!response.ok) throw new Error('API Key 無效或請求錯誤');
      const data = await response.json();
      setAiResponse(data.candidates?.[0]?.content?.parts?.[0]?.text || "No response");
    } catch (e) { setAiResponse(`發生錯誤: ${e.message}`); } finally { setIsAiLoading(false); }
  };

  const exportTrackingCSV = () => {
    const headers = ["下單日期", "訂單", "廠商", "品名", "顏色", "訂單數量", "實際出貨", "未出貨", "櫃號", "結案", "備註"];
    const csvRows = [headers.join(",")];
    filteredMasterData.forEach(d => {
      const row = [d.date, d.orderNo, d.vendor, `"${d.product}"`, d.color, d.orderQty, d.shippedQty, d.orderQty - d.shippedQty, d.cabinetNo, d.status, `"${d.note}"`];
      csvRows.push(row.join(","));
    });
    const blob = new Blob(["\uFEFF" + csvRows.join("\n")], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `訂單進度總表_${activeMasterClient}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const StatusIndicator = () => {
    if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "YOUR_API_KEY") return <div className="text-red-400 flex items-center gap-1 text-xs font-bold">⚠️ 請設定 Firebase</div>;
    if (syncStatus === 'syncing') return <div className="text-blue-400 flex items-center gap-1 text-xs"><Loader2 className="w-3 h-3 animate-spin" /> 同步中...</div>;
    if (syncStatus === 'error') return <div className="text-red-400 flex items-center gap-1 text-xs"><CloudOff className="w-3 h-3" /> 同步失敗</div>;
    return <div className="text-emerald-400 flex items-center gap-1 text-xs"><Cloud className="w-3 h-3" /> 雲端已備份</div>;
  };

  const Navbar = () => (
    <div className="bg-slate-900 border-b border-slate-700 sticky top-0 z-50 px-6 py-3 flex justify-between items-center print:hidden">
      <div className="flex items-center gap-6">
        <h1 className="text-xl font-black text-white tracking-tighter flex items-center gap-2">
          <Database className="w-6 h-6 text-emerald-400" />
          EVERISE <span className="text-xs font-normal text-slate-400">V10.1</span>
        </h1>
        <div className="flex bg-slate-800 p-1 rounded-lg overflow-x-auto">
          {[
            { id: 'dashboard', label: 'SA 請款單', icon: LayoutDashboard },
            { id: 'trackingTable', label: '客戶訂單總表', icon: FileSpreadsheet },
            { id: 'masterTable', label: '年度明細管理', icon: TableIcon },
            { id: 'revenueStats', label: '營業額統計', icon: TrendingUp }, 
            { id: 'dataManagement', label: '資料來源管理', icon: Archive },
          ].map(tab => (
            <button key={tab.id} onClick={() => setViewMode(tab.id)} className={`px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${viewMode === tab.id ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}>
              <tab.icon className="w-4 h-4" /> {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-3 items-center">
        <StatusIndicator />
        <div className="h-4 w-px bg-slate-700 mx-1"></div>
        <button onClick={() => setShowAiModal(true)} className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition-colors">
          <Sparkles className="w-4 h-4" /> AI 分析
        </button>
        <button onClick={() => setViewMode('settings')} className="p-2 text-slate-400 hover:text-white"><Settings className="w-5 h-5" /></button>
        <label className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg cursor-pointer font-bold text-xs flex items-center gap-2">
          <Upload className="w-4 h-4" /> 匯入 CSV
          <input type="file" accept=".csv" multiple className="hidden" onChange={handleFileUpload} />
        </label>
      </div>
    </div>
  );

  const RevenueStatsView = () => {
    const maxRevenue = Math.max(...revenueData.map(d => d.total), 1);
    const sortedManual = [...manualRevenueData].sort((a,b) => {
        const dateA = a.date ? new Date(a.date) : new Date(a.year, a.month);
        const dateB = b.date ? new Date(b.date) : new Date(b.year, b.month);
        return dateB - dateA;
    });

    return (
        <div className="p-8 max-w-6xl mx-auto min-h-screen bg-slate-50 animate-in fade-in print:bg-white print:p-0 print:w-full">
            <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 flex items-center gap-3">
                        <TrendingUp className="w-8 h-8 text-emerald-600" /> 年度營業額總表
                    </h2>
                    <p className="text-slate-500 font-bold mt-2">包含 Master Data (Warehouse) 與 手動輸入 (China/Other)</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => window.print()} className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm transition-colors">
                       <Printer className="w-4 h-4" /> 列印報表
                    </button>
                    <button onClick={() => setShowRevenueModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm transition-colors">
                       <Plus className="w-4 h-4" /> 新增額外營收
                    </button>
                </div>
            </div>

            <div className="hidden print:block mb-6 text-center border-b pb-4">
                <h1 className="text-2xl font-black">EVERISE - 年度營業額統計報表</h1>
                <p className="text-sm text-slate-500">列印日期: {new Date().toLocaleDateString()}</p>
            </div>
            
            <div className="grid gap-6 mb-12 print:gap-4">
                {revenueData.length === 0 ? (
                  <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-300">
                    <BarChart3 className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-400 font-bold">暫無統計數據</p>
                  </div>
                ) : (
                  revenueData.map((data) => (
                    <div key={data.monthKey} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow print:shadow-none print:border-slate-400 print:break-inside-avoid">
                        <div className="p-6 flex flex-col md:flex-row gap-6 items-start">
                            <div className="w-full md:w-48 shrink-0 border-b md:border-b-0 md:border-r border-slate-100 pb-4 md:pb-0 md:pr-4">
                                <div className="text-sm font-bold text-slate-400 uppercase tracking-wider">{data.year}</div>
                                <div className="text-4xl font-black text-slate-800">{data.month} <span className="text-lg text-slate-400">月</span></div>
                                <div className="mt-2 text-xl font-black text-emerald-600 flex items-center gap-1">
                                    <span className="text-xs text-emerald-400">THB</span>
                                    {data.total.toLocaleString()}
                                </div>
                                <div className="mt-4 space-y-2 border-t border-slate-100 pt-2 print:text-xs">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-400 font-bold flex items-center gap-1"><Package className="w-3 h-3" /> 倉庫</span>
                                        <span className="font-mono font-bold text-blue-600">{data.warehouseTotal.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-400 font-bold flex items-center gap-1"><MapPin className="w-3 h-3" /> 中國</span>
                                        <span className="font-mono font-bold text-red-500">{data.chinaTotal.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex-1 w-full">
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                    {data.clients.map((client, idx) => (
                                        <div key={idx} className="flex flex-col bg-slate-50 p-2 rounded border border-slate-100 relative group print:border-slate-300">
                                            <div className="flex justify-between items-baseline mb-1">
                                                <span className="text-xs font-black text-slate-700 truncate">{idx + 1}. {client.client}</span>
                                            </div>
                                            <span className="text-sm font-mono text-emerald-600 font-bold block">{client.amount.toLocaleString()}</span>
                                            <div className="mt-1 flex h-1.5 w-full rounded-full overflow-hidden bg-slate-200 print:h-2 print:border print:border-slate-300">
                                                {client.sources['Warehouse'] > 0 && <div className="h-full bg-blue-400 print:bg-slate-600" style={{ width: `${(client.sources['Warehouse'] / client.amount) * 100}%` }}></div>}
                                                {client.sources['China'] > 0 && <div className="h-full bg-red-400 print:bg-slate-400" style={{ width: `${(client.sources['China'] / client.amount) * 100}%` }}></div>}
                                                {client.sources['Other'] > 0 && <div className="h-full bg-yellow-400 print:bg-slate-200" style={{ width: `${(client.sources['Other'] / client.amount) * 100}%` }}></div>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                  ))
                )}
            </div>
            
            <div className="hidden print:block text-center text-xs text-slate-400 mt-8">
                Powered by EVERISE Cloud System V10.1
            </div>
        </div>
    );
  };

  // ... (DataManagementView, TrackingTableView, MasterTableView - Logic identical, just integrated with persistent bar) ...
  // Re-implementing simplified views for brevity but maintaining structure
  const DataManagementView = () => {
    const sourceStats = useMemo(() => {
        const stats = {};
        masterData.forEach(d => { const src = d.source || 'Unknown'; stats[src] = (stats[src] || 0) + 1; });
        return Object.entries(stats).map(([source, count]) => ({ source, count }));
    }, [masterData]);
    return (
      <div className="p-8 max-w-4xl mx-auto min-h-screen bg-slate-50 animate-in fade-in">
          <h2 className="text-3xl font-black text-slate-800 flex items-center gap-3 mb-2"><Archive className="w-8 h-8 text-emerald-600" /> 資料來源管理</h2>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <table className="w-full text-left"><thead className="bg-slate-100 text-xs font-bold text-slate-600 border-b border-slate-200"><tr><th className="p-4">來源檔案名稱</th><th className="p-4 text-center">筆數</th><th className="p-4 text-right">操作</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">{sourceStats.map((stat) => (<tr key={stat.source} className="hover:bg-red-50 group transition-colors"><td className="p-4 font-mono text-sm font-bold text-slate-700">{stat.source}</td><td className="p-4 text-center"><span className="bg-slate-100 px-3 py-1 rounded-full text-xs font-black text-slate-600">{stat.count}</span></td><td className="p-4 text-right"><button onClick={() => deleteBatchBySource(stat.source)} className="text-slate-400 hover:text-red-600 font-bold text-sm flex items-center gap-1 ml-auto transition-colors px-3 py-1 rounded hover:bg-red-100"><Trash2 className="w-4 h-4" /> 刪除整批</button></td></tr>))}</tbody></table>
          </div>
      </div>
    );
  };

  const TrackingTableView = () => (
    <div className="p-6 animate-in fade-in duration-500 min-h-screen bg-white">
      <div className="mb-6 flex justify-between items-center print:hidden">
        <div><h2 className="text-2xl font-black text-slate-800 flex items-center gap-2"><FileSpreadsheet className="w-6 h-6 text-emerald-600" /> 客戶訂單進度總表</h2><div className="flex flex-wrap gap-2 mt-2">{['ALL', ...sortedClients].map(c => (<button key={c} onClick={() => setActiveMasterClient(c)} className={`px-3 py-1 rounded border text-xs font-bold ${activeMasterClient === c ? 'bg-slate-900 text-white' : 'bg-white text-slate-500'}`}>{c}</button>))}</div></div>
        <div className="flex gap-2"><div className="relative"><Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" /><input type="text" placeholder="搜尋..." className="pl-8 pr-4 py-2 border rounded-lg text-sm w-48" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div><button onClick={exportTrackingCSV} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2"><Download className="w-4 h-4" /> 匯出</button></div>
      </div>
      <div className="border border-slate-300 overflow-auto"><table className="w-full text-left text-sm border-collapse"><thead className="bg-slate-100 sticky top-0 z-10 text-xs font-black text-slate-600 uppercase tracking-wider"><tr><th className="p-2 border-b border-r w-24">日期</th><th className="p-2 border-b border-r w-24">訂單</th><th className="p-2 border-b border-r w-20">廠商</th><th className="p-2 border-b border-r">品名</th><th className="p-2 border-b border-r w-32">顏色</th><th className="p-2 border-b border-r w-20 text-right">訂單數</th><th className="p-2 border-b border-r w-20 text-right">出貨</th><th className="p-2 border-b border-r w-20 text-right">未出貨</th><th className="p-2 border-b border-r w-20 text-center">櫃號</th><th className="p-2 border-b w-16 text-center">結案</th></tr></thead><tbody className="divide-y divide-slate-200">{filteredMasterData.map((d, i) => (<tr key={d.id} className={`hover:bg-blue-50 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}><td className="p-2 border-r">{d.date}</td><td className="p-2 border-r font-bold">{d.orderNo}</td><td className="p-2 border-r text-xs">{d.vendor}</td><td className="p-2 border-r font-bold text-slate-800">{d.product}</td><td className="p-2 border-r text-xs">{d.color}</td><td className="p-2 border-r text-right font-mono">{d.orderQty}</td><td className="p-2 border-r text-right font-mono font-bold text-blue-600">{d.shippedQty}</td><td className="p-2 border-r text-right font-mono text-red-500 font-bold">{d.orderQty - d.shippedQty !== 0 ? d.orderQty - d.shippedQty : ''}</td><td className="p-2 border-r text-center text-xs">{d.cabinetNo}</td><td className="p-2 text-center font-bold text-xs">{d.status}</td></tr>))}</tbody></table></div>
    </div>
  );

  const MasterTableView = () => (
    <div className="p-6 animate-in fade-in duration-500 min-h-screen bg-slate-50">
      <div className="mb-6 flex justify-between items-center bg-white p-4 rounded-xl shadow-sm"><h2 className="text-xl font-black text-slate-800 flex items-center gap-2"><Edit3 className="w-5 h-5 text-blue-600" /> 年度明細編輯 (Master Data)</h2><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" /><input type="text" placeholder="搜尋..." className="pl-9 pr-4 py-2 border rounded-lg text-sm w-64" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div></div>
      <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto max-h-[80vh]">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 border-b border-slate-300 sticky top-0 z-10 text-xs font-bold text-slate-600"><tr><th className="p-3">日期</th><th className="p-3">客戶</th><th className="p-3">品名 (編輯)</th><th className="p-3">顏色 (編輯)</th><th className="p-3 text-right">出貨量</th><th className="p-3 text-right">單價</th><th className="p-3">廠商 (編輯)</th><th className="p-3 text-center">操作</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMasterData.map(d => (
                <tr key={d.id} className={`hover:bg-blue-50 ${editingId === d.id ? 'bg-yellow-50' : ''}`}>
                  {editingId === d.id ? (
                    <><td className="p-2"><input className="border rounded p-1 w-full" defaultValue={d.date} onChange={e => handleEditChange('date', e.target.value)} /></td><td className="p-2 font-bold">{d.client}</td><td className="p-2"><input className="border rounded p-1 w-full font-bold" autoFocus defaultValue={d.product} onChange={e => handleEditChange('product', e.target.value)} /></td><td className="p-2"><input className="border rounded p-1 w-full" defaultValue={d.color} onChange={e => handleEditChange('color', e.target.value)} /></td><td className="p-2"><input className="border rounded p-1 w-full text-right" type="number" defaultValue={d.shippedQty} onChange={e => handleEditChange('shippedQty', parseFloat(e.target.value))} /></td><td className="p-2"><input className="border rounded p-1 w-full text-right" type="number" defaultValue={d.price} onChange={e => handleEditChange('price', parseFloat(e.target.value))} /></td><td className="p-2"><input className="border rounded p-1 w-full bg-yellow-100 font-bold text-blue-800" defaultValue={d.vendor} onChange={e => handleEditChange('vendor', e.target.value)} placeholder="廠商" /></td><td className="p-2 text-center flex gap-1 justify-center"><button onClick={saveEdit} className="p-1 bg-green-500 text-white rounded"><CheckCircle2 className="w-4 h-4" /></button><button onClick={() => setEditingId(null)} className="p-1 bg-slate-300 text-white rounded"><X className="w-4 h-4" /></button></td></>
                  ) : (
                    <><td className="p-3 text-slate-500">{d.date}</td><td className="p-3 font-bold text-blue-600">{d.client}</td><td className="p-3 font-bold text-slate-800">{d.product}</td><td className="p-3 text-slate-600">{d.color}</td><td className="p-3 text-right font-mono">{d.shippedQty}</td><td className="p-3 text-right font-mono text-emerald-600">{d.price}</td><td className="p-3 text-slate-400">{d.vendor}</td><td className="p-3 text-center flex gap-2 justify-center"><button onClick={() => startEditing(d)} className="text-slate-300 hover:text-blue-500"><Edit3 className="w-4 h-4" /></button><button onClick={() => handleDelete(d.id)} className="text-slate-300 hover:text-red-500"><Trash className="w-4 h-4" /></button></td></>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const sortedClients = useMemo(() => [...new Set(masterData.map(d => d.client))].sort(), [masterData]);
  const filteredMasterData = useMemo(() => {
    let data = masterData;
    if (activeMasterClient !== 'ALL') data = data.filter(d => d.client === activeMasterClient);
    if (searchTerm) { const lowerTerm = searchTerm.toLowerCase(); data = data.filter(d => d.product.toLowerCase().includes(lowerTerm) || d.orderNo.toLowerCase().includes(lowerTerm) || d.vendor.includes(searchTerm)); }
    return [...data].sort((a, b) => a.client !== b.client ? a.client.localeCompare(b.client) : new Date(a.date) - new Date(b.date));
  }, [masterData, activeMasterClient, searchTerm]);

  const groupedInvoices = useMemo(() => {
    const result = {};
    sortedClients.forEach(client => {
      const clientRows = masterData.filter(d => d.client === client && d.shippedQty > 0);
      const dates = [...new Set(clientRows.map(d => d.date))].sort((a, b) => new Date(a) - new Date(b));
      const config = clientConfig[client] || { startNo: 1, prefix: client };
      result[client] = dates.map((date, dIdx) => {
        const items = clientRows.filter(r => r.date === date);
        const cabinet = items[0]?.cabinetNo || `${config.prefix}#${config.startNo + dIdx}`;
        return { id: `${client}-${date}`, date, cabinetNo: cabinet, client, items, total: items.reduce((s, i) => s + (i.shippedQty * i.price), 0) };
      });
    });
    return result;
  }, [masterData, clientConfig, sortedClients]);

  const InvoiceTemplate = ({ inv }) => (
    <div className="w-[210mm] bg-white p-[15mm] shadow-none min-h-[297mm] flex flex-col font-tnr text-black invoice-page">
      <div className="text-center mb-6 border-b-[3px] border-double border-black pb-4"><h1 className="text-4xl font-bold mb-2 tracking-tight uppercase">EVERISE MATERIAL INT'L LTD</h1><div className="flex justify-center gap-6 text-sm font-bold text-black"><span>TEL: 886-2-2741-9113</span><span>FAX: 886-2-2727-9021</span></div><p className="text-sm underline font-bold text-black">E-MAIL: e.material2727@gmail.com</p><div className="inline-block border-[3px] border-black px-12 py-2 font-bold text-3xl tracking-[0.2em] mb-2 uppercase text-black mt-4">SHIPPING ADVICE</div></div>
      <div className="grid grid-cols-2 mb-6 text-xl leading-relaxed items-end"><div className="space-y-2"><div className="flex items-end gap-2 border-b-2 border-black pb-1"><span className="w-16 font-bold text-sm text-black">TO:</span><span className="flex-1 font-bold uppercase text-2xl text-black">{inv.client}</span></div><div className="flex items-end gap-2 border-b-2 border-black pb-1"><span className="w-16 font-bold text-sm text-black">FAX:</span><span className="flex-1"></span></div><div className="flex items-end gap-2 border-b-2 border-black pb-1"><span className="w-16 font-bold text-sm text-black">ATTN:</span><span className="flex-1"></span></div></div><div className="space-y-2 pl-8"><div className="flex items-end gap-2 border-b-2 border-black pb-1"><span className="w-20 font-bold text-sm text-black text-right">DATE:</span><span className="flex-1 font-bold text-xl">{inv.date}</span></div><div className="flex items-end gap-2 border-b-2 border-black pb-1"><span className="w-20 font-bold text-sm text-black text-right">C/NO:</span><span className="flex-1 font-bold text-3xl text-black">{inv.cabinetNo}</span></div><div className="flex items-end gap-2 border-b-2 border-black pb-1"><span className="w-20 font-bold text-sm text-black text-right">FROM:</span><span className="flex-1 font-bold text-xl text-center">ER</span></div></div></div>
      <div className="flex-1"><table className="w-full border-t-[4px] border-black"><tbody className="divide-y-2 divide-black">{inv.items.map((item, idx) => (<React.Fragment key={idx}><tr><td colSpan="3" className="pt-6 pb-2"><div className="flex items-baseline gap-4"><span className="font-bold text-3xl leading-none text-black">ORDER "{item.product}"</span></div></td></tr><tr className="align-bottom"><td className="w-[35%] py-3 pl-6 text-xl text-black font-bold uppercase">{item.color}</td><td className="py-3 px-2"><div className="flex items-baseline gap-2 text-lg whitespace-nowrap"><span className="font-bold text-2xl text-black">{item.shippedQty.toLocaleString()} Y</span><span className="mx-2 text-sm text-black">×</span><span className="font-bold text-xl text-black">{item.price.toFixed(2)}</span><span className="ml-4 font-bold text-xl text-black">= THB $</span></div></td><td className="py-3 text-right font-bold text-3xl tabular-nums pr-2 text-black">{(item.shippedQty * item.price).toLocaleString()}</td></tr></React.Fragment>))}</tbody></table><div className="mt-10 flex justify-end"><div className="w-full border-t-[6px] border-double border-black pt-6 flex justify-between items-baseline px-6 rounded-lg"><span className="font-bold text-2xl tracking-tighter uppercase text-black">Total:</span><span className="font-bold text-5xl tabular-nums text-black tracking-tighter">THB {Math.round(inv.total).toLocaleString()}</span></div></div></div>
    </div>
  );

  const Dashboard = () => (
    <div className="max-w-7xl mx-auto p-12 min-h-screen bg-slate-50">
      {sortedClients.length === 0 ? <div className="text-center py-40 border-4 border-dashed border-slate-200 rounded-3xl"><LayoutDashboard className="w-20 h-20 text-slate-300 mx-auto mb-4" /><p className="text-slate-400 font-bold text-xl">請先匯入 CSV 資料</p></div> : sortedClients.map(client => (<div key={client} className="mb-20"><div className="flex justify-between items-center mb-8 border-b-2 border-slate-200 pb-4"><div className="flex items-center gap-4"><span className="bg-slate-900 text-white px-6 py-2 rounded-xl font-black text-3xl shadow-lg">{client}</span><h2 className="text-xl font-bold text-slate-400">請款單列表</h2></div><button onClick={() => { setActiveClient(client); setViewMode('printAll'); }} className="bg-emerald-600 text-white px-5 py-2 rounded-lg font-bold flex items-center gap-2 shadow-md hover:bg-emerald-700"><Layers className="w-4 h-4" /> 列印本區所有 SA (Print All)</button></div><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">{groupedInvoices[client].map(inv => (<div key={inv.id} onClick={() => { setActiveClient(client); setSelectedInvoiceId(inv.id); setViewMode('preview'); }} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group"><div className="flex justify-between items-start mb-4"><span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-md text-xs font-black">{inv.cabinetNo}</span><ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-600" /></div><div className="text-2xl font-black text-slate-800 mb-1">{inv.date}</div><div className="text-xs text-slate-400 font-bold">{inv.items.length} 筆明細</div><div className="mt-6 pt-4 border-t border-slate-100 text-right"><span className="text-2xl font-black text-emerald-600">THB {Math.round(inv.total).toLocaleString()}</span></div></div>))}</div></div>))}
    </div>
  );

  const PrintAllView = () => (
    <div className="bg-slate-200 min-h-screen py-10 print:bg-white print:p-0 flex flex-col items-center">
      <div className="w-[210mm] mb-6 flex justify-between items-center print:hidden px-4"><button onClick={() => setViewMode('dashboard')} className="text-slate-700 flex items-center gap-2 hover:text-blue-700 font-bold"><ArrowLeft className="w-5 h-5" /> 返回儀表板</button><button onClick={() => window.print()} className="bg-emerald-600 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 shadow-xl"><Printer className="w-5 h-5" /> 列印全部</button></div>
      <div id="print-area">{groupedInvoices[activeClient]?.map(inv => <div key={inv.id} className="print-page-break"><InvoiceTemplate inv={inv} /></div>)}</div>
    </div>
  );

  const SingleInvoiceView = () => {
    const inv = groupedInvoices[activeClient]?.find(i => i.id === selectedInvoiceId);
    if (!inv) return null;
    return (
      <div className="bg-slate-200 min-h-screen py-10 print:bg-white print:p-0 flex flex-col items-center">
        <div className="w-[210mm] mb-6 flex justify-between items-center print:hidden px-4"><button onClick={() => setViewMode('dashboard')} className="text-slate-700 flex items-center gap-2 hover:text-blue-700 font-bold"><ArrowLeft className="w-5 h-5" /> 返回列表</button><button onClick={() => window.print()} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 shadow-xl"><Printer className="w-5 h-5" /> 列印此單</button></div>
        <div id="print-area"><InvoiceTemplate inv={inv} /></div>
      </div>
    );
  };
  
  const SettingsPanel = () => (
    <div className="max-w-2xl mx-auto p-12">
      <button onClick={() => setViewMode('dashboard')} className="flex items-center gap-3 text-slate-500 mb-8 font-bold"><ArrowLeft className="w-5 h-5" /> 返回</button>
      <div className="grid gap-6">
        {/* API Key */}
        <div className="bg-white rounded-2xl shadow-lg p-10 border border-slate-200">
           <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2"><KeyRound className="w-6 h-6 text-purple-600" /> Google Gemini API 設定</h3>
           <input type="password" className="w-full border rounded-lg px-4 py-3 mb-4 bg-slate-50 font-mono text-sm" placeholder="貼上您的 API Key (例如：AIzaSy...)" value={userApiKey} onChange={(e) => handleSaveApiKey(e.target.value)} />
           <div className="text-xs text-slate-400">Key 將自動儲存於您的瀏覽器 (Local Storage)。</div>
        </div>

        {/* New: Cabinet Number Manager */}
        <div className="bg-white rounded-2xl shadow-lg p-10 border border-slate-200">
           <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2"><Hash className="w-6 h-6 text-blue-600" /> 櫃號起始值管理 (Fix Cabinet No)</h3>
           <p className="text-slate-500 mb-4 text-sm">如果系統自動帶入的櫃號不正確，請在此手動修正「起始號碼」。</p>
           <div className="space-y-4">
               {sortedClients.map(client => (
                   <div key={client} className="flex items-center gap-4 border-b border-slate-100 pb-4 last:border-0">
                       <span className="font-bold w-20">{client}</span>
                       <div className="flex-1 flex gap-2 items-center">
                           <span className="text-xs text-slate-400">Prefix:</span>
                           <input type="text" className="border rounded px-2 py-1 w-20 text-sm font-bold" value={clientConfig[client]?.prefix || client} onChange={(e) => handleClientConfigChange(client, 'prefix', e.target.value)} />
                           <span className="text-xs text-slate-400 ml-2">Start No:</span>
                           <input type="number" className="border rounded px-2 py-1 w-24 text-sm font-bold font-mono" value={clientConfig[client]?.startNo || 1} onChange={(e) => handleClientConfigChange(client, 'startNo', parseInt(e.target.value))} />
                       </div>
                   </div>
               ))}
               {sortedClients.length === 0 && <p className="text-slate-400 text-sm">請先匯入訂單資料以管理客戶櫃號。</p>}
           </div>
        </div>

        {/* Legacy Upload */}
        <div className="bg-white rounded-2xl shadow-lg p-10 border border-slate-200 text-center opacity-50 hover:opacity-100 transition-opacity">
          <h3 className="text-lg font-black text-slate-800 mb-2">批次匯入櫃號設定 (進階)</h3>
          <label className="block w-full py-4 border-2 border-dashed border-blue-200 rounded-xl text-blue-600 font-bold hover:bg-blue-50 transition-all cursor-pointer"><Upload className="w-4 h-4 mx-auto mb-1" /> 上傳 CSV<input type="file" accept=".csv" className="hidden" onChange={(e) => handleFileUpload(e)} /></label>
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-slate-50 min-h-screen font-sans selection:bg-emerald-100 text-slate-900">
      <Navbar />
      <AiModal show={showAiModal} onClose={() => setShowAiModal(false)} prompt={aiPrompt} setPrompt={setAiPrompt} onSend={callGemini} response={aiResponse} loading={isAiLoading} hasKey={!!userApiKey || !!apiKey} />
      <ManualRevenueModal show={showRevenueModal} onClose={() => setShowRevenueModal(false)} onSave={() => {}} />
      <PersistentUndoBar message={toast.message} onUndo={toast.undoAction} onDismiss={dismissToast} visible={toast.visible} />
      <main className="pb-40">
        {viewMode === 'dashboard' && <Dashboard />}
        {viewMode === 'masterTable' && <MasterTableView />}
        {viewMode === 'trackingTable' && <TrackingTableView />}
        {viewMode === 'settings' && <SettingsPanel />}
        {viewMode === 'preview' && <SingleInvoiceView />}
        {viewMode === 'printAll' && <PrintAllView />}
        {viewMode === 'revenueStats' && <RevenueStatsView />}
        {viewMode === 'dataManagement' && <DataManagementView />}
      </main>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: A4; margin: 10mm; }
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; }
          .bg-slate-200, .bg-slate-50, .shadow-xl, .bg-white { background: white !important; box-shadow: none !important; }
          .print-page-break { page-break-after: always !important; break-after: page !important; min-height: 297mm; }
          .print\\:hidden, nav, button, input[type="file"] { display: none !important; }
          .print\\:bg-white { background: white !important; }
          .print\\:p-0 { padding: 0 !important; }
          .print\\:w-full { width: 100% !important; max-width: none !important; }
          .print\\:block { display: block !important; }
        }
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;700;900&family=JetBrains+Mono:wght@700;800&display=swap');
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        .font-tnr { font-family: 'Times New Roman', Times, serif; }
        body { font-family: 'Noto Sans TC', sans-serif; }
      `}} />
    </div>
  );
};

export default App;