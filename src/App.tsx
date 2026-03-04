import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  FileText, Upload, Printer, ChevronRight, Hash, 
  ArrowLeft, Settings, Search,
  CheckCircle2, FileSpreadsheet,
  Table as TableIcon, LayoutDashboard, Edit3, X, Trash,
  Download, Database, Layers, Sparkles, MessageSquare, Loader2,
  TrendingUp, DollarSign, Calendar, PieChart, BarChart3, Calculator,
  Cloud, CloudOff, Save, Archive, Plus, Trash2, MapPin, Package, KeyRound,
  RefreshCw, Plane, Warehouse
} from 'lucide-react';

// --- Firebase Imports ---
import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInAnonymously, onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, collection, doc, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot, writeBatch
} from 'firebase/firestore';

// --- 設定區：Firebase 設定 (已綁定專屬雲端) ---
const firebaseConfig = {
  apiKey: "AIzaSyDsGkGsWS4sRIn3o9XzWmqGSbZg4i5Dc9g",
  authDomain: "sa-test-96792.firebaseapp.com",
  projectId: "sa-test-96792",
  storageBucket: "sa-test-96792.firebasestorage.app",
  messagingSenderId: "736271192466",
  appId: "1:736271192466:web:1517c3d40e3e61d1c1b14b",
  measurementId: "G-1X3X3FWSM7"
};
const apiKeyDefault = "AIzaSyD6v4BGNqEzJwAUlSmijajj_jUU715wnXc"; 

// --- 預設的客戶櫃號設定 ---
const DEFAULT_CLIENT_CONFIG = {
  "AP": { startNo: 955, prefix: "AP" },
  "APS": { startNo: 858, prefix: "APS" },
  "CCHHH": { startNo: 138, prefix: "CCHHH" },
  "CH": { startNo: 276, prefix: "CH" },
  "CL": { startNo: 300, prefix: "CL" },
  "CS": { startNo: 125, prefix: "CS" },
  "CSK": { startNo: 586, prefix: "CSK" },
  "DP": { startNo: 424, prefix: "DP" },
  "HEC": { startNo: 22, prefix: "HEC" },
  "HRR": { startNo: 97, prefix: "HRR" },
  "PAT": { startNo: 30, prefix: "PAT" },
  "PCR": { startNo: 251, prefix: "PCR" },
  "PV": { startNo: 211, prefix: "PV" },
  "ROMA": { startNo: 11, prefix: "ROMA" },
  "SPN": { startNo: 127, prefix: "SPN" },
  "SRN": { startNo: 345, prefix: "SRN" },
  "SRR": { startNo: 115, prefix: "SRR" },
  "TC": { startNo: 304, prefix: "TC" },
  "TNC": { startNo: 838, prefix: "TNC" },
  "W": { startNo: 597, prefix: "W" },
  "WL": { startNo: 285, prefix: "WL" },
  "WP": { startNo: 274, prefix: "WP" }
};

// --- 智能數量解析大腦 (Smart Quantity Parsing) ---
const parseQuantity = (rawQtyStr, productName) => {
  if (!rawQtyStr) return { display: '', value: 0 };
  const str = String(rawQtyStr).trim().toUpperCase();

  // 若已經包含完整算式 (例如 40*30R+15=1215Y)
  if (str.includes('=') || str.includes('*')) {
      const match = str.match(/=([\d.]+)\s*Y?/);
      if (match) {
          return { display: str, value: parseFloat(match[1]) };
      } else {
          const numMatch = str.replace(/[^\d.-]/g, '');
          return { display: str, value: parseFloat(numMatch) || 0 };
      }
  }

  // 若只有純數字，進行智能逆向推算
  const qty = parseFloat(str.replace(/[^\d.-]/g, ''));
  if (isNaN(qty) || qty === 0) return { display: '0', value: 0 };

  let yPerRoll = 50; // 預設 50Y/R
  const pName = (productName || '').toUpperCase();
  
  if (pName.includes('210 PU')) {
      yPerRoll = 150;
  } else if (/(CHACK FACE|KEVLAR|LACOSTE|VACUUM|CHECKER|385|305)/.test(pName)) {
      yPerRoll = 40;
  }

  const rolls = Math.floor(qty / yPerRoll);
  const remainder = qty % yPerRoll;

  let display = '';
  if (rolls > 0) {
      display = `${yPerRoll}*${rolls}R`;
      if (remainder > 0) display += `+${remainder}`;
      display += `=${qty}Y`;
  } else {
      display = `${qty}Y`;
  }

  return { display, value: qty };
};

// --- AI Modal ---
const AiModal = ({ show, onClose, prompt, setPrompt, onSend, response, loading, hasKey }) => {
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
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
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
                        <input type="number" className="w-full border rounded-lg px-3 py-2 font-mono text-xl text-emerald-600 font-bold bg-emerald-50 border-emerald-200" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
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
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const appId = 'everise-app'; 

  // --- State ---
  const [user, setUser] = useState(null);
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

  const [userApiKey, setUserApiKey] = useState(() => localStorage.getItem('everise_gemini_key') || '');
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showRevenueModal, setShowRevenueModal] = useState(false); 

  const [clientConfig, setClientConfig] = useState(DEFAULT_CLIENT_CONFIG);

  const [vendorRules] = useState([
    { id: 1, keyword: "SANDWICH", vendor: "南泰" },
    { id: 2, keyword: "SPONGE", vendor: "南泰" },
    { id: 3, keyword: "600D", vendor: "龍利達" },
    { id: 4, keyword: "LACOSTE", vendor: "南泰" },
    { id: 5, keyword: "VACUMN", vendor: "龍利達" },
    { id: 6, keyword: "CC", vendor: "南泰" }
  ]);

  // --- Auth & Data Sync ---
  useEffect(() => {
    signInAnonymously(auth).catch(err => console.error("Auth Error:", err));
    return onAuthStateChanged(auth, u => setUser(u));
  }, [auth]);

  useEffect(() => {
    if (!user) return;
    setSyncStatus('syncing');
    const masterRef = collection(db, 'artifacts', appId, 'users', user.uid, 'master_data');
    const unsubMaster = onSnapshot(masterRef, (snap) => {
      setMasterData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setSyncStatus('idle');
    });

    const settingsRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'config');
    const unsubSettings = onSnapshot(settingsRef, (snap) => {
      if (snap.exists() && snap.data().clientConfig) {
        setClientConfig(snap.data().clientConfig);
      }
    });

    const revRef = collection(db, 'artifacts', appId, 'users', user.uid, 'manual_revenue');
    const unsubRev = onSnapshot(revRef, (snap) => {
        setManualRevenueData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubMaster(); unsubSettings(); unsubRev(); };
  }, [user, db, appId]);

  // --- Actions ---
  const saveMasterDataRow = async (row) => {
    const { id, ...data } = row;
    await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'master_data', id), data);
  };

  const updateMasterDataRow = async (id, updates) => {
    await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'master_data', id), updates);
  };

  const deleteMasterDataRow = async (id) => {
    await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'master_data', id));
  };

  const deleteBatchBySource = async (sourceName) => {
      if (!window.confirm(`警告：確定刪除來自 "${sourceName}" 的所有資料？`)) return;
      setSyncStatus('syncing');
      const targets = masterData.filter(d => d.source === sourceName);
      for (let i = 0; i < targets.length; i += 400) {
          const batch = writeBatch(db);
          targets.slice(i, i + 400).forEach(d => {
              batch.delete(doc(db, 'artifacts', appId, 'users', user.uid, 'master_data', d.id));
          });
          await batch.commit();
      }
      setSyncStatus('idle');
  };

  const addManualRevenue = async (data) => {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'manual_revenue'), { ...data, timestamp: Date.now() });
      setShowRevenueModal(false);
  };

  const deleteManualRevenue = async (id) => {
      if(window.confirm("確定刪除此筆營收紀錄？")) await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'manual_revenue', id));
  };

  const resetConfigToDefaults = async () => {
    if (window.confirm("確定要將所有客戶的櫃號起始值重置為系統預設值嗎？\n(這將根據您提供的 2026 最新數據進行重置)")) {
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'config'), { clientConfig: DEFAULT_CLIENT_CONFIG }, { merge: true });
      alert("重置完成！");
    }
  };

  // --- Helper Functions ---
  const startEditing = (record) => {
    setEditingId(record.id);
    editValues.current = { ...record };
  };

  const handleEditChange = (field, value) => {
    editValues.current[field] = value;
  };

  const saveEdit = () => {
    if (!editingId) return;
    const updates = { ...editValues.current };
    
    // 如果編輯了品名或出貨量字串，重新通過大腦進行智能解析
    if (updates.shippedDisplay !== undefined || updates.product !== undefined) {
        const finalProduct = updates.product !== undefined ? updates.product : masterData.find(x => x.id === editingId)?.product;
        const finalDisplay = updates.shippedDisplay !== undefined ? updates.shippedDisplay : masterData.find(x => x.id === editingId)?.shippedDisplay;
        
        const parsed = parseQuantity(finalDisplay, finalProduct);
        updates.shippedDisplay = parsed.display;
        updates.shippedQty = parsed.value;
    }

    updateMasterDataRow(editingId, updates);
    setEditingId(null);
    editValues.current = {};
  };

  const handleDelete = (id) => {
      if(window.confirm("確定要永久刪除此筆資料嗎？")) {
          deleteMasterDataRow(id);
      }
  }

  // --- CSV Import Logic (Auto Detect Origin by Filename) ---
  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const rows = event.target.result.split(/\r?\n/).filter(r => r.trim());
        if (rows.length < 1) return;
        const headers = rows[0].split(',').map(h => h.trim().toLowerCase());
        
        if (headers.includes('client') && headers.includes('number')) {
             const newConfig = { ...clientConfig };
             rows.slice(1).forEach(r => {
                 const [c, n] = r.split(',');
                 if (c && n) newConfig[c.toUpperCase().trim()] = { startNo: parseInt(n) || 1, prefix: c.toUpperCase().trim() };
             });
             await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'config'), { clientConfig: newConfig }, { merge: true });
             return;
        }

        const isChina = file.name.toLowerCase().includes('china');
        const origin = isChina ? 'China' : 'ER';

        const getIdx = (keys) => headers.findIndex(h => keys.some(k => h.includes(k)));
        const idx = {
            date: getIdx(['date', '日期']), client: getIdx(['client', '客戶']),
            product: getIdx(['product', '品名', 'spec']), color: getIdx(['color', '顏色']),
            shipped: getIdx(['quantity', '數量', '出貨']), price: getIdx(['price', '單價']),
            cabinet: getIdx(['cabinet', '櫃號']), order: getIdx(['order', '訂單']),
            status: getIdx(['status', '結案']), note: getIdx(['note', '備註'])
        };

        const promises = rows.slice(1).map((row, rIdx) => {
            const cols = [];
            let cur = '';
            let inQuote = false;
            for (let i = 0; i < row.length; i++) {
                let char = row[i];
                if (char === '"') inQuote = !inQuote;
                else if (char === ',' && !inQuote) {
                    cols.push(cur.trim());
                    cur = '';
                } else cur += char;
            }
            cols.push(cur.trim());

            if (cols.length < 3) return null;

            const productName = cols[idx.product]?.replace(/"/g, '') || '';
            const matched = vendorRules.find(rule => productName.toUpperCase().includes(rule.keyword));
            
            // 透過智能大腦解析數量
            const parsedQty = parseQuantity(cols[idx.shipped], productName);
            
            return saveMasterDataRow({
                id: `${file.name}-${rIdx}-${Date.now()}`,
                date: cols[idx.date] || '',
                client: (cols[idx.client] || 'UNKNOWN').toUpperCase().replace(/"/g, ''),
                product: productName,
                color: (cols[idx.color] || '').replace(/"/g, ''),
                shippedQty: parsedQty.value,
                shippedDisplay: parsedQty.display,
                price: parseFloat(cols[idx.price]?.replace(/[^\d.-]/g, '')) || 0,
                vendor: matched ? matched.vendor : "待查",
                cabinetNo: cols[idx.cabinet] ? cols[idx.cabinet].replace(/"/g, '') : '',
                orderNo: cols[idx.order] || 'N/A',
                status: cols[idx.status] || '',
                note: cols[idx.note] || '',
                source: file.name,
                origin: origin,
                timestamp: Date.now()
            });
        });
        await Promise.all(promises.filter(p => p !== null));
        setViewMode('dashboard');
      };
      reader.readAsText(file);
    });
    e.target.value = ''; 
  };

  const exportTrackingCSV = () => {
    const headers = ["下單日期", "訂單", "廠商", "產地", "品名", "顏色", "訂單數量", "實際出貨", "未出貨", "櫃號", "結案", "備註"];
    const csvRows = [headers.join(",")];
    filteredMasterData.forEach(d => {
      const row = [d.date, d.orderNo, d.vendor, d.origin, `"${d.product}"`, d.color, d.orderQty || 0, `"${d.shippedDisplay || d.shippedQty}"`, (d.orderQty || 0) - d.shippedQty, d.cabinetNo, d.status, `"${d.note}"`];
      csvRows.push(row.join(","));
    });
    const blob = new Blob(["\uFEFF" + csvRows.join("\n")], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `訂單進度總表_${activeMasterClient}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // --- Revenue Logic ---
  useEffect(() => {
    const stats = {};
    const process = (date, client, amount, source) => {
        const d = new Date(date);
        if (isNaN(d.getTime())) return;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!stats[key]) stats[key] = { monthKey: key, year: d.getFullYear(), month: d.getMonth() + 1, total: 0, warehouseTotal: 0, chinaTotal: 0, otherTotal: 0, clientMap: {} };
        const m = stats[key];
        m.total += amount;
        
        const srcLower = (source || '').toLowerCase();
        if (srcLower === 'china') {
            m.chinaTotal += amount;
        } else if (srcLower === 'warehouse' || srcLower === 'er') {
            m.warehouseTotal += amount;
        } else {
            m.otherTotal += amount;
        }
        
        if (!m.clientMap[client]) m.clientMap[client] = { total: 0, sources: {} };
        m.clientMap[client].total += amount;
        
        let displaySource = 'Other';
        if (srcLower === 'china') displaySource = 'China';
        else if (srcLower === 'warehouse' || srcLower === 'er') displaySource = 'Warehouse';
        
        m.clientMap[client].sources[displaySource] = (m.clientMap[client].sources[displaySource] || 0) + amount;
    };

    masterData.forEach(d => {
        const origin = d.origin || 'Warehouse'; 
        process(d.date, d.client, d.shippedQty * d.price, origin);
    });
    
    manualRevenueData.forEach(d => process(d.date, d.client, d.amount, d.source || "China"));

    setRevenueData(Object.values(stats).map(m => ({
        ...m, clients: Object.entries(m.clientMap).map(([client, data]) => ({ client, amount: data.total, sources: data.sources })).sort((a,b) => b.amount - a.amount)
    })).sort((a,b) => b.monthKey.localeCompare(a.monthKey)));
  }, [masterData, manualRevenueData]);

  // --- Computed ---
  const sortedClients = useMemo(() => [...new Set(masterData.map(d => d.client))].sort(), [masterData]);
  const filteredMasterData = useMemo(() => {
    let d = masterData;
    if (activeMasterClient !== 'ALL') d = d.filter(x => x.client === activeMasterClient);
    if (searchTerm) d = d.filter(x => x.product.toLowerCase().includes(searchTerm.toLowerCase()) || x.orderNo?.toLowerCase().includes(searchTerm.toLowerCase()));
    return d.sort((a,b) => new Date(a.date) - new Date(b.date));
  }, [masterData, activeMasterClient, searchTerm]);

  const groupedInvoices = useMemo(() => {
    const res = {};
    sortedClients.forEach(c => {
        const rows = masterData.filter(d => d.client === c && d.shippedQty > 0);
        const dates = [...new Set(rows.map(r => r.date))].sort((a, b) => new Date(a) - new Date(b));
        
        res[c] = dates.map((date, idx) => {
            const items = rows.filter(r => r.date === date);
            const conf = clientConfig[c] || { startNo: 1, prefix: c };
            const origin = items[0]?.origin || 'ER'; 
            
            return { 
                id: `${c}-${date}`, 
                date, 
                cabinetNo: items[0]?.cabinetNo || `${conf.prefix}#${conf.startNo + idx}`, 
                client: c, 
                items, 
                origin, 
                total: items.reduce((s, i) => s + (i.shippedQty * i.price), 0) 
            };
        });
    });
    return res;
  }, [masterData, clientConfig, sortedClients]);

  const callGemini = async () => {
    // 省略未修改的 AI 區塊...
  };

  // --- Components ---
  const Navbar = () => (
    <div className="bg-slate-900 border-b border-slate-700 sticky top-0 z-50 px-6 py-3 flex justify-between items-center print:hidden">
      <div className="flex items-center gap-6">
        <h1 className="text-xl font-black text-white flex items-center gap-2"><Database className="w-6 h-6 text-emerald-400" /> EVERISE</h1>
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
        {/* 新增了手動記帳的顯眼按鈕 */}
        <button onClick={() => setShowRevenueModal(true)} className="bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 rounded-lg cursor-pointer font-bold text-xs flex items-center gap-2 transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> 手動記帳
        </button>
        <button onClick={() => setShowAiModal(true)} className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition-colors"><Sparkles className="w-4 h-4" /> AI 分析</button>
        <button onClick={() => setViewMode('settings')} className="p-2 text-slate-400 hover:text-white"><Settings className="w-5 h-5" /></button>
        <label className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg cursor-pointer font-bold text-xs flex items-center gap-2 shadow-sm">
          <Upload className="w-4 h-4" /> 匯入 CSV
          <input type="file" accept=".csv" multiple className="hidden" onChange={handleFileUpload} />
        </label>
      </div>
    </div>
  );

  const TrackingTableView = () => (
    // ...保持原樣，僅調整數量顯示...
    <td className="p-2 border-r border-slate-200 text-right font-mono font-bold text-blue-600">{d.shippedDisplay || d.shippedQty}</td>
    // ...
  );

  const MasterTableView = () => (
    <div className="p-6 animate-in fade-in duration-500 min-h-screen bg-slate-50">
      <div className="mb-6 flex justify-between items-center bg-white p-4 rounded-xl shadow-sm">
        <h2 className="text-xl font-black text-slate-800 flex items-center gap-2"><Edit3 className="w-5 h-5 text-blue-600" /> 年度明細編輯 (Master Data)</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
          <input type="text" placeholder="搜尋..." className="pl-9 pr-4 py-2 border rounded-lg text-sm w-64" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto max-h-[80vh]">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 border-b border-slate-300 sticky top-0 z-10 text-xs font-bold text-slate-600">
              <tr>
                <th className="p-3 w-24">日期</th>
                <th className="p-3 w-20">客戶</th>
                <th className="p-3 w-24">櫃號</th>
                <th className="p-3 w-24">產地</th>
                <th className="p-3">品名</th>
                <th className="p-3 w-24">顏色</th>
                <th className="p-3 w-32 text-right">出貨量 (支援算式)</th>
                <th className="p-3 w-20 text-right">單價</th>
                <th className="p-3 w-24">廠商</th>
                <th className="p-3 w-24 text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMasterData.map(d => (
                <tr key={d.id} className={`hover:bg-blue-50 ${editingId === d.id ? 'bg-yellow-50' : ''}`}>
                  {editingId === d.id ? (
                    <>
                      <td className="p-2"><input className="border rounded p-1 w-full" defaultValue={d.date} onChange={e => handleEditChange('date', e.target.value)} /></td>
                      <td className="p-2 font-bold">{d.client}</td>
                      <td className="p-2"><input className="border rounded p-1 w-full font-bold text-blue-600" defaultValue={d.cabinetNo} onChange={e => handleEditChange('cabinetNo', e.target.value)} placeholder="自動" /></td>
                      <td className="p-2">
                          <select className="border rounded p-1 w-full" defaultValue={d.origin || 'ER'} onChange={e => handleEditChange('origin', e.target.value)}>
                              <option value="ER">ER</option>
                              <option value="China">China</option>
                          </select>
                      </td>
                      <td className="p-2"><input className="border rounded p-1 w-full font-bold" autoFocus defaultValue={d.product} onChange={e => handleEditChange('product', e.target.value)} /></td>
                      <td className="p-2"><input className="border rounded p-1 w-full" defaultValue={d.color} onChange={e => handleEditChange('color', e.target.value)} /></td>
                      {/* 出貨量改為可以輸入字串 */}
                      <td className="p-2"><input className="border rounded p-1 w-full text-right" type="text" defaultValue={d.shippedDisplay || d.shippedQty} onChange={e => handleEditChange('shippedDisplay', e.target.value)} /></td>
                      <td className="p-2"><input className="border rounded p-1 w-full text-right" type="number" defaultValue={d.price} onChange={e => handleEditChange('price', parseFloat(e.target.value))} /></td>
                      <td className="p-2"><input className="border rounded p-1 w-full" defaultValue={d.vendor} onChange={e => handleEditChange('vendor', e.target.value)} /></td>
                      <td className="p-2 text-center flex gap-1 justify-center">
                        <button onClick={saveEdit} className="p-1 bg-green-500 text-white rounded hover:bg-green-600"><CheckCircle2 className="w-4 h-4" /></button>
                        <button onClick={() => setEditingId(null)} className="p-1 bg-slate-300 text-white rounded hover:bg-slate-400"><X className="w-4 h-4" /></button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="p-3 text-slate-500">{d.date}</td>
                      <td className="p-3 font-bold text-slate-700">{d.client}</td>
                      <td className="p-3 font-bold text-blue-600">{d.cabinetNo || <span className="text-slate-300 italic text-xs">Auto</span>}</td>
                      <td className="p-3 text-xs font-bold">{d.origin === 'China' ? <span className="text-red-500 bg-red-50 px-2 py-1 rounded">China</span> : <span className="text-blue-500 bg-blue-50 px-2 py-1 rounded">ER</span>}</td>
                      <td className="p-3 font-bold text-slate-800">{d.product}</td>
                      <td className="p-3 text-slate-600">{d.color}</td>
                      <td className="p-3 text-right font-mono font-bold text-blue-600">{d.shippedDisplay || d.shippedQty}</td>
                      <td className="p-3 text-right font-mono text-emerald-600">{d.price}</td>
                      <td className="p-3 text-slate-400">{d.vendor}</td>
                      <td className="p-3 text-center flex gap-2 justify-center">
                        <button onClick={() => startEditing(d)} className="text-slate-300 hover:text-blue-500"><Edit3 className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(d.id)} className="text-slate-300 hover:text-red-500"><Trash className="w-4 h-4" /></button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const Dashboard = () => {
    // 省略未修改區塊，主要使用 item.shippedDisplay 替換...
  };

  const InvoiceTemplate = ({ inv }) => (
    <div className="w-[210mm] bg-white p-[10mm] min-h-[297mm] flex flex-col font-tnr text-black invoice-page mx-auto">
      <div className="text-center mb-4 border-b-[2px] border-double border-black pb-2">
        <h1 className="text-2xl font-bold mb-1 uppercase">EVERISE MATERIAL INT'L LTD</h1>
        <p className="text-xs font-bold">TEL: 886-2-2741-9113 | FAX: 886-2-2727-9021</p>
        <p className="text-xs underline font-bold">E-MAIL: e.material2727@gmail.com</p>
        <div className="inline-block border-[2px] border-black px-8 py-1 font-bold text-2xl mt-2">SHIPPING ADVICE</div>
      </div>
      <div className="grid grid-cols-2 mb-4 text-base">
        <div className="space-y-1">
          <div className="border-b border-black pb-0.5"><span className="font-bold text-sm mr-2">TO:</span><span className="font-bold uppercase text-lg">{inv.client}</span></div>
          <div className="border-b border-black pb-0.5 flex items-end">
              <span className="font-bold text-sm mr-2">FROM:</span>
              <span className="font-bold text-base">{inv.origin === 'China' ? 'China' : 'ER'}</span>
          </div>
        </div>
        <div className="space-y-1 pl-4">
          <div className="border-b border-black pb-0.5 flex justify-between"><span>DATE:</span><span className="font-bold">{inv.date}</span></div>
          <div className="border-b border-black pb-0.5 flex justify-between"><span>C/NO:</span><span className="font-bold text-xl">{inv.cabinetNo}</span></div>
        </div>
      </div>
      <table className="w-full border-t-[2px] border-black">
        <tbody className="divide-y divide-black">
          {inv.items.map((item, idx) => (
            <React.Fragment key={idx}>
              <tr><td colSpan="3" className="pt-2 pb-1 font-bold text-lg">ORDER "{item.product}"</td></tr>
              <tr className="text-sm">
                <td className="w-1/3 py-1 font-bold uppercase">{item.color}</td>
                {/* 套用智能數量的顯示格式 */}
                <td className="py-1 text-center font-mono">{item.shippedDisplay || item.shippedQty + ' Y'} x {item.price.toFixed(2)} = THB</td>
                <td className="py-1 text-right font-bold text-base">{(item.shippedQty * item.price).toLocaleString()}</td>
              </tr>
            </React.Fragment>
          ))}
        </tbody>
      </table>
      <div className="mt-6 border-t-[4px] border-double border-black pt-4 flex justify-between items-baseline px-2">
        <span className="font-bold text-xl">TOTAL:</span>
        <span className="font-bold text-3xl">THB {Math.round(inv.total).toLocaleString()}</span>
      </div>
      <div className="mt-auto border-t-2 border-black pt-2 flex justify-between">
        <div className="font-bold underline text-xl tracking-widest uppercase">CASH</div>
        <div className="text-[10px] font-bold uppercase">Shipping Advice Doc.</div>
      </div>
    </div>
  );

  const PrintAllView = () => { /* ... */ };

  return (
      // ...省略未修改的 Main Render Logic...
  );
};

export default App;