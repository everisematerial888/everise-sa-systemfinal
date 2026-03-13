import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  FileText, Upload, Printer, ChevronRight, Hash, 
  ArrowLeft, Settings, Search,
  CheckCircle2, FileSpreadsheet,
  Table as TableIcon, LayoutDashboard, Edit3, X, Trash,
  Download, Database, Layers, Sparkles, MessageSquare, Loader2,
  TrendingUp, DollarSign, Calendar, PieChart, BarChart3, Calculator,
  Cloud, CloudOff, Save, Archive, Plus, Trash2, MapPin, Package, KeyRound,
  RefreshCw, Plane, Warehouse, Filter
} from 'lucide-react';

// --- Firebase Imports ---
import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInAnonymously, onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, collection, doc, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot, writeBatch
} from 'firebase/firestore';

// --- Dynamic Load html2pdf ---
const loadHtml2Pdf = () => {
    return new Promise((resolve) => {
        if (window.html2pdf) return resolve(window.html2pdf);
        const script = document.createElement('script');
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
        script.onload = () => resolve(window.html2pdf);
        document.body.appendChild(script);
    });
};

// --- Firebase Config ---
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

// --- Default Client C/NO Config ---
const DEFAULT_CLIENT_CONFIG = {
  "AP": { startNo: 955, prefix: "AP" },
  "APS": { startNo: 860, prefix: "APS" },
  "CCHHH": { startNo: 138, prefix: "CCHHH" },
  "CH": { startNo: 276, prefix: "CH" },
  "CL": { startNo: 300, prefix: "CL" },
  "CS": { startNo: 125, prefix: "CS" },
  "CSK": { startNo: 586, prefix: "CSK" },
  "DP": { startNo: 424, prefix: "DP" },
  "HEC": { startNo: 22, prefix: "HEC" },
  "HRR": { startNo: 97, prefix: "HRR" },
  "PAT": { startNo: 29, prefix: "PAT" },
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

// --- Smart Quantity Parsing Brain ---
const parseQuantity = (rawQtyStr, productName) => {
  if (!rawQtyStr) return { display: '', value: 0 };
  const str = String(rawQtyStr).trim().toUpperCase();

  if (str.includes('=') || str.includes('*')) {
      const match = str.match(/=([\d.]+)\s*Y?/);
      if (match) {
          return { display: str, value: parseFloat(match[1]) };
      } else {
          const numMatch = str.replace(/[^\d.-]/g, '');
          return { display: str, value: parseFloat(numMatch) || 0 };
      }
  }

  const qty = parseFloat(str.replace(/[^\d.-]/g, ''));
  if (isNaN(qty) || qty === 0) return { display: '0', value: 0 };

  let yPerRoll = 50; 
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
            <Sparkles className="w-5 h-5 text-purple-600" /> AI Data Analysis
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full"><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <div className="flex-1 overflow-auto p-6 bg-slate-50">
          {!hasKey && (
            <div className="mb-4 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm flex gap-2 items-start">
              <KeyRound className="w-5 h-5 shrink-0" />
              <div>
                <p className="font-bold">No Gemini API Key Set</p>
                <p>Please go to 'Settings' to enter your API Key to use the AI Analysis feature.</p>
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
              <p>Enter a question to let AI analyze current order data...</p>
            </div>
          )}
        </div>
        <div className="p-4 bg-white border-t flex gap-2">
          <input 
            type="text" 
            className="flex-1 border rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 focus:outline-none disabled:bg-slate-100"
            placeholder="e.g., Top 3 clients with highest shipped volume this month?"
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
            {loading ? 'Analyzing...' : 'Send'}
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
            alert("Please fill in all required fields (Date, Client, Amount)");
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
                        <Plus className="w-5 h-5 text-emerald-600" /> Add Extra Revenue
                    </h3>
                    <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
                </div>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Ship Date</label>
                            <input type="date" className="w-full border rounded-lg px-3 py-2 font-mono" value={date} onChange={e => setDate(e.target.value)} />
                        </div>
                        <div>
                             <label className="block text-xs font-bold text-slate-500 mb-1">Origin</label>
                             <select className="w-full border rounded-lg px-3 py-2 bg-slate-50" value={source} onChange={e => setSource(e.target.value)}>
                                 <option value="China">China</option>
                                 <option value="Warehouse">Warehouse</option>
                                 <option value="Other">Other</option>
                             </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Client Name</label>
                            <input type="text" className="w-full border rounded-lg px-3 py-2 font-bold uppercase" value={client} onChange={e => setClient(e.target.value)} placeholder="e.g., APS" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Client C/NO</label>
                            <input type="text" className="w-full border rounded-lg px-3 py-2" value={cabinetNo} onChange={e => setCabinetNo(e.target.value)} placeholder="e.g., SRR#114" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Amount (THB)</label>
                        <input type="number" className="w-full border rounded-lg px-3 py-2 font-mono text-xl text-emerald-600 font-bold bg-emerald-50 border-emerald-200" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Note (Optional)</label>
                        <input type="text" className="w-full border rounded-lg px-3 py-2" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g., C4 SHINY" />
                    </div>
                </div>
                <div className="mt-8 flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 rounded-lg font-bold text-slate-500 hover:bg-slate-100">Close</button>
                    <button onClick={handleSubmit} className="flex-[2] py-3 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200">Save & Add Next</button>
                </div>
            </div>
        </div>
    );
};

const App = () => {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

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
  const [editingId, setEditingId] = useState(null);
  const editValues = useRef({}); 

  // --- Filter State ---
  const [filterMonth, setFilterMonth] = useState('ALL');
  const [filterOrigin, setFilterOrigin] = useState('ALL');
  const [activeMasterClient, setActiveMasterClient] = useState('ALL');

  const [userApiKey, setUserApiKey] = useState(() => localStorage.getItem('everise_gemini_key') || '');
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showRevenueModal, setShowRevenueModal] = useState(false); 
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [clientConfig, setClientConfig] = useState(DEFAULT_CLIENT_CONFIG);

  // --- Auth & Data Sync ---
  useEffect(() => {
    signInAnonymously(auth).catch(err => console.error("Auth Error:", err));
    return onAuthStateChanged(auth, u => setUser(u));
  }, [auth]);

  useEffect(() => {
    if (!user) return;
    setSyncStatus('syncing');
    
    const masterRef = collection(db, 'everise_system', 'shared', 'master_data');
    const unsubMaster = onSnapshot(masterRef, (snap) => {
      setMasterData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setSyncStatus('idle');
    }, (error) => {
        console.warn("Database Read Blocked by Rules:", error);
    });

    const settingsRef = doc(db, 'everise_system', 'shared', 'settings', 'config');
    const unsubSettings = onSnapshot(settingsRef, (snap) => {
      if (snap.exists() && snap.data().clientConfig) {
        setClientConfig(snap.data().clientConfig);
      }
    });

    const revRef = collection(db, 'everise_system', 'shared', 'manual_revenue');
    const unsubRev = onSnapshot(revRef, (snap) => {
        setManualRevenueData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubMaster(); unsubSettings(); unsubRev(); };
  }, [user, db]);

  // --- Actions ---
  const saveMasterDataRow = async (row) => {
    const { id, ...data } = row;
    await setDoc(doc(db, 'everise_system', 'shared', 'master_data', id), data);
  };

  const updateMasterDataRow = async (id, updates) => {
    await updateDoc(doc(db, 'everise_system', 'shared', 'master_data', id), updates);
  };

  const deleteMasterDataRow = async (id) => {
    await deleteDoc(doc(db, 'everise_system', 'shared', 'master_data', id));
  };

  const deleteBatchBySource = async (sourceName) => {
      if (!window.confirm(`Warning: Are you sure you want to delete all data from "${sourceName}"?`)) return;
      setSyncStatus('syncing');
      try {
          const targets = masterData.filter(d => d.source === sourceName);
          for (let i = 0; i < targets.length; i += 400) {
              const batch = writeBatch(db);
              targets.slice(i, i + 400).forEach(d => {
                  batch.delete(doc(db, 'everise_system', 'shared', 'master_data', d.id));
              });
              await batch.commit();
          }
      } catch(e) {
          alert('Delete failed, please check permissions! Error: ' + e.message);
      }
      setSyncStatus('idle');
  };

  const addManualRevenue = async (data) => {
      try {
          await addDoc(collection(db, 'everise_system', 'shared', 'manual_revenue'), { ...data, timestamp: Date.now() });
          setShowRevenueModal(false);
      } catch(e) {
          alert('Save failed, please check Firebase permissions! Error: ' + e.message);
      }
  };

  const deleteManualRevenue = async (id) => {
      if(window.confirm("Are you sure you want to delete this revenue record?")) {
          try {
              await deleteDoc(doc(db, 'everise_system', 'shared', 'manual_revenue', id));
          } catch(e) { alert('Delete failed: ' + e.message); }
      }
  };

  const resetConfigToDefaults = async () => {
    if (window.confirm("Are you sure you want to reset all client starting C/NO to system defaults?")) {
      try {
          await setDoc(doc(db, 'everise_system', 'shared', 'settings', 'config'), { clientConfig: DEFAULT_CLIENT_CONFIG }, { merge: true });
          alert("Reset completed!");
      } catch(e) { alert('Reset failed: ' + e.message); }
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
    
    if (updates.shippedDisplay !== undefined || updates.product !== undefined) {
        const finalProduct = updates.product !== undefined ? updates.product : masterData.find(x => x.id === editingId)?.product;
        const finalDisplay = updates.shippedDisplay !== undefined ? updates.shippedDisplay : masterData.find(x => x.id === editingId)?.shippedDisplay;
        
        const parsed = parseQuantity(finalDisplay, finalProduct);
        updates.shippedDisplay = parsed.display;
        updates.shippedQty = parsed.value;
    }

    try {
        updateMasterDataRow(editingId, updates);
    } catch(e) { alert('Save failed: ' + e.message); }
    
    setEditingId(null);
    editValues.current = {};
  };

  const handleDelete = (id) => {
      if(window.confirm("Are you sure you want to permanently delete this record?")) {
          deleteMasterDataRow(id).catch(e => alert('Delete failed: '+e.message));
      }
  }

  // --- CSV Import Logic ---
  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    setIsUploading(true);

    try {
        for (const file of files) {
            const text = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (event) => resolve(event.target.result);
                reader.onerror = (error) => reject(error);
                reader.readAsText(file);
            });

            const rows = text.split(/\r?\n/).filter(r => r.trim());
            if (rows.length < 1) continue;
            const headers = rows[0].split(',').map(h => h.trim().toLowerCase());
            
            if (headers.includes('client') && headers.includes('number')) {
                 const newConfig = { ...clientConfig };
                 rows.slice(1).forEach(r => {
                     const [c, n] = r.split(',');
                     if (c && n) newConfig[c.toUpperCase().trim()] = { startNo: parseInt(n) || 1, prefix: c.toUpperCase().trim() };
                 });
                 await setDoc(doc(db, 'everise_system', 'shared', 'settings', 'config'), { clientConfig: newConfig }, { merge: true });
                 continue;
            }

            const isChina = file.name.toLowerCase().includes('china');
            const origin = isChina ? 'China' : 'ER';

            // Keeps fallback for Chinese headers inside CSV files
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
        }
        
        alert("Upload Successful!");
        setViewMode('dashboard');
        
    } catch (error) {
        console.error("Upload error:", error);
        alert(`Upload Failed!\n\nReason might be Firebase Security Rules.\nPlease set Rules to 'allow read, write: if true;'\n\nError: ${error.message}`);
    } finally {
        setIsUploading(false);
        e.target.value = ''; 
    }
  };

  // --- Computed Base Lists ---
  const sortedClients = useMemo(() => [...new Set(masterData.map(d => d.client))].sort(), [masterData]);
  const availableMonths = useMemo(() => [...new Set(masterData.map(d => d.date?.substring(0, 7)))].filter(Boolean).sort().reverse(), [masterData]);

  const allGroupedInvoices = useMemo(() => {
    const res = {};
    sortedClients.forEach(c => {
        const rows = masterData.filter(d => d.client === c && d.shippedQty > 0);
        const dates = [...new Set(rows.map(r => r.date))].sort((a, b) => new Date(a) - new Date(b));
        
        res[c] = dates.map((date, idx) => {
            const items = rows.filter(r => r.date === date);
            const conf = clientConfig[c] || { startNo: 1, prefix: c };
            const paddedNo = String(conf.startNo + idx).padStart(3, '0');
            const origin = items[0]?.origin || 'ER'; 
            
            const total = items.reduce((s, i) => s + Math.round(i.shippedQty * i.price), 0);
            
            return { 
                id: `${c}-${date}`, 
                date, 
                cabinetNo: items[0]?.cabinetNo || `${conf.prefix}#${paddedNo}`, 
                client: c, 
                items, 
                origin, 
                total 
            };
        });
    });
    return res;
  }, [masterData, clientConfig, sortedClients]);

  const displayedGroupedInvoices = useMemo(() => {
      const res = {};
      Object.keys(allGroupedInvoices).forEach(client => {
          if (activeMasterClient !== 'ALL' && client !== activeMasterClient) return;
          
          let invs = allGroupedInvoices[client];
          if (filterMonth !== 'ALL') invs = invs.filter(inv => inv.date.startsWith(filterMonth));
          if (filterOrigin !== 'ALL') invs = invs.filter(inv => inv.origin === filterOrigin);
          
          if (invs.length > 0) res[client] = invs;
      });
      return res;
  }, [allGroupedInvoices, filterMonth, filterOrigin, activeMasterClient]);

  const filteredMasterData = useMemo(() => {
    let d = masterData;
    if (activeMasterClient !== 'ALL') d = d.filter(x => x.client === activeMasterClient);
    if (filterMonth !== 'ALL') d = d.filter(x => x.date?.startsWith(filterMonth));
    if (filterOrigin !== 'ALL') d = d.filter(x => x.origin === filterOrigin);
    if (searchTerm) d = d.filter(x => x.product.toLowerCase().includes(searchTerm.toLowerCase()) || x.orderNo?.toLowerCase().includes(searchTerm.toLowerCase()));
    return d.sort((a,b) => new Date(a.date) - new Date(b.date));
  }, [masterData, activeMasterClient, filterMonth, filterOrigin, searchTerm]);

  // --- Export Logic ---
  const exportTrackingCSV = () => {
    const headers = ["Date", "Order", "Origin", "Spec", "Color", "Order Qty", "Shipped", "Unshipped", "C/NO", "Status", "Note"];
    const csvRows = [headers.join(",")];
    filteredMasterData.forEach(d => {
      const dynamicCabinet = d.cabinetNo || allGroupedInvoices[d.client]?.find(inv => inv.date === d.date)?.cabinetNo || "";
      const row = [d.date, d.orderNo, d.origin, `"${d.product}"`, d.color, d.orderQty || 0, `"${d.shippedDisplay || d.shippedQty}"`, (d.orderQty || 0) - d.shippedQty, dynamicCabinet, d.status, `"${d.note}"`];
      csvRows.push(row.join(","));
    });
    const blob = new Blob(["\uFEFF" + csvRows.join("\n")], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Tracking_Table_${activeMasterClient}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // --- Batch PDF Download Logic ---
  const downloadBatchPdfs = async () => {
      const invoicesToDownload = [];
      Object.values(displayedGroupedInvoices).forEach(invs => invoicesToDownload.push(...invs));

      if (invoicesToDownload.length === 0) {
          alert('No SA found to download under current filter. Please ensure data is selected!');
          return;
      }

      if (!window.confirm(`Ready to batch download ${invoicesToDownload.length} SA PDFs.\n(If this is your first time, the browser might block multiple downloads, please click 'Allow'.)`)) return;

      setIsDownloadingPdf(true);
      try {
          const html2pdf = await loadHtml2Pdf();
          for (let i = 0; i < invoicesToDownload.length; i++) {
              const inv = invoicesToDownload[i];
              const element = document.getElementById(`invoice-capture-${inv.id}`);
              if (!element) continue;

              const filename = inv.origin === 'China' ? `${inv.cabinetNo}CN.pdf` : `${inv.cabinetNo}.pdf`;

              await html2pdf().set({
                  margin: 0,
                  filename: filename,
                  image: { type: 'jpeg', quality: 0.98 },
                  html2canvas: { scale: 2, useCORS: true, logging: false },
                  jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
              }).from(element).save();

              await new Promise(resolve => setTimeout(resolve, 800)); 
          }
      } catch (error) {
          console.error("PDF generation failed:", error);
          alert("Error occurred during download. Please try again.");
      }
      setIsDownloadingPdf(false);
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
        const roundedAmount = Math.round(d.shippedQty * d.price);
        process(d.date, d.client, roundedAmount, origin);
    });
    
    manualRevenueData.forEach(d => process(d.date, d.client, Math.round(d.amount), d.source || "China"));

    setRevenueData(Object.values(stats).map(m => ({
        ...m, clients: Object.entries(m.clientMap).map(([client, data]) => ({ client, amount: data.total, sources: data.sources })).sort((a,b) => b.amount - a.amount)
    })).sort((a,b) => b.monthKey.localeCompare(a.monthKey)));
  }, [masterData, manualRevenueData]);

  const callGemini = async () => {
    const keyToUse = userApiKey || apiKeyDefault;
    if (!aiPrompt.trim() || !keyToUse) return;
    setIsAiLoading(true);
    try {
      const dataSummary = filteredMasterData.slice(0, 50).map(d => ({ date: d.date, client: d.client, product: d.product, qty: d.shippedQty, price: d.price }));
      const revenueSummary = revenueData.slice(0, 6).map(r => `${r.monthKey}: ${r.total} THB`).join('\n');
      const systemPrompt = `You are a professional analyst. Units are in THB. Revenue Summary:\n${revenueSummary}\nDetails Ref:\n${JSON.stringify(dataSummary)}`;
      
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${keyToUse}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: `${systemPrompt}\n\nQuestion: ${aiPrompt}` }] }] })
      });
      const data = await res.json();
      setAiResponse(data.candidates?.[0]?.content?.parts?.[0]?.text || "No Response");
    } catch (e) { setAiResponse("Error: " + e.message); }
    finally { setIsAiLoading(false); }
  };

  // --- Components ---
  const Navbar = () => (
    <>
      <div className="bg-slate-900 border-b border-slate-700 sticky top-0 z-50 px-6 py-3 flex justify-between items-center print:hidden">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-black text-white flex items-center gap-2"><Database className="w-6 h-6 text-emerald-400" /> EVERISE</h1>
          <div className="flex bg-slate-800 p-1 rounded-lg overflow-x-auto">
            {[
              { id: 'dashboard', label: 'SA Dashboard', icon: LayoutDashboard },
              { id: 'trackingTable', label: 'Tracking Table', icon: FileSpreadsheet },
              { id: 'masterTable', label: 'Master Table', icon: TableIcon },
              { id: 'revenueStats', label: 'Revenue Stats', icon: TrendingUp }, 
              { id: 'dataManagement', label: 'Data Management', icon: Archive },
            ].map(tab => (
              <button key={tab.id} onClick={() => setViewMode(tab.id)} className={`px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${viewMode === tab.id ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                <tab.icon className="w-4 h-4" /> {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-3 items-center">
          <button onClick={() => setShowRevenueModal(true)} className="bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 rounded-lg cursor-pointer font-bold text-xs flex items-center gap-2 transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Manual Entry
          </button>
          <button onClick={() => setShowAiModal(true)} className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition-colors"><Sparkles className="w-4 h-4" /> AI Analysis</button>
          <button onClick={() => setViewMode('settings')} className="p-2 text-slate-400 hover:text-white"><Settings className="w-5 h-5" /></button>
          
          <label className={`bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg cursor-pointer font-bold text-xs flex items-center gap-2 shadow-sm transition-all ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {isUploading ? 'Processing...' : 'Import CSV'}
            <input type="file" accept=".csv" multiple className="hidden" onChange={handleFileUpload} disabled={isUploading} />
          </label>
        </div>
      </div>
      
      {/* Filter Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-2 flex gap-4 items-center print:hidden shadow-sm sticky top-[60px] z-40">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-bold text-slate-400">Global Filter:</span>
          
          <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="border border-slate-300 rounded-md text-sm font-bold text-slate-700 py-1 px-2 focus:ring-2 focus:ring-emerald-500 outline-none">
              <option value="ALL">All Months</option>
              {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          
          <select value={filterOrigin} onChange={e => setFilterOrigin(e.target.value)} className="border border-slate-300 rounded-md text-sm font-bold text-slate-700 py-1 px-2 focus:ring-2 focus:ring-emerald-500 outline-none">
              <option value="ALL">All Origins</option>
              <option value="China">China</option>
              <option value="ER">Warehouse (ER)</option>
          </select>

          <select value={activeMasterClient} onChange={e => setActiveMasterClient(e.target.value)} className="border border-slate-300 rounded-md text-sm font-bold text-slate-700 py-1 px-2 focus:ring-2 focus:ring-emerald-500 outline-none">
              <option value="ALL">All Clients</option>
              {sortedClients.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <div className="ml-auto">
              <button 
                  onClick={downloadBatchPdfs} 
                  disabled={isDownloadingPdf} 
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors disabled:opacity-50 shadow-sm"
              >
                  {isDownloadingPdf ? <Loader2 className="w-3 h-3 animate-spin"/> : <Download className="w-3 h-3"/>}
                  {isDownloadingPdf ? 'Generating...' : 'Batch Download SA (PDF)'}
              </button>
          </div>
      </div>
    </>
  );

  const TrackingTableView = () => (
    <div className="p-6 animate-in fade-in duration-500 min-h-screen bg-white">
      <div className="mb-6 flex justify-between items-center print:hidden">
        <div>
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-emerald-600" /> Tracking Table
          </h2>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input type="text" placeholder="Search keywords..." className="pl-8 pr-4 py-2 border rounded-lg text-sm w-48" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <button onClick={exportTrackingCSV} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2"><Download className="w-4 h-4" /> Export</button>
          <button onClick={() => window.print()} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2"><Printer className="w-4 h-4" /> Print</button>
        </div>
      </div>
      <div className="border border-slate-300 overflow-auto max-h-[75vh]">
        <table className="w-full text-left text-sm border-collapse">
          <thead className="bg-slate-100 sticky top-0 z-10 text-xs font-black text-slate-600 uppercase tracking-wider">
            <tr>
              <th className="p-2 border-b border-r border-slate-300 w-24">Date</th>
              <th className="p-2 border-b border-r border-slate-300 w-24">Order</th>
              <th className="p-2 border-b border-r border-slate-300 w-20">Origin</th>
              <th className="p-2 border-b border-r border-slate-300">Spec</th>
              <th className="p-2 border-b border-r border-slate-300 w-32">Color</th>
              <th className="p-2 border-b border-r border-slate-300 w-20 text-right">Order Qty</th>
              <th className="p-2 border-b border-r border-slate-300 w-20 text-right">Shipped</th>
              <th className="p-2 border-b border-r border-slate-300 w-20 text-right">Unshipped</th>
              <th className="p-2 border-b border-r border-slate-300 w-24 text-center">C/NO</th>
              <th className="p-2 border-b border-slate-300 w-16 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredMasterData.map((d, i) => (
              <tr key={d.id} className={`hover:bg-blue-50 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                <td className="p-2 border-r border-slate-200">{d.date}</td>
                <td className="p-2 border-r border-slate-200 font-bold">{d.orderNo}</td>
                <td className="p-2 border-r border-slate-200 text-xs font-bold text-center">
                    {d.origin === 'China' ? <span className="text-red-500">CN</span> : <span className="text-blue-500">ER</span>}
                </td>
                <td className="p-2 border-r border-slate-200 font-bold text-slate-800">{d.product}</td>
                <td className="p-2 border-r border-slate-200 text-xs">{d.color}</td>
                <td className="p-2 border-r border-slate-200 text-right font-mono">{d.orderQty}</td>
                <td className="p-2 border-r border-slate-200 text-right font-mono font-bold text-blue-600">{d.shippedDisplay || d.shippedQty}</td>
                <td className="p-2 border-r border-slate-200 text-right font-mono text-red-500 font-bold">{d.orderQty - d.shippedQty !== 0 ? d.orderQty - d.shippedQty : ''}</td>
                <td className="p-2 border-r border-slate-200 text-center text-xs font-bold text-blue-600">
                  {d.cabinetNo || allGroupedInvoices[d.client]?.find(inv => inv.date === d.date)?.cabinetNo || '-'}
                </td>
                <td className="p-2 text-center font-bold text-xs">{d.status}</td>
              </tr>
            ))}
            {filteredMasterData.length === 0 && (
                <tr><td colSpan="10" className="p-8 text-center text-slate-400">No data matches the current filter</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const MasterTableView = () => (
    <div className="p-6 animate-in fade-in duration-500 min-h-screen bg-slate-50">
      <div className="mb-6 flex justify-between items-center bg-white p-4 rounded-xl shadow-sm">
        <h2 className="text-xl font-black text-slate-800 flex items-center gap-2"><Edit3 className="w-5 h-5 text-blue-600" /> Master Data Edit</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
          <input type="text" placeholder="Search..." className="pl-9 pr-4 py-2 border rounded-lg text-sm w-64" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto max-h-[75vh]">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 border-b border-slate-300 sticky top-0 z-10 text-xs font-bold text-slate-600">
              <tr>
                <th className="p-3 w-24">Date</th>
                <th className="p-3 w-20">Client</th>
                <th className="p-3 w-24">C/NO</th>
                <th className="p-3 w-24">Origin</th>
                <th className="p-3">Spec</th>
                <th className="p-3 w-24">Color</th>
                <th className="p-3 w-32 text-right">Shipped Qty</th>
                <th className="p-3 w-20 text-right">Price</th>
                <th className="p-3 w-24 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMasterData.map(d => (
                <tr key={d.id} className={`hover:bg-blue-50 ${editingId === d.id ? 'bg-yellow-50' : ''}`}>
                  {editingId === d.id ? (
                    <>
                      <td className="p-2"><input className="border rounded p-1 w-full" defaultValue={d.date} onChange={e => handleEditChange('date', e.target.value)} /></td>
                      <td className="p-2 font-bold">{d.client}</td>
                      <td className="p-2"><input className="border rounded p-1 w-full font-bold text-blue-600" defaultValue={d.cabinetNo || allGroupedInvoices[d.client]?.find(inv => inv.date === d.date)?.cabinetNo || ''} onChange={e => handleEditChange('cabinetNo', e.target.value)} placeholder="Manual Override" /></td>
                      <td className="p-2">
                          <select className="border rounded p-1 w-full" defaultValue={d.origin || 'ER'} onChange={e => handleEditChange('origin', e.target.value)}>
                              <option value="ER">ER</option>
                              <option value="China">China</option>
                          </select>
                      </td>
                      <td className="p-2"><input className="border rounded p-1 w-full font-bold" autoFocus defaultValue={d.product} onChange={e => handleEditChange('product', e.target.value)} /></td>
                      <td className="p-2"><input className="border rounded p-1 w-full" defaultValue={d.color} onChange={e => handleEditChange('color', e.target.value)} /></td>
                      <td className="p-2"><input className="border rounded p-1 w-full text-right" type="text" defaultValue={d.shippedDisplay || d.shippedQty} onChange={e => handleEditChange('shippedDisplay', e.target.value)} /></td>
                      <td className="p-2"><input className="border rounded p-1 w-full text-right" type="number" defaultValue={d.price} onChange={e => handleEditChange('price', parseFloat(e.target.value))} /></td>
                      <td className="p-2 text-center flex gap-1 justify-center">
                        <button onClick={saveEdit} className="p-1 bg-green-500 text-white rounded hover:bg-green-600"><CheckCircle2 className="w-4 h-4" /></button>
                        <button onClick={() => setEditingId(null)} className="p-1 bg-slate-300 text-white rounded hover:bg-slate-400"><X className="w-4 h-4" /></button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="p-3 text-slate-500">{d.date}</td>
                      <td className="p-3 font-bold text-slate-700">{d.client}</td>
                      <td className="p-3 font-bold text-blue-600">
                        {d.cabinetNo || allGroupedInvoices[d.client]?.find(inv => inv.date === d.date)?.cabinetNo || <span className="text-slate-300 italic text-xs">Auto</span>}
                      </td>
                      <td className="p-3 text-xs font-bold">{d.origin === 'China' ? <span className="text-red-500 bg-red-50 px-2 py-1 rounded">China</span> : <span className="text-blue-500 bg-blue-50 px-2 py-1 rounded">ER</span>}</td>
                      <td className="p-3 font-bold text-slate-800">{d.product}</td>
                      <td className="p-3 text-slate-600">{d.color}</td>
                      <td className="p-3 text-right font-mono font-bold text-blue-600">{d.shippedDisplay || d.shippedQty}</td>
                      <td className="p-3 text-right font-mono text-emerald-600">{d.price}</td>
                      <td className="p-3 text-center flex gap-2 justify-center">
                        <button onClick={() => startEditing(d)} className="text-slate-300 hover:text-blue-500"><Edit3 className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(d.id)} className="text-slate-300 hover:text-red-500"><Trash className="w-4 h-4" /></button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {filteredMasterData.length === 0 && (
                  <tr><td colSpan="9" className="p-8 text-center text-slate-400">No data matches the current filter</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const Dashboard = () => {
    const updateStartNo = async (client, currentStart, count) => {
        const nextStart = currentStart + count;
        if (window.confirm(`Are you sure you want to update the starting C/NO for ${client}?\n\nCurrent Start: ${currentStart}\nThis Batch: ${count}\n\nNext C/NO will be [ ${nextStart} ].`)) {
            const newConfig = { ...clientConfig };
            if (!newConfig[client]) {
                newConfig[client] = { startNo: nextStart, prefix: client };
            } else {
                newConfig[client].startNo = nextStart;
            }
            await setDoc(doc(db, 'everise_system', 'shared', 'settings', 'config'), { clientConfig: newConfig }, { merge: true });
        }
    };

    const manualEditStartNo = async (client) => {
        const current = clientConfig[client]?.startNo || 1;
        const input = prompt(`Please manually input the starting C/NO for ${client}:`, current);
        if (input && !isNaN(input)) {
            const newNo = parseInt(input);
            const newConfig = { ...clientConfig };
            if (!newConfig[client]) newConfig[client] = { startNo: newNo, prefix: client };
            else newConfig[client].startNo = newNo;
            await setDoc(doc(db, 'everise_system', 'shared', 'settings', 'config'), { clientConfig: newConfig }, { merge: true });
        }
    };

    const dashboardClients = Object.keys(displayedGroupedInvoices).sort();

    return (
      <div className="max-w-7xl mx-auto p-12 min-h-screen bg-slate-50">
        {dashboardClients.length === 0 ? (
          <div className="text-center py-40 border-4 border-dashed border-slate-200 rounded-3xl">
             <LayoutDashboard className="w-20 h-20 text-slate-300 mx-auto mb-4" />
             <p className="text-slate-400 font-bold text-xl">No SA found under current filter</p>
          </div>
        ) : (
          dashboardClients.map(client => {
            const currentInvoices = displayedGroupedInvoices[client] || [];
            const config = clientConfig[client] || { startNo: 1, prefix: client };
            const nextStartNo = config.startNo + currentInvoices.length;

            return (
              <div key={client} className="mb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 border-b-2 border-slate-200 pb-4 gap-4">
                  <div>
                    <div className="flex items-center gap-4 mb-3">
                      <span className="bg-slate-900 text-white px-6 py-2 rounded-xl font-black text-3xl shadow-lg">{client}</span>
                      <h2 className="text-xl font-bold text-slate-400">Invoice List</h2>
                    </div>
                    <div className="bg-white border border-slate-300 rounded-lg p-3 flex items-center gap-4 shadow-sm">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Current Start</span>
                            <div className="flex items-center gap-2">
                                <span className="font-mono font-black text-xl text-slate-700">#{config.startNo}</span>
                                <button onClick={() => manualEditStartNo(client)} className="text-slate-300 hover:text-blue-500"><Edit3 className="w-3 h-3" /></button>
                            </div>
                        </div>
                        <div className="h-8 w-px bg-slate-200"></div>
                        <div className="flex flex-col">
                             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">This View</span>
                             <span className="font-mono font-bold text-blue-600">+{currentInvoices.length}</span>
                        </div>
                        <div className="h-8 w-px bg-slate-200"></div>
                        <button 
                            onClick={() => updateStartNo(client, config.startNo, currentInvoices.length)}
                            className="bg-slate-100 hover:bg-slate-800 hover:text-white text-slate-600 px-3 py-1.5 rounded-md text-xs font-bold transition-colors flex items-center gap-2"
                        >
                            <span>Set Next Start</span>
                            <span className="bg-yellow-300 text-black px-1 rounded font-mono mx-1">#{nextStartNo}</span>
                            <ChevronRight className="w-3 h-3" />
                        </button>
                    </div>
                  </div>
                  <button onClick={() => { setActiveClient(client); setViewMode('printAll'); }} className="bg-emerald-600 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 shadow-md hover:bg-emerald-700 hover:-translate-y-0.5 transition-all">
                    <Layers className="w-5 h-5" /> Print All SA in View
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {currentInvoices.map(inv => (
                    <div key={inv.id} onClick={() => { setActiveClient(client); setSelectedInvoiceId(inv.id); setViewMode('preview'); }} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-slate-100 to-transparent rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
                      <div className="relative z-10">
                          <div className="flex justify-between items-start mb-4">
                            <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-md text-xs font-black shadow-sm border border-blue-200">{inv.cabinetNo}</span>
                            {inv.origin === 'China' ? (
                                <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 border border-red-200"><Plane className="w-3 h-3"/> CN</span>
                            ) : (
                                <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[10px] font-bold border border-slate-200">ER</span>
                            )}
                          </div>
                          <div className="text-2xl font-black text-slate-800 mb-1">{inv.date}</div>
                          <div className="text-xs text-slate-400 font-bold flex items-center gap-1">
                              <Package className="w-3 h-3" /> {inv.items.length} Items
                          </div>
                          <div className="mt-6 pt-4 border-t border-slate-100 text-right">
                            <span className="text-2xl font-black text-emerald-600 tracking-tight">
                                <span className="text-xs text-emerald-400 font-normal mr-1">THB</span>
                                {Math.round(inv.total).toLocaleString()}
                            </span>
                          </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  };

  const InvoiceTemplate = ({ inv }) => (
    <div className="w-[210mm] bg-white p-[10mm] min-h-[297mm] flex flex-col font-tnr text-black invoice-page mx-auto relative bg-contain bg-center bg-no-repeat">
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
                <td className="py-1 text-center font-mono">{item.shippedDisplay || item.shippedQty + ' Y'} x {item.price} = THB</td>
                <td className="py-1 text-right font-bold text-base">{(Math.round(item.shippedQty * item.price)).toLocaleString()}</td>
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

  const PrintAllView = () => (
    <div className="bg-slate-200 min-h-screen py-10 print:bg-white print:p-0 flex flex-col items-center">
      <div className="w-[210mm] mb-6 flex justify-between items-center print:hidden px-4">
        <button onClick={() => setViewMode('dashboard')} className="text-slate-700 flex items-center gap-2 hover:text-blue-700 font-bold"><ArrowLeft className="w-5 h-5" /> Back to Dashboard</button>
        <button onClick={() => window.print()} className="bg-emerald-600 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 shadow-xl"><Printer className="w-5 h-5" /> Print All</button>
      </div>
      <div id="print-area">
        {displayedGroupedInvoices[activeClient]?.map(inv => (
          <div key={inv.id} className="print-page-break">
            <InvoiceTemplate inv={inv} />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="bg-slate-50 min-h-screen font-sans">
      <Navbar />
      <AiModal show={showAiModal} onClose={() => setShowAiModal(false)} prompt={aiPrompt} setPrompt={setAiPrompt} onSend={callGemini} response={aiResponse} loading={isAiLoading} hasKey={!!userApiKey} />
      <ManualRevenueModal show={showRevenueModal} onClose={() => setShowRevenueModal(false)} onSave={addManualRevenue} />
      
      {/* Hidden PDF container */}
      <div className="absolute top-[-9999px] left-[-9999px] opacity-0 pointer-events-none z-[-50]">
          {Object.values(displayedGroupedInvoices).flat().map(inv => (
              <div key={inv.id} id={`invoice-capture-${inv.id}`}>
                  <InvoiceTemplate inv={inv} />
              </div>
          ))}
      </div>

      <main className="p-6">
        {viewMode === 'dashboard' && <Dashboard />}

        {viewMode === 'trackingTable' && <TrackingTableView />}

        {viewMode === 'revenueStats' && (
            <div className="max-w-6xl mx-auto space-y-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-3xl font-black">Annual Revenue Stats</h2>
                    <button onClick={() => setShowRevenueModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2"><Plus className="w-4 h-4"/>Add Revenue</button>
                </div>
                
                {revenueData.map((data) => (
                    <div key={data.monthKey} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
                        <div className="p-6 flex flex-col md:flex-row gap-6 items-start">
                            <div className="w-full md:w-48 shrink-0 border-b md:border-b-0 md:border-r border-slate-100 pb-4 md:pb-0 md:pr-4">
                                <div className="text-sm font-bold text-slate-400 uppercase tracking-wider">{data.year}</div>
                                <div className="text-4xl font-black text-slate-800">{data.month}</div>
                                <div className="mt-2 text-xl font-black text-emerald-600 flex items-center gap-1">
                                    <span className="text-xs text-emerald-400">THB</span>
                                    {data.total.toLocaleString()}
                                </div>
                                <div className="mt-4 h-2 bg-slate-100 rounded-full overflow-hidden w-full">
                                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `100%` }}></div>
                                </div>
                                
                                <div className="mt-4 space-y-2 border-t border-slate-100 pt-2">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-400 font-bold flex items-center gap-1"><Package className="w-3 h-3" /> Warehouse</span>
                                        <span className="font-mono font-bold text-blue-600">{data.warehouseTotal.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-400 font-bold flex items-center gap-1"><MapPin className="w-3 h-3" /> China</span>
                                        <span className="font-mono font-bold text-red-500">{data.chinaTotal.toLocaleString()}</span>
                                    </div>
                                    {data.otherTotal > 0 && (
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-slate-400 font-bold flex items-center gap-1"><Hash className="w-3 h-3" /> Other</span>
                                            <span className="font-mono font-bold text-yellow-600">{data.otherTotal.toLocaleString()}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex-1 w-full">
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                    {data.clients.map((client, idx) => (
                                        <div key={idx} className="flex flex-col bg-slate-50 p-2 rounded border border-slate-100 relative group">
                                            <div className="flex justify-between items-baseline mb-1">
                                                <span className="text-xs font-black text-slate-700 truncate">{idx + 1}. {client.client}</span>
                                            </div>
                                            <span className="text-sm font-mono text-emerald-600 font-bold block">{client.amount.toLocaleString()}</span>
                                            
                                            <div className="mt-1 flex h-1.5 w-full rounded-full overflow-hidden bg-slate-200">
                                                {client.sources['Warehouse'] > 0 && (
                                                    <div className="h-full bg-blue-400" style={{ width: `${(client.sources['Warehouse'] / client.amount) * 100}%` }} title={`Warehouse: ${client.sources['Warehouse'].toLocaleString()}`}></div>
                                                )}
                                                {client.sources['China'] > 0 && (
                                                    <div className="h-full bg-red-400" style={{ width: `${(client.sources['China'] / client.amount) * 100}%` }} title={`China: ${client.sources['China'].toLocaleString()}`}></div>
                                                )}
                                                {client.sources['Other'] > 0 && (
                                                    <div className="h-full bg-yellow-400" style={{ width: `${(client.sources['Other'] / client.amount) * 100}%` }} title={`Other: ${client.sources['Other'].toLocaleString()}`}></div>
                                                )}
                                            </div>

                                            <div className="mt-1 text-[10px] text-slate-400 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity absolute top-full left-0 bg-white p-2 shadow-xl z-10 w-40 border rounded pointer-events-none">
                                                 {client.sources['Warehouse'] > 0 && <span className="flex justify-between"><span>📦 Warehouse</span> <span>{client.sources['Warehouse'].toLocaleString()}</span></span>}
                                                 {client.sources['China'] > 0 && <span className="flex justify-between text-red-400 font-bold"><span>🇨🇳 China</span> <span>{client.sources['China'].toLocaleString()}</span></span>}
                                                 {client.sources['Other'] > 0 && <span className="flex justify-between text-yellow-600"><span>🔸 Other</span> <span>{client.sources['Other'].toLocaleString()}</span></span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
                
                <div className="mt-12 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h3 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
                        <Edit3 className="w-5 h-5 text-blue-500" /> Manual Entry Records
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-xs text-slate-500 font-bold border-b border-slate-100">
                                <tr>
                                    <th className="p-3">Date</th>
                                    <th className="p-3">Client</th>
                                    <th className="p-3">C/NO</th>
                                    <th className="p-3">Origin</th>
                                    <th className="p-3 text-right">Amount (THB)</th>
                                    <th className="p-3">Note</th>
                                    <th className="p-3 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {manualRevenueData.sort((a,b) => new Date(b.date) - new Date(a.date)).map(item => (
                                    <tr key={item.id} className="hover:bg-slate-50">
                                        <td className="p-3 font-mono text-slate-600">{item.date}</td>
                                        <td className="p-3 font-bold text-slate-800">{item.client}</td>
                                        <td className="p-3 text-slate-600"><span className="bg-slate-100 px-2 py-0.5 rounded text-xs">{item.cabinetNo || '-'}</span></td>
                                        <td className="p-3">
                                            {item.source === 'China' ? (
                                                <span className="flex items-center gap-1 text-red-500 font-bold text-xs"><MapPin className="w-3 h-3" /> China</span>
                                            ) : item.source === 'Warehouse' ? (
                                                <span className="flex items-center gap-1 text-blue-500 font-bold text-xs"><Package className="w-3 h-3" /> Warehouse</span>
                                            ) : (
                                                <span className="text-slate-400 text-xs">{item.source || 'China'}</span>
                                            )}
                                        </td>
                                        <td className="p-3 text-right font-mono text-emerald-600 font-bold">{item.amount.toLocaleString()}</td>
                                        <td className="p-3 text-slate-400 text-xs">{item.note}</td>
                                        <td className="p-3 text-center">
                                            <button onClick={() => deleteManualRevenue(item.id)} className="text-red-300 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {manualRevenueData.length === 0 && (
                                    <tr><td colSpan="7" className="p-8 text-center text-slate-400">No manual records found</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}

        {viewMode === 'preview' && (
            <div className="py-10 bg-slate-200 min-h-screen">
                <div className="max-w-[210mm] mx-auto mb-6 flex justify-between print:hidden">
                    <button onClick={() => setViewMode('dashboard')} className="font-bold flex items-center gap-2"><ArrowLeft/>Back</button>
                    <button onClick={() => window.print()} className="bg-emerald-600 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2"><Printer/>Print</button>
                </div>
                <div id="print-area">
                    <InvoiceTemplate inv={(allGroupedInvoices[activeClient] || []).find(i => i.id === selectedInvoiceId)} />
                </div>
            </div>
        )}

        {viewMode === 'printAll' && <PrintAllView />}

        {viewMode === 'masterTable' && <MasterTableView />}

        {viewMode === 'dataManagement' && (
             <div className="p-8 max-w-4xl mx-auto min-h-screen bg-slate-50 animate-in fade-in">
                <h2 className="text-3xl font-black text-slate-800 flex items-center gap-3 mb-8">
                    <Archive className="w-8 h-8 text-emerald-600" /> Data Source Management
                </h2>
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-slate-100 text-xs font-bold text-slate-600 border-b border-slate-200">
                            <tr>
                                <th className="p-4">Source File</th>
                                <th className="p-4 text-center">Records Count</th>
                                <th className="p-4 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                             {[...new Set(masterData.map(d => d.source))].map(source => (
                                 <tr key={source} className="hover:bg-red-50 group transition-colors">
                                     <td className="p-4 font-mono text-sm font-bold text-slate-700">{source}</td>
                                     <td className="p-4 text-center">
                                         <span className="bg-slate-100 px-3 py-1 rounded-full text-xs font-black text-slate-600">{masterData.filter(d => d.source === source).length} Records</span>
                                     </td>
                                     <td className="p-4 text-right">
                                         <button onClick={() => deleteBatchBySource(source)} className="text-slate-400 hover:text-red-600 font-bold text-sm flex items-center gap-1 ml-auto transition-colors px-3 py-1 rounded hover:bg-red-100">
                                             <Trash2 className="w-4 h-4" /> Delete Batch
                                         </button>
                                     </td>
                                 </tr>
                             ))}
                        </tbody>
                    </table>
                </div>
             </div>
        )}
        
        {viewMode === 'settings' && (
            <div className="max-w-md mx-auto space-y-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border">
                    <h3 className="font-black mb-4 flex items-center gap-2"><KeyRound className="text-purple-600"/> Gemini API Key</h3>
                    <input type="password" value={userApiKey} onChange={e => { setUserApiKey(e.target.value); localStorage.setItem('everise_gemini_key', e.target.value); }} className="w-full border p-2 rounded bg-slate-50" placeholder="Paste API Key"/>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border">
                    <h3 className="font-black mb-4 flex items-center gap-2"><RefreshCw className="text-blue-600"/> Reset C/NO Settings</h3>
                    <p className="text-xs text-slate-500 mb-4">If you find that the starting cabinet number hasn't updated, please click the button below to force a reset to the latest system defaults.</p>
                    <button onClick={resetConfigToDefaults} className="w-full bg-blue-100 hover:bg-blue-200 text-blue-700 font-bold py-2 rounded-lg transition-colors">Reset to Default</button>
                </div>
            </div>
        )}
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; }
          .bg-slate-200, .bg-slate-50, .shadow-xl, .bg-white { background: white !important; box-shadow: none !important; }
          .print-page-break { page-break-after: always !important; break-after: page !important; min-height: 297mm; }
          .print\\:hidden, nav, button { display: none !important; }
          @page { size: A4; margin: 0; }
        }
        .font-tnr { font-family: 'Times New Roman', Times, serif; }
      `}} />
    </div>
  );
};

export default App;