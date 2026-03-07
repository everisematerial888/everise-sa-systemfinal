import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  FileText, Upload, Printer, ChevronRight, Hash, ArrowLeft, Settings, Search,
  CheckCircle2, FileSpreadsheet, Table as TableIcon, LayoutDashboard, Edit3, X, Trash,
  Download, Database, Layers, Sparkles, MessageSquare, Loader2, TrendingUp, DollarSign, 
  Calendar, PieChart, BarChart3, Calculator, Cloud, CloudOff, Save, Archive, Plus, 
  Trash2, MapPin, Package, KeyRound, RefreshCw, Plane, Warehouse, Filter, AlertTriangle, 
  ListOrdered, Link, ShieldAlert, CheckSquare, FileOutput, FileDown
} from 'lucide-react';

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot, writeBatch } from 'firebase/firestore';

const loadHtml2Pdf = () => {
    return new Promise((resolve) => {
        if (window.html2pdf) return resolve(window.html2pdf);
        const script = document.createElement('script');
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
        script.onload = () => resolve(window.html2pdf);
        document.body.appendChild(script);
    });
};

const firebaseConfig = {
  apiKey: "AIzaSyDsGkGsWS4sRIn3o9XzWmqGSbZg4i5Dc9g", authDomain: "sa-test-96792.firebaseapp.com",
  projectId: "sa-test-96792", storageBucket: "sa-test-96792.firebasestorage.app",
  messagingSenderId: "736271192466", appId: "1:736271192466:web:1517c3d40e3e61d1c1b14b"
};

const DEFAULT_CLIENT_CONFIG = {
  "AP": { startNo: 955, prefix: "AP" }, "APS": { startNo: 860, prefix: "APS" },
  "CCHHH": { startNo: 138, prefix: "CCHHH" }, "CH": { startNo: 276, prefix: "CH" },
  "CL": { startNo: 300, prefix: "CL" }, "CS": { startNo: 125, prefix: "CS" },
  "CSK": { startNo: 586, prefix: "CSK" }, "DP": { startNo: 424, prefix: "DP" },
  "HEC": { startNo: 22, prefix: "HEC" }, "HRR": { startNo: 97, prefix: "HRR" },
  "PAT": { startNo: 29, prefix: "PAT" }, "PCR": { startNo: 251, prefix: "PCR" },
  "PV": { startNo: 211, prefix: "PV" }, "ROMA": { startNo: 11, prefix: "ROMA" },
  "SPN": { startNo: 127, prefix: "SPN" }, "SRN": { startNo: 345, prefix: "SRN" },
  "SRR": { startNo: 115, prefix: "SRR" }, "TC": { startNo: 304, prefix: "TC" },
  "TNC": { startNo: 838, prefix: "TNC" }, "W": { startNo: 597, prefix: "W" },
  "WL": { startNo: 285, prefix: "WL" }, "WP": { startNo: 274, prefix: "WP" }
};

// 企業級 CSV 專業解析器 (完美處理千分位逗號與換行)
const parseCSV = (str) => {
    const arr = []; let quote = false; let col = ''; let row = [];
    for (let c = 0; c < str.length; c++) {
        let cc = str[c], nc = str[c+1];
        if (cc === '"' && quote && nc === '"') { col += cc; c++; continue; }
        if (cc === '"') { quote = !quote; continue; }
        if (cc === ',' && !quote) { row.push(col.trim()); col = ''; continue; }
        if (cc === '\r' && !quote) continue;
        if (cc === '\n' && !quote) { row.push(col.trim()); arr.push(row); col = ''; row = []; continue; }
        col += cc;
    }
    if (col !== '' || row.length > 0) { row.push(col.trim()); arr.push(row); }
    return arr.filter(r => r.some(x => x !== ''));
};

const parseNum = (val) => {
    if (!val) return 0;
    const n = parseFloat(String(val).replace(/,/g, ''));
    return isNaN(n) ? 0 : n;
};

const parseQuantity = (rawQtyStr, productName) => {
  if (!rawQtyStr) return { display: '', value: 0 };
  const str = String(rawQtyStr).trim().toUpperCase();
  if (str.includes('=') || str.includes('*')) {
      const match = str.match(/=([\d.]+)\s*Y?/);
      if (match) return { display: str, value: parseFloat(match[1]) };
      return { display: str, value: parseFloat(str.replace(/[^\d.-]/g, '')) || 0 };
  }
  const qty = parseFloat(str.replace(/[^\d.-]/g, ''));
  if (isNaN(qty) || qty === 0) return { display: '0', value: 0 };
  let yPerRoll = 50; 
  const pName = (productName || '').toUpperCase();
  if (pName.includes('210 PU')) yPerRoll = 150;
  else if (/(CHACK FACE|KEVLAR|LACOSTE|VACUUM|CHECKER|385|305)/.test(pName)) yPerRoll = 40;
  const rolls = Math.floor(qty / yPerRoll);
  const remainder = qty % yPerRoll;
  let display = '';
  if (rolls > 0) {
      display = `${yPerRoll}*${rolls}R`;
      if (remainder > 0) display += `+${remainder}`;
      display += `=${qty}Y`;
  } else { display = `${qty}Y`; }
  return { display, value: qty };
};

const App = () => {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  const [user, setUser] = useState(null);
  const [viewMode, setViewMode] = useState('dashboard'); 
  const [masterData, setMasterData] = useState([]); 
  const [inventoryMaster, setInventoryMaster] = useState([]); 
  const [restockData, setRestockData] = useState([]); 
  const [productMappings, setProductMappings] = useState({}); 
  const [manualRevenueData, setManualRevenueData] = useState([]); 
  const [revenueData, setRevenueData] = useState([]); 
  
  const [activeClient, setActiveClient] = useState(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterProduct, setFilterProduct] = useState('ALL'); 
  const [editingId, setEditingId] = useState(null);
  const editValues = useRef({}); 
  const [clientConfig, setClientConfig] = useState(DEFAULT_CLIENT_CONFIG);

  const [filterMonth, setFilterMonth] = useState('ALL');
  const [filterOrigin, setFilterOrigin] = useState('ALL');
  const [activeMasterClient, setActiveMasterClient] = useState('ALL');

  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingBase, setIsUploadingBase] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [showAddInvModal, setShowAddInvModal] = useState(false);
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [showRevenueModal, setShowRevenueModal] = useState(false); 
  
  const [pendingUploadData, setPendingUploadData] = useState(null);
  const [unmappedItems, setUnmappedItems] = useState([]);
  const [showMappingModal, setShowMappingModal] = useState(false);

  useEffect(() => {
    signInAnonymously(auth).catch(err => console.error("Auth Error:", err));
    return onAuthStateChanged(auth, u => setUser(u));
  }, [auth]);

  useEffect(() => {
    if (!user) return;
    const unsubMaster = onSnapshot(collection(db, 'everise_system', 'shared', 'master_data'), (snap) => setMasterData(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubInv = onSnapshot(collection(db, 'everise_system', 'shared', 'inventory_master'), (snap) => setInventoryMaster(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubRestock = onSnapshot(collection(db, 'everise_system', 'shared', 'restock_data'), (snap) => setRestockData(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubRev = onSnapshot(collection(db, 'everise_system', 'shared', 'manual_revenue'), (snap) => setManualRevenueData(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubSettings = onSnapshot(doc(db, 'everise_system', 'shared', 'settings', 'config'), (snap) => {
      if (snap.exists()) {
          if (snap.data().clientConfig) setClientConfig(snap.data().clientConfig);
          if (snap.data().productMappings) setProductMappings(snap.data().productMappings);
      }
    });
    return () => { unsubMaster(); unsubInv(); unsubRestock(); unsubRev(); unsubSettings(); };
  }, [user, db]);

  const computedInventory = useMemo(() => {
      if (!inventoryMaster || inventoryMaster.length === 0) return [];
      return inventoryMaster.map(inv => {
          const relatedOut = masterData.filter(d => d.origin === 'ER' && d.status !== '作廢' && (d.product || '').trim().toUpperCase() === (inv.product || '').trim().toUpperCase() && (d.color || '').trim().toUpperCase() === (inv.color || '').trim().toUpperCase());
          const totalShipped = relatedOut.reduce((sum, d) => sum + (d.shippedQty || 0), 0);
          const relatedIn = restockData.filter(d => (d.product || '').trim().toUpperCase() === (inv.product || '').trim().toUpperCase() && (d.color || '').trim().toUpperCase() === (inv.color || '').trim().toUpperCase());
          const totalRestocked = relatedIn.reduce((sum, d) => sum + (d.amount || 0), 0);
          const currentStock = (inv.initialStock || 0) + totalRestocked - totalShipped;
          let stockStatus = 'normal';
          const target = inv.restockTarget || 0;
          if (currentStock < 0) stockStatus = 'negative';
          else if (target > 0 && currentStock < target) stockStatus = 'low';
          return { ...inv, totalShipped, totalRestocked, currentStock, stockStatus };
      });
  }, [inventoryMaster, masterData, restockData]);

  const updateConfig = async (key, data) => await setDoc(doc(db, 'everise_system', 'shared', 'settings', 'config'), { [key]: data }, { merge: true });

  const handleVoidOrder = async (id) => {
      if(window.confirm("確定作廢此筆單據嗎？營收不計，庫存會自動加回！")) {
          await updateDoc(doc(db, 'everise_system', 'shared', 'master_data', id), { status: '作廢', shippedQty: 0, price: 0 });
      }
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    setIsUploading(true);
    try {
        let allParsedRows = [];
        for (const file of files) {
            const text = await new Promise((resolve) => { const reader = new FileReader(); reader.onload = (ev) => resolve(ev.target.result); reader.readAsText(file); });
            const rows = parseCSV(text);
            if (rows.length < 1) continue;
            const headers = rows[0].map(h => String(h).toLowerCase());
            
            if (headers.includes('client') && headers.includes('number')) {
                 const newConfig = { ...clientConfig };
                 rows.slice(1).forEach(cols => {
                     const c = cols[0], n = cols[1];
                     if (c && n) newConfig[c.toUpperCase().trim()] = { startNo: parseInt(n) || 1, prefix: c.toUpperCase().trim() };
                 });
                 await updateConfig('clientConfig', newConfig); continue;
            }

            const origin = file.name.toLowerCase().includes('china') ? 'China' : 'ER';
            const getIdx = (keys) => headers.findIndex(h => keys.some(k => h.includes(k)));
            const idx = {
                date: getIdx(['date', '日期']), client: getIdx(['client', '客戶']), product: getIdx(['product', '品名', 'spec']), 
                color: getIdx(['color', '顏色']), shipped: getIdx(['quantity', '數量', '出貨']), price: getIdx(['price', '單價']),
                cabinet: getIdx(['cabinet', '櫃號']), order: getIdx(['order', '訂單'])
            };

            rows.slice(1).forEach((cols, rIdx) => {
                if (cols.length < 3) return;
                let rawProduct = cols[idx.product]?.replace(/"/g, '').toUpperCase().trim() || '';
                let rawColor = cols[idx.color]?.replace(/"/g, '').trim() || '';
                const parsedQty = parseQuantity(cols[idx.shipped], rawProduct);
                
                if (parsedQty.value === 0 && cols[idx.shipped]) {
                    alert(`🚨 異常：無法辨識數量 [ ${cols[idx.shipped]} ]，發生在品項：${rawProduct}\n請修正 CSV。`);
                    throw new Error("數量格式異常");
                }

                allParsedRows.push({
                    _rawProduct: rawProduct, _rawColor: rawColor, id: `${file.name}-${rIdx}-${Date.now()}`,
                    date: cols[idx.date] || '', client: (cols[idx.client] || 'UNKNOWN').toUpperCase().replace(/"/g, ''),
                    shippedQty: parsedQty.value, shippedDisplay: parsedQty.display,
                    price: parseNum(cols[idx.price]),
                    cabinetNo: cols[idx.cabinet] ? cols[idx.cabinet].replace(/"/g, '') : '', orderNo: cols[idx.order] || 'N/A', 
                    status: '', note: '', source: file.name, origin: origin, timestamp: Date.now()
                });
            });
        }
        
        if(allParsedRows.length === 0) return;

        const unmapped = [];
        allParsedRows.forEach(row => {
            if (row.origin !== 'ER') return; 
            const dictKey = `${row._rawProduct}|${row._rawColor}`;
            if (productMappings[dictKey]) {
                row.product = productMappings[dictKey].product; row.color = productMappings[dictKey].color; return;
            }
            const exactMatch = inventoryMaster.find(i => (i.product || '').toUpperCase().trim() === row._rawProduct && (i.color || '').toUpperCase().trim() === row._rawColor.toUpperCase());
            if (exactMatch) { row.product = exactMatch.product; row.color = exactMatch.color; } 
            else if (!unmapped.find(u => u.rawKey === dictKey)) unmapped.push({ rawKey: dictKey, rawProduct: row._rawProduct, rawColor: row._rawColor });
        });

        if (unmapped.length > 0) {
            setUnmappedItems(unmapped); setPendingUploadData(allParsedRows); setShowMappingModal(true);
        } else await finalizeUpload(allParsedRows, productMappings);

    } catch (error) {
        if(error.message !== "數量格式異常") alert(`❌ 失敗：${error.message}`);
    } finally { setIsUploading(false); e.target.value = ''; }
  };

  const finalizeUpload = async (rowsToSave, newMappings) => {
      const batch = writeBatch(db);
      rowsToSave.forEach(row => {
          if(!row.product) row.product = row._rawProduct || 'Unknown';
          if(!row.color) row.color = row._rawColor || '-';
          const docData = {...row}; delete docData._rawProduct; delete docData._rawColor;
          batch.set(doc(db, 'everise_system', 'shared', 'master_data', row.id), docData);
      });
      await batch.commit();
      if (Object.keys(newMappings).length > Object.keys(productMappings).length) await updateConfig('productMappings', newMappings);
      alert("✅ 匯入成功！已建立 SA 並扣除庫存。");
      setShowMappingModal(false); setPendingUploadData(null); setViewMode('dashboard');
  };

  const handleRestockUpload = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      try {
          const text = await new Promise((resolve) => { const reader = new FileReader(); reader.onload = (e) => resolve(e.target.result); reader.readAsText(file); });
          const rows = parseCSV(text);
          const headers = rows[0].map(h => String(h).toLowerCase());
          const getIdx = (keys) => headers.findIndex(h => keys.some(k => h.includes(k)));
          const idx = { date: getIdx(['date', '日期']), product: getIdx(['product', '品名']), color: getIdx(['color', '顏色']), qty: getIdx(['quantity', '數量']), note: getIdx(['note', '備註']) };
          if (idx.product === -1 || idx.qty === -1) throw new Error("缺少標題：品名、數量");
          const batch = writeBatch(db);
          rows.slice(1).forEach((cols) => {
              if (cols.length < 2 || !cols[idx.product]) return;
              batch.set(doc(collection(db, 'everise_system', 'shared', 'restock_data')), {
                  date: cols[idx.date] || new Date().toISOString().split('T')[0], product: String(cols[idx.product]).toUpperCase(), color: cols[idx.color] || '',
                  amount: parseNum(cols[idx.qty]), note: cols[idx.note] || '整櫃匯入', timestamp: Date.now()
              });
          });
          await batch.commit(); alert("✅ 整櫃進貨匯入完成！");
      } catch (error) { alert(`❌ 匯入失敗：${error.message}`); }
      e.target.value = '';
  };

  const handleInventoryBaseUpload = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      if (!window.confirm("匯入新期初總表會覆蓋計算基準，確定？")) return;
      setIsUploadingBase(true);
      try {
          const text = await new Promise((resolve) => { const reader = new FileReader(); reader.onload = (e) => resolve(e.target.result); reader.readAsText(file); });
          const rows = parseCSV(text);
          if(rows.length < 2) throw new Error("檔案內容不足或格式錯誤");
          const headers = rows[0];
          const getIdx = (keywords) => headers.findIndex(h => keywords.some(k => String(h).includes(k)));
          
          const idx = {
              product: getIdx(['品名', 'Product']), color: getIdx(['顏色', 'Color']),
              shipped2025: getIdx(['2025年出貨', '2025年的出貨', '2025']), 
              shipped2026: getIdx(['2026年出貨', '2026出貨', '2026年的出貨']),
              stock2026: getIdx(['2026年庫存', '2026庫存', '2026年的庫存']), 
              initialStock2026: getIdx(['2026年初始數量', '初始數量', '初始']), 
              restockTarget: getIdx(['安全水位', '補貨參考', '低於此數字']), 
              suggestedRestock: getIdx(['建議補貨量', '補貨量'])
          };
          if (idx.product === -1 || idx.stock2026 === -1) throw new Error("標題缺少：品名、2026年庫存數量");

          const batchDelete = writeBatch(db);
          inventoryMaster.forEach(inv => batchDelete.delete(doc(db, 'everise_system', 'shared', 'inventory_master', inv.id)));
          await batchDelete.commit();

          const batchInsert = writeBatch(db);
          rows.slice(1).forEach((cols) => {
              if (cols.length < 2 || !cols[idx.product]) return;
              
              const s2026 = parseNum(cols[idx.shipped2026]);
              const stock2026 = parseNum(cols[idx.stock2026]);
              
              let calculatedInitialStock = 0;
              if (idx.initialStock2026 !== -1 && cols[idx.initialStock2026] !== undefined && String(cols[idx.initialStock2026]).trim() !== '') {
                  calculatedInitialStock = parseNum(cols[idx.initialStock2026]);
              } else {
                  calculatedInitialStock = stock2026 + s2026;
              }

              batchInsert.set(doc(collection(db, 'everise_system', 'shared', 'inventory_master')), {
                  product: String(cols[idx.product]).trim(), color: String(cols[idx.color]||'').trim(), shipped2025: parseNum(cols[idx.shipped2025]),
                  restockTarget: idx.restockTarget !== -1 ? parseNum(cols[idx.restockTarget]) : 0,
                  suggestedRestock: idx.suggestedRestock !== -1 ? parseNum(cols[idx.suggestedRestock]) : 0,
                  initialStock: calculatedInitialStock, timestamp: Date.now()
              });
          });
          await batchInsert.commit(); alert("✅ 庫存期初資料建檔完成！請檢查庫存總覽。"); setViewMode('inventoryOverview');
      } catch (error) { alert(`❌ 匯入失敗：${error.message}`); }
      finally { setIsUploadingBase(false); e.target.value = ''; }
  };

  const sortedClients = useMemo(() => [...new Set(masterData.map(d => d.client || 'Unknown'))].sort(), [masterData]);
  const availableMonths = useMemo(() => [...new Set(masterData.map(d => (d.date||'').substring(0, 7)))].filter(Boolean).sort().reverse(), [masterData]);

  const allGroupedInvoices = useMemo(() => {
    const res = {};
    sortedClients.forEach(c => {
        const rows = masterData.filter(d => (d.client||'Unknown') === c && d.shippedQty > 0);
        const dates = [...new Set(rows.map(r => r.date||''))].sort((a, b) => new Date(a||0) - new Date(b||0));
        res[c] = dates.map((date, idx) => {
            const items = rows.filter(r => (r.date||'') === date);
            const conf = clientConfig[c] || { startNo: 1, prefix: c };
            const origin = items[0]?.origin || 'ER'; 
            const total = items.reduce((s, i) => s + Math.round(i.shippedQty * Math.round(i.price)), 0);
            return { id: `${c}-${date}`, date, cabinetNo: items[0]?.cabinetNo || `${conf.prefix}#${String(conf.startNo + idx).padStart(3, '0')}`, client: c, items, origin, total };
        });
    });
    return res;
  }, [masterData, clientConfig, sortedClients]);

  const displayedGroupedInvoices = useMemo(() => {
      const res = {};
      Object.keys(allGroupedInvoices).forEach(client => {
          if (activeMasterClient !== 'ALL' && client !== activeMasterClient) return;
          let invs = allGroupedInvoices[client].filter(inv => (filterMonth === 'ALL' || (inv.date||'').startsWith(filterMonth)) && (filterOrigin === 'ALL' || inv.origin === filterOrigin));
          if (invs.length > 0) res[client] = invs;
      });
      return res;
  }, [allGroupedInvoices, filterMonth, filterOrigin, activeMasterClient]);

  const filteredMasterData = useMemo(() => {
    let d = masterData;
    if (activeMasterClient !== 'ALL') d = d.filter(x => (x.client||'Unknown') === activeMasterClient);
    if (filterMonth !== 'ALL') d = d.filter(x => (x.date||'').startsWith(filterMonth));
    if (filterOrigin !== 'ALL') d = d.filter(x => x.origin === filterOrigin);
    if (searchTerm) d = d.filter(x => (x.product||'').toLowerCase().includes(searchTerm.toLowerCase()) || (x.orderNo||'').toLowerCase().includes(searchTerm.toLowerCase()) || (x.client||'').toLowerCase().includes(searchTerm.toLowerCase()));
    return d.sort((a,b) => new Date(b.date||0) - new Date(a.date||0)); 
  }, [masterData, activeMasterClient, filterMonth, filterOrigin, searchTerm]);

  const downloadBatchPdfs = async () => {
      const invoicesToDownload = Object.values(displayedGroupedInvoices).flat();
      if (invoicesToDownload.length === 0) return alert('沒有單據可下載！');
      if (!window.confirm(`準備下載 ${invoicesToDownload.length} 張 PDF，請允許瀏覽器多重下載。`)) return;
      setIsDownloadingPdf(true);
      try {
          const html2pdf = await loadHtml2Pdf();
          for (let i = 0; i < invoicesToDownload.length; i++) {
              const inv = invoicesToDownload[i];
              const element = document.getElementById(`invoice-capture-${inv.id}`);
              if (!element) continue;
              await html2pdf().set({ margin: 0, filename: `${inv.cabinetNo}${inv.origin === 'China' ? 'CN' : ''}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }).from(element).save();
              await new Promise(r => setTimeout(r, 800)); 
          }
      } catch (error) { alert("下載失敗。"); }
      setIsDownloadingPdf(false);
  };

  const handleEditChange = (field, value) => { editValues.current[field] = value; };
  const startEditing = (record) => { setEditingId(record.id); editValues.current = { ...record }; };
  const saveEdit = () => {
      if (!editingId) return;
      const updates = { ...editValues.current };
      if (updates.shippedDisplay !== undefined || updates.product !== undefined) {
          const finalProduct = updates.product !== undefined ? updates.product : masterData.find(x => x.id === editingId)?.product;
          const finalDisplay = updates.shippedDisplay !== undefined ? updates.shippedDisplay : masterData.find(x => x.id === editingId)?.shippedDisplay;
          const parsed = parseQuantity(finalDisplay, finalProduct);
          updates.shippedDisplay = parsed.display; updates.shippedQty = parsed.value;
      }
      try { updateMasterDataRow(editingId, updates); } catch(e) { alert('儲存失敗：' + e.message); }
      setEditingId(null); editValues.current = {};
  };
  const handleDelete = (id) => { if(window.confirm("確定要永久刪除此筆資料嗎？")) deleteDoc(doc(db, 'everise_system', 'shared', 'master_data', id)); };
  const deleteBatchBySource = async (sourceName) => {
      if (!window.confirm(`警告：確定刪除來自 "${sourceName}" 的所有資料？`)) return;
      try {
          const targets = masterData.filter(d => (d.source || 'Unknown') === sourceName);
          for (let i = 0; i < targets.length; i += 400) {
              const batch = writeBatch(db);
              targets.slice(i, i + 400).forEach(d => batch.delete(doc(db, 'everise_system', 'shared', 'master_data', d.id)));
              await batch.commit();
          }
      } catch(e) { alert('刪除失敗！' + e.message); }
  };
  const addManualRevenue = async (data) => { try { await addDoc(collection(db, 'everise_system', 'shared', 'manual_revenue'), { ...data, timestamp: Date.now() }); setShowRevenueModal(false); } catch(e) { alert('失敗：' + e.message); } };
  const deleteManualRevenue = async (id) => { if(window.confirm("確定刪除此筆營收？")) await deleteDoc(doc(db, 'everise_system', 'shared', 'manual_revenue', id)); };
  const resetConfigToDefaults = async () => { if (window.confirm("重置櫃號至預設值？")) await updateConfig('clientConfig', DEFAULT_CLIENT_CONFIG); };

  // --- Modals ---
  const MappingModal = () => {
      const [localMappings, setLocalMappings] = useState({});
      if (!showMappingModal) return null;
      return (
          <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[85vh]">
                  <div className="p-6 bg-red-50 border-b border-red-100">
                      <h3 className="text-xl font-black text-red-700 flex items-center gap-2"><ShieldAlert /> ⚠️ 發現未知品名，請對應庫存</h3>
                      <p className="text-sm text-red-600 font-bold">泰國輸入了系統不認識的名稱，請選擇對應品項。選擇後系統將永久記住。</p>
                  </div>
                  <div className="p-6 overflow-auto flex-1 space-y-4">
                      {unmappedItems.map((item, idx) => (
                          <div key={idx} className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex gap-4 items-center">
                              <div className="flex-1 text-red-600 font-black">{item.rawProduct} ({item.rawColor})</div>
                              <ArrowLeft className="w-5 h-5 text-slate-300 transform rotate-180" />
                              <div className="flex-1">
                                  <select className="w-full border-2 border-emerald-200 bg-emerald-50 text-emerald-800 p-2 rounded-lg font-bold" onChange={(e) => {
                                      const target = inventoryMaster.find(i => i.id === e.target.value);
                                      if(target) setLocalMappings(p => ({ ...p, [item.rawKey]: { product: target.product, color: target.color } }));
                                  }}>
                                      <option value="">-- 請選擇標準品項 --</option>
                                      {inventoryMaster.sort((a,b)=>(a.product||'').localeCompare(b.product||'')).map(inv => <option key={inv.id} value={inv.id}>{inv.product} - {inv.color}</option>)}
                                  </select>
                              </div>
                          </div>
                      ))}
                  </div>
                  <div className="p-6 bg-slate-50 border-t flex justify-end gap-3">
                      <button onClick={() => {setShowMappingModal(false); setPendingUploadData(null);}} className="px-6 py-2 rounded-lg font-bold text-slate-500">取消匯入</button>
                      <button onClick={() => {
                          if (Object.keys(localMappings).length < unmappedItems.length && !window.confirm("還有未對應的品項！確定繼續？")) return;
                          const newMap = { ...productMappings, ...localMappings };
                          const processed = pendingUploadData.map(r => {
                              if (r.origin === 'ER' && newMap[`${r._rawProduct}|${r._rawColor}`]) {
                                  r.product = newMap[`${r._rawProduct}|${r._rawColor}`].product; r.color = newMap[`${r._rawProduct}|${r._rawColor}`].color;
                              }
                              return r;
                          });
                          finalizeUpload(processed, newMap);
                      }} className="px-8 py-2 bg-emerald-600 text-white rounded-lg font-bold">確認對應並繼續匯入</button>
                  </div>
              </div>
          </div>
      );
  };

  const RestockModal = ({ show, onClose }) => {
      const [product, setProduct] = useState(''); const [amount, setAmount] = useState(''); const [note, setNote] = useState('');
      if(!show) return null;
      return (
          <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
                  <h3 className="text-xl font-black mb-6 flex items-center gap-2"><Package /> 登記進貨 / 盤點微調</h3>
                  <div className="space-y-4">
                      <select className="w-full border rounded-lg px-3 py-2 font-bold" value={product} onChange={e=>setProduct(e.target.value)}>
                          <option value="">-- 選擇品項 --</option>
                          {inventoryMaster.map(i => <option key={i.id} value={`${i.product}|${i.color}`}>{i.product} ({i.color})</option>)}
                      </select>
                      <input type="number" className="w-full border rounded-lg px-3 py-2 font-mono text-lg font-bold" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="增減數量 (+進貨 / -短少)"/>
                      <input type="text" className="w-full border rounded-lg px-3 py-2" value={note} onChange={e=>setNote(e.target.value)} placeholder="備註"/>
                  </div>
                  <div className="mt-8 flex justify-end gap-3">
                      <button onClick={onClose} className="px-6 py-2 rounded-lg font-bold text-slate-500">取消</button>
                      <button onClick={async () => {
                          if(!product || !amount) return alert("請填寫完整");
                          await addDoc(collection(db, 'everise_system', 'shared', 'restock_data'), { date: new Date().toISOString().split('T')[0], product: product.split('|')[0], color: product.split('|')[1] || '', amount: parseInt(amount), note, timestamp: Date.now() });
                          onClose(); alert("✅ 數量已更新！");
                      }} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold">送出</button>
                  </div>
              </div>
          </div>
      );
  };

  const AddInventoryModal = ({ show, onClose }) => {
    const [p, setP] = useState(''); const [c, setC] = useState(''); const [i, setI] = useState(''); const [r, setR] = useState(''); const [s, setS] = useState('');
    if (!show) return null;
    return (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                <h3 className="text-xl font-black mb-6 flex items-center gap-2"><Plus className="text-blue-600"/> 新增品項</h3>
                <div className="space-y-4">
                    <input type="text" className="w-full border rounded-lg px-3 py-2 font-bold uppercase" value={p} onChange={e=>setP(e.target.value)} placeholder="品名"/>
                    <input type="text" className="w-full border rounded-lg px-3 py-2" value={c} onChange={e=>setC(e.target.value)} placeholder="顏色"/>
                    <input type="number" className="w-full border rounded-lg px-3 py-2 font-mono text-blue-600 bg-blue-50" value={i} onChange={e=>setI(e.target.value)} placeholder="期初庫存量"/>
                    <div className="flex gap-4"><input type="number" className="w-full border rounded-lg px-3 py-2 font-mono" value={r} onChange={e=>setR(e.target.value)} placeholder="安全水位"/><input type="number" className="w-full border rounded-lg px-3 py-2 font-mono" value={s} onChange={e=>setS(e.target.value)} placeholder="建議補貨量"/></div>
                </div>
                <div className="mt-8 flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 rounded-lg font-bold text-slate-500 hover:bg-slate-100">取消</button>
                    <button onClick={async () => {
                        if(!p || !c) return alert("請填寫品名顏色！");
                        await addDoc(collection(db, 'everise_system', 'shared', 'inventory_master'), { product: p.toUpperCase(), color: c, initialStock: parseInt(i)||0, restockTarget: parseInt(r)||0, suggestedRestock: parseInt(s)||0, shipped2025: 0, timestamp: Date.now() });
                        onClose(); alert("✅ 建檔成功！"); setP(''); setC(''); setI(''); setR(''); setS('');
                    }} className="flex-[2] py-3 bg-blue-600 text-white rounded-lg font-bold">儲存建檔</button>
                </div>
            </div>
        </div>
    );
  };


  // --- Views ---
  const MonthlyExportView = () => {
      const [exportMonth, setExportMonth] = useState('ALL');
      const [selectedItems, setSelectedItems] = useState([]);
      const handleExport = () => {
          if (selectedItems.length === 0) return alert("請勾選品項！");
          const csvRows = ["品名,顏色,匯出月份,期初(或累積)庫存,期間入庫量,期間出庫量,期末結算庫存"];
          inventoryMaster.filter(inv => selectedItems.includes(inv.id)).forEach(inv => {
              const isTargetMonth = (dateStr) => exportMonth === 'ALL' || (dateStr||'').startsWith(exportMonth);
              const mOut = masterData.filter(d => d.origin === 'ER' && d.status !== '作廢' && d.product === inv.product && d.color === inv.color);
              const mIn = restockData.filter(d => d.product === inv.product && d.color === inv.color);
              const outBefore = mOut.filter(d => exportMonth !== 'ALL' && (d.date||'') < exportMonth + '-01').reduce((s, d)=>s+(d.shippedQty||0), 0);
              const inBefore = mIn.filter(d => exportMonth !== 'ALL' && (d.date||'') < exportMonth + '-01').reduce((s, d)=>s+(d.amount||0), 0);
              const stockBeforeMonth = (inv.initialStock || 0) + inBefore - outBefore;
              const outDuring = mOut.filter(d => isTargetMonth(d.date)).reduce((s, d)=>s+(d.shippedQty||0), 0);
              const inDuring = mIn.filter(d => isTargetMonth(d.date)).reduce((s, d)=>s+(d.amount||0), 0);
              const finalStock = stockBeforeMonth + inDuring - outDuring;
              csvRows.push(`${inv.product},${inv.color},${exportMonth},${stockBeforeMonth},${inDuring},${outDuring},${finalStock}`);
          });
          const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob(["\uFEFF" + csvRows.join("\n")], { type: 'text/csv;charset=utf-8;' }));
          link.download = `庫存月結備份_${exportMonth}_${new Date().toISOString().split('T')[0]}.csv`; link.click();
      };
      return (
          <div className="w-full p-6 animate-in fade-in bg-slate-50 min-h-screen">
              <div className="bg-white rounded-2xl shadow-lg border p-8">
                  <h2 className="text-3xl font-black mb-6 flex items-center gap-3"><FileOutput className="text-blue-600" /> 月結備份匯出中心</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      <div className="col-span-1 border-r pr-8">
                          <h4 className="font-black text-slate-700 mb-4">1. 選擇結算月份</h4>
                          <select value={exportMonth} onChange={e=>setExportMonth(e.target.value)} className="w-full border-2 p-3 rounded-xl font-bold"><option value="ALL">全部累積至今</option>{availableMonths.map(m => <option key={m} value={m}>{m} 月</option>)}</select>
                          <button onClick={handleExport} className="w-full mt-8 bg-blue-600 text-white py-4 rounded-xl font-black flex justify-center gap-2"><Download /> 一鍵匯出 CSV</button>
                      </div>
                      <div className="col-span-2">
                          <div className="flex justify-between items-center mb-4"><h4 className="font-black text-slate-700">2. 勾選品項</h4><label className="text-blue-600 bg-blue-50 px-3 py-1 rounded font-bold cursor-pointer"><input type="checkbox" onChange={e => setSelectedItems(e.target.checked ? inventoryMaster.map(i=>i.id) : [])} checked={selectedItems.length === inventoryMaster.length && inventoryMaster.length > 0}/> 全選</label></div>
                          <div className="h-[400px] overflow-auto border-2 rounded-xl p-4 space-y-2">
                              {inventoryMaster.map(inv => (
                                  <label key={inv.id} className="flex items-center gap-3 p-3 bg-white border rounded-lg cursor-pointer"><input type="checkbox" checked={selectedItems.includes(inv.id)} onChange={(e) => setSelectedItems(e.target.checked ? [...selectedItems, inv.id] : selectedItems.filter(id=>id!==inv.id))} className="w-5 h-5 text-blue-600"/><span className="font-bold">{inv.product}</span><span className="text-slate-500 pl-3">{inv.color}</span></label>
                              ))}
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      );
  };

  const InventoryOverviewView = () => {
      const filteredInv = computedInventory.filter(inv => (filterProduct === 'ALL' || inv.product === filterProduct) && ((inv.product||'').toLowerCase().includes(searchTerm.toLowerCase()) || (inv.color||'').toLowerCase().includes(searchTerm.toLowerCase())));
      const uniqueProducts = [...new Set(inventoryMaster.map(i => i.product || 'Unknown'))].sort();
      return (
          <div className="w-full p-6 animate-in fade-in min-h-screen bg-slate-50">
              <div className="mb-6 flex justify-between items-center print:hidden">
                  <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2"><Package className="text-blue-600" /> 老闆專屬庫存總覽</h2>
                  <div className="flex gap-2">
                      <select value={filterProduct} onChange={e=>setFilterProduct(e.target.value)} className="border rounded-lg px-3 font-bold text-sm bg-white"><option value="ALL">所有品項</option>{uniqueProducts.map(p => <option key={p} value={p}>{p}</option>)}</select>
                      <input type="text" placeholder="關鍵字搜尋..." className="px-4 py-2 border rounded-lg text-sm w-40" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                      <button onClick={() => window.print()} className="bg-slate-800 text-white px-4 rounded-lg font-bold flex items-center gap-2 text-sm"><Printer className="w-4 h-4"/>列印</button>
                      <button onClick={() => setViewMode('monthlyExport')} className="bg-emerald-600 text-white px-4 rounded-lg font-bold flex items-center gap-2 text-sm"><FileDown className="w-4 h-4"/>備份中心</button>
                      <button onClick={() => setShowAddInvModal(true)} className="bg-blue-600 text-white px-4 rounded-lg font-bold flex items-center gap-2 text-sm"><Plus className="w-4 h-4" />新增</button>
                  </div>
              </div>
              <div className="bg-white rounded-xl shadow-md border overflow-hidden" id="print-area">
                  <table className="w-full text-left text-sm border-collapse">
                      <thead className="bg-slate-800 text-white sticky top-0 text-xs font-bold">
                          <tr>
                              <th className="p-4">品名</th><th className="p-4">顏色</th>
                              <th className="p-4 text-center text-slate-400">期初基準<br/><span className="font-normal text-[10px]">(表單基準)</span></th>
                              <th className="p-4 text-center text-red-400">SA系統已扣<br/><span className="font-normal text-[10px]">(- 出庫明細)</span></th>
                              <th className="p-4 text-center text-blue-400">登記進貨<br/><span className="font-normal text-[10px]">(+ 手動加總)</span></th>
                              <th className="p-4 text-center text-emerald-300 border-l border-slate-700">當前實際庫存<br/><span className="font-normal text-[10px]">(自動結算)</span></th>
                              <th className="p-4 text-center text-yellow-300">安全水位</th>
                              <th className="p-4 text-center text-indigo-300">建議補貨量</th>
                              <th className="p-4 text-center">狀態</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                          {filteredInv.map((inv, i) => {
                              let rowBg = i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'; let numColor = 'text-emerald-600';
                              if (inv.stockStatus === 'negative') { rowBg = 'bg-red-50/80'; numColor = 'text-red-600'; } else if (inv.stockStatus === 'low') { rowBg = 'bg-yellow-50/80'; numColor = 'text-yellow-600'; }
                              return (
                                  <tr key={inv.id} className={`hover:bg-slate-50 ${rowBg}`}>
                                      <td className="p-4 font-black">{inv.product}</td><td className="p-4 text-slate-600">{inv.color}</td>
                                      <td className="p-4 text-center font-mono text-slate-500">{inv.initialStock.toLocaleString()}</td>
                                      <td className="p-4 text-center font-mono font-bold text-red-500">-{inv.totalShipped.toLocaleString()}</td>
                                      <td className="p-4 text-center font-mono font-bold text-blue-500">+{inv.totalRestocked.toLocaleString()}</td>
                                      <td className={`p-4 text-center font-mono font-black text-xl border-l border-slate-100 ${numColor}`}>{inv.currentStock.toLocaleString()}</td>
                                      <td className="p-4 text-center font-mono text-slate-500">{inv.restockTarget||'-'}</td><td className="p-4 text-center font-mono font-black text-indigo-600">{inv.suggestedRestock||'-'}</td>
                                      <td className="p-4 text-center">
                                          {inv.stockStatus === 'negative' ? <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-black animate-pulse">欠貨</span> : inv.stockStatus === 'low' ? <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-black">需補貨</span> : <span className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-xs font-bold">充足</span>}
                                      </td>
                                  </tr>
                              );
                          })}
                      </tbody>
                  </table>
              </div>
          </div>
      );
  };

  const InventoryLogView = () => {
      const [logFilterProduct, setLogFilterProduct] = useState('ALL');
      const uniqueProducts = [...new Set(masterData.map(i => i.product || 'Unknown'))].sort();
      const logData = masterData.filter(d => d.origin === 'ER' && d.status !== '作廢' && (logFilterProduct === 'ALL' || d.product === logFilterProduct) && ((d.client||'').toLowerCase().includes(searchTerm.toLowerCase()) || (d.cabinetNo||'').toLowerCase().includes(searchTerm.toLowerCase()))).sort((a,b)=>new Date(b.date||0)-new Date(a.date||0));
      return (
          <div className="w-full p-6 animate-in fade-in min-h-screen bg-white">
              <div className="mb-6 flex justify-between items-center print:hidden">
                  <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2"><ListOrdered className="text-indigo-600" /> 出庫流水紀錄 (Log)</h2>
                  <div className="flex gap-2">
                     <select value={logFilterProduct} onChange={e=>setLogFilterProduct(e.target.value)} className="border rounded-lg px-3 font-bold text-sm bg-slate-50"><option value="ALL">全部品項</option>{uniqueProducts.map(p => <option key={p} value={p}>{p}</option>)}</select>
                     <input type="text" placeholder="搜尋客戶或櫃號..." className="px-4 py-2 border rounded-lg text-sm w-48 bg-slate-50" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                  </div>
              </div>
              <div className="border rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-left text-sm border-collapse">
                      <thead className="bg-indigo-50 sticky top-0 text-xs font-black text-indigo-900"><tr><th className="p-3">日期</th><th className="p-3">出貨客戶</th><th className="p-3">品名</th><th className="p-3">顏色</th><th className="p-3 text-right text-red-600">扣除數量 (-Y)</th><th className="p-3 text-center">對應 SA 櫃號</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">
                          {logData.map(d => (
                              <tr key={d.id} className="hover:bg-indigo-50/30"><td className="p-3 font-mono">{d.date || '-'}</td><td className="p-3 font-black">{d.client || '-'}</td><td className="p-3 font-bold">{d.product || '-'}</td><td className="p-3">{d.color || '-'}</td><td className="p-3 text-right font-mono font-black text-red-500">-{d.shippedQty || 0}</td><td className="p-3 text-center text-xs font-bold text-indigo-600 bg-indigo-50/50 rounded">{d.cabinetNo || allGroupedInvoices[d.client]?.find(inv => inv.date === d.date)?.cabinetNo || '-'}</td></tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      );
  };

  const Dashboard = () => {
    const dashboardClients = Object.keys(displayedGroupedInvoices).sort();
    return (
      <div className="w-full px-6 py-8 min-h-screen bg-slate-50">
        {dashboardClients.length === 0 ? (
          <div className="text-center py-40 border-4 border-dashed rounded-3xl"><LayoutDashboard className="w-20 h-20 text-slate-300 mx-auto mb-4" /><p className="text-slate-400 font-bold text-xl">當前篩選條件下沒有 SA 單據</p></div>
        ) : (
          dashboardClients.map(client => {
            const currentInvoices = displayedGroupedInvoices[client] || [];
            const config = clientConfig[client] || { startNo: 1, prefix: client };
            const nextStartNo = config.startNo + currentInvoices.length;
            return (
              <div key={client} className="mb-20 animate-in fade-in">
                <div className="flex justify-between items-end mb-8 border-b-2 pb-4 gap-4">
                  <div>
                    <div className="flex items-center gap-4 mb-3"><span className="bg-slate-900 text-white px-6 py-2 rounded-xl font-black text-3xl shadow-lg">{client}</span><h2 className="text-xl font-bold text-slate-400">請款單列表</h2></div>
                    <div className="bg-white border rounded-lg p-3 flex items-center gap-4 shadow-sm">
                        <div className="flex flex-col"><span className="text-[10px] font-bold text-slate-400">Current</span><span className="font-mono font-black text-xl text-slate-700">#{config.startNo}</span></div>
                        <div className="h-8 w-px bg-slate-200"></div>
                        <button onClick={() => { if (window.confirm(`確認更新 ${client} 的起始櫃號？下次從 [ ${nextStartNo} ] 開始。`)) updateConfig('clientConfig', { ...clientConfig, [client]: { ...config, startNo: nextStartNo } }); }} className="bg-slate-100 hover:bg-slate-800 hover:text-white text-slate-600 px-3 py-1.5 rounded-md text-xs font-bold transition-colors">設定下次從 #{nextStartNo} 開始 <ChevronRight className="w-3 h-3 inline" /></button>
                    </div>
                  </div>
                  <button onClick={() => { setActiveClient(client); setViewMode('printAll'); }} className="bg-emerald-600 text-white px-5 py-3 rounded-xl font-bold shadow-md hover:bg-emerald-700"><Layers className="w-5 h-5 inline mr-2"/>列印此畫面所有 SA</button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                  {currentInvoices.map(inv => (
                    <div key={inv.id} onClick={() => { setActiveClient(client); setSelectedInvoiceId(inv.id); setViewMode('preview'); }} className="bg-white border rounded-2xl p-6 shadow-sm hover:shadow-xl cursor-pointer">
                      <div className="flex justify-between items-start mb-4"><span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-md text-xs font-black shadow-sm">{inv.cabinetNo}</span>{inv.origin === 'China' ? <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded text-[10px] font-bold">CN</span> : <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[10px] font-bold">ER</span>}</div>
                      <div className="text-2xl font-black text-slate-800 mb-1">{inv.date}</div>
                      <div className="text-xs text-slate-400 font-bold"><Package className="w-3 h-3 inline" /> {inv.items.length} 筆明細</div>
                      <div className="mt-6 pt-4 border-t text-right"><span className="text-2xl font-black text-emerald-600"><span className="text-xs font-normal mr-1">THB</span>{Math.round(inv.total).toLocaleString()}</span></div>
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

  const MasterTableView = () => {
    return (
    <div className="w-full p-6 min-h-screen bg-slate-50">
      <div className="mb-6 flex justify-between bg-white p-4 rounded-xl shadow-sm"><h2 className="text-xl font-black flex items-center gap-2"><Edit3 className="text-blue-600" /> 年度明細與作廢管理</h2><input type="text" placeholder="搜尋..." className="px-4 py-2 border rounded-lg text-sm w-64" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
      <div className="bg-white rounded-xl shadow-md border overflow-hidden">
        <div className="overflow-x-auto max-h-[75vh]">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 sticky top-0 text-xs font-bold text-slate-600"><tr><th className="p-3">日期</th><th className="p-3">客戶</th><th className="p-3">櫃號</th><th className="p-3">產地</th><th className="p-3">品名</th><th className="p-3">顏色</th><th className="p-3 text-right">出貨量</th><th className="p-3 text-center">狀態</th><th className="p-3 text-center">操作</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMasterData.map(d => (
                <tr key={d.id} className={`hover:bg-blue-50 ${d.status === '作廢' ? 'opacity-50' : ''} ${editingId === d.id ? 'bg-yellow-50' : ''}`}>
                  {editingId === d.id ? (
                    <><td className="p-2"><input className="border w-full" defaultValue={d.date} onChange={e => handleEditChange('date', e.target.value)} /></td><td className="p-2 font-bold">{d.client}</td><td className="p-2"><input className="border w-full font-bold" defaultValue={d.cabinetNo} onChange={e => handleEditChange('cabinetNo', e.target.value)} /></td><td className="p-2 font-bold">{d.origin}</td><td className="p-2"><input className="border w-full font-bold" autoFocus defaultValue={d.product} onChange={e => handleEditChange('product', e.target.value)} /></td><td className="p-2"><input className="border w-full" defaultValue={d.color} onChange={e => handleEditChange('color', e.target.value)} /></td><td className="p-2"><input className="border w-full text-right" defaultValue={d.shippedDisplay || d.shippedQty} onChange={e => handleEditChange('shippedDisplay', e.target.value)} /></td><td className="p-2 text-center">{d.status}</td><td className="p-2 text-center"><button onClick={saveEdit} className="p-1 bg-green-500 text-white rounded"><CheckCircle2 className="w-4 h-4" /></button><button onClick={()=>setEditingId(null)} className="p-1 bg-slate-300 text-white rounded"><X className="w-4 h-4" /></button></td></>
                  ) : (
                    <><td className="p-3 text-slate-500">{d.date || '-'}</td><td className="p-3 font-bold text-slate-700">{d.client || '-'}</td><td className="p-3 font-bold text-blue-600">{d.cabinetNo || '-'}</td><td className="p-3 text-xs font-bold">{d.origin === 'China' ? <span className="text-red-500">CN</span> : <span className="text-blue-500">ER</span>}</td><td className={`p-3 font-bold ${d.status === '作廢' ? 'line-through text-slate-400' : 'text-slate-800'}`}>{d.product || '-'}</td><td className="p-3 text-slate-600">{d.color || '-'}</td><td className="p-3 text-right font-mono font-bold text-blue-600">{d.shippedQty || 0}</td><td className="p-3 text-center">{d.status === '作廢' && <span className="bg-red-100 text-red-600 px-2 rounded text-xs font-bold">已作廢</span>}</td><td className="p-3 text-center">{d.status !== '作廢' ? <><button onClick={()=>startEditing(d)} className="text-slate-300 hover:text-blue-500 mr-2"><Edit3 className="w-4 h-4 inline"/></button><button onClick={()=>handleVoidOrder(d.id)} className="text-red-400 font-bold text-xs bg-red-50 px-2 rounded border border-red-100 hover:bg-red-100">作廢回補</button></> : <button onClick={()=>handleDelete(d.id)} className="text-slate-300 hover:text-red-500"><Trash className="w-4 h-4 inline"/></button>}</td></>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )};

  const InvoiceTemplate = ({ inv }) => (
    <div className="w-[210mm] bg-white p-[10mm] min-h-[297mm] flex flex-col font-tnr text-black mx-auto">
      <div className="text-center mb-4 border-b-[2px] border-double border-black pb-2">
        <h1 className="text-2xl font-bold mb-1 uppercase">EVERISE MATERIAL INT'L LTD</h1>
        <p className="text-xs font-bold">TEL: 886-2-2741-9113 | FAX: 886-2-2727-9021</p><p className="text-xs underline font-bold">E-MAIL: e.material2727@gmail.com</p>
        <div className="inline-block border-[2px] border-black px-8 py-1 font-bold text-2xl mt-2">SHIPPING ADVICE</div>
      </div>
      <div className="grid grid-cols-2 mb-4 text-base">
        <div className="space-y-1"><div className="border-b border-black pb-0.5"><span className="font-bold text-sm mr-2">TO:</span><span className="font-bold uppercase text-lg">{inv.client}</span></div><div className="border-b border-black pb-0.5"><span className="font-bold text-sm mr-2">FROM:</span><span className="font-bold text-base">{inv.origin === 'China' ? 'China' : 'ER'}</span></div></div>
        <div className="space-y-1 pl-4"><div className="border-b border-black pb-0.5 flex justify-between"><span>DATE:</span><span className="font-bold">{inv.date}</span></div><div className="border-b border-black pb-0.5 flex justify-between"><span>C/NO:</span><span className="font-bold text-xl">{inv.cabinetNo}</span></div></div>
      </div>
      <table className="w-full border-t-[2px] border-black">
        <tbody className="divide-y divide-black">
          {inv.items.filter(i => i.status !== '作廢').map((item, idx) => (
            <React.Fragment key={idx}><tr><td colSpan="3" className="pt-2 pb-1 font-bold text-lg">ORDER "{item.product}"</td></tr><tr className="text-sm"><td className="w-1/3 py-1 font-bold uppercase">{item.color}</td><td className="py-1 text-center font-mono">{item.shippedDisplay || item.shippedQty + ' Y'} x {Math.round(item.price)} = THB</td><td className="py-1 text-right font-bold text-base">{(Math.round(item.shippedQty * Math.round(item.price))).toLocaleString()}</td></tr></React.Fragment>
          ))}
        </tbody>
      </table>
      <div className="mt-6 border-t-[4px] border-double border-black pt-4 flex justify-between items-baseline px-2"><span className="font-bold text-xl">TOTAL:</span><span className="font-bold text-3xl">THB {Math.round(inv.total).toLocaleString()}</span></div>
      <div className="mt-auto border-t-2 border-black pt-2 flex justify-between"><div className="font-bold underline text-xl tracking-widest uppercase">CASH</div><div className="text-[10px] font-bold uppercase">Shipping Advice Doc.</div></div>
    </div>
  );

  return (
    <div className="bg-slate-50 min-h-screen font-sans text-slate-800">
      
      <div className="bg-slate-900 border-b border-slate-700 sticky top-0 z-50 px-6 py-3 flex justify-between items-center print:hidden w-full">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-black text-white flex items-center gap-2"><Database className="w-6 h-6 text-emerald-400" /> EVERISE</h1>
          <div className="flex bg-slate-800 p-1 rounded-lg overflow-x-auto">
            {[ { id: 'dashboard', label: 'SA 請款單' }, { id: 'inventoryOverview', label: '庫存總覽' }, { id: 'inventoryLog', label: '庫存流水' }, { id: 'masterTable', label: '明細與作廢' }, { id: 'revenueStats', label: '營業額' }, { id: 'dataManagement', label: '進階管理' } ].map(t => (
              <button key={t.id} onClick={() => setViewMode(t.id)} className={`px-4 py-2 rounded-md text-xs font-bold whitespace-nowrap ${viewMode === t.id ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}>{t.label}</button>
            ))}
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <button onClick={() => setShowRestockModal(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg font-bold text-xs"><Plus className="w-4 h-4 inline"/> 單筆進貨</button>
          <label className={`bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg cursor-pointer font-bold text-xs`}><Upload className="w-4 h-4 inline" /> 整櫃入庫 <input type="file" accept=".csv" className="hidden" onChange={handleRestockUpload} /></label>
          <label className={`ml-4 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg cursor-pointer font-bold text-xs ${isUploading ? 'opacity-50' : ''}`}>{isUploading ? '處理中...' : '匯入出貨單 (扣庫存)'}<input type="file" accept=".csv" multiple className="hidden" onChange={handleFileUpload} disabled={isUploading} /></label>
        </div>
      </div>

      <MappingModal /> <RestockModal show={showRestockModal} onClose={() => setShowRestockModal(false)} /> <AddInventoryModal show={showAddInvModal} onClose={() => setShowAddInvModal(false)} />
      
      {['dashboard', 'masterTable', 'inventoryLog'].includes(viewMode) && (
          <div className="bg-white border-b border-slate-200 px-6 py-2 flex gap-4 items-center print:hidden shadow-sm sticky top-[60px] z-40 w-full">
              <Filter className="w-4 h-4 text-slate-400" /><span className="text-xs font-bold text-slate-400">全局篩選：</span>
              <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="border rounded-md text-sm font-bold py-1 px-2"><option value="ALL">所有月份</option>{availableMonths.map(m => <option key={m} value={m}>{m}</option>)}</select>
              <select value={filterOrigin} onChange={e => setFilterOrigin(e.target.value)} className="border rounded-md text-sm font-bold py-1 px-2"><option value="ALL">所有產地</option><option value="China">China (直發)</option><option value="ER">ER (倉庫)</option></select>
              <select value={activeMasterClient} onChange={e => setActiveMasterClient(e.target.value)} className="border rounded-md text-sm font-bold py-1 px-2"><option value="ALL">所有客戶</option>{sortedClients.map(c => <option key={c} value={c}>{c}</option>)}</select>
              {viewMode === 'dashboard' && <div className="ml-auto"><button onClick={downloadBatchPdfs} disabled={isDownloadingPdf} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold">{isDownloadingPdf ? '產生中...' : '批次下載當前 SA (PDF)'}</button></div>}
          </div>
      )}

      <div className="absolute top-[-9999px] left-[-9999px] opacity-0 pointer-events-none z-[-50]">{Object.values(displayedGroupedInvoices).flat().map(inv => (<div key={inv.id} id={`invoice-capture-${inv.id}`}><InvoiceTemplate inv={inv} /></div>))}</div>

      <main className="w-full">
        {viewMode === 'dashboard' && <Dashboard />}
        {viewMode === 'inventoryOverview' && <InventoryOverviewView />}
        {viewMode === 'inventoryLog' && <InventoryLogView />}
        {viewMode === 'monthlyExport' && <MonthlyExportView />}
        {viewMode === 'masterTable' && <MasterTableView />}

        {viewMode === 'revenueStats' && (
            <div className="w-full px-6 py-8 mx-auto space-y-6">
                <div className="flex justify-between items-center"><h2 className="text-3xl font-black">年度營業額統計</h2><button onClick={() => setShowRevenueModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2"><Plus className="w-4 h-4"/>新增營收</button></div>
                {revenueData.map((data) => (
                    <div key={data.monthKey} className="bg-white rounded-xl shadow-sm border p-6 flex flex-col md:flex-row gap-6 items-start">
                        <div className="w-full md:w-48 shrink-0 border-b md:border-b-0 md:border-r border-slate-100 pr-4">
                            <div className="text-sm font-bold text-slate-400 uppercase">{data.year}</div><div className="text-4xl font-black text-slate-800">{data.month} <span className="text-lg text-slate-400">月</span></div>
                            <div className="mt-2 text-xl font-black text-emerald-600 flex items-center gap-1"><span className="text-xs text-emerald-400">THB</span>{data.total.toLocaleString()}</div>
                            <div className="mt-4 space-y-2 border-t border-slate-100 pt-2 text-sm">
                                <div className="flex justify-between"><span className="text-slate-400 font-bold flex items-center gap-1"><Package className="w-3 h-3" /> 倉庫</span><span className="font-mono font-bold text-blue-600">{data.warehouseTotal.toLocaleString()}</span></div>
                                <div className="flex justify-between"><span className="text-slate-400 font-bold flex items-center gap-1"><MapPin className="w-3 h-3" /> 中國</span><span className="font-mono font-bold text-red-500">{data.chinaTotal.toLocaleString()}</span></div>
                            </div>
                        </div>
                        <div className="flex-1 w-full grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                            {data.clients.map((client, idx) => (
                                <div key={idx} className="bg-slate-50 p-2 rounded border border-slate-100"><span className="text-xs font-black truncate">{idx + 1}. {client.client}</span><span className="text-sm font-mono text-emerald-600 font-bold block">{client.amount.toLocaleString()}</span></div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        )}

        {viewMode === 'preview' && (
            <div className="w-full py-10 bg-slate-200 min-h-screen"><div className="max-w-[210mm] mx-auto mb-6 flex justify-between print:hidden"><button onClick={() => setViewMode('dashboard')} className="font-bold flex items-center gap-2"><ArrowLeft/>返回</button><button onClick={() => window.print()} className="bg-emerald-600 text-white px-6 py-2 rounded-lg font-bold">列印</button></div><div id="print-area"><InvoiceTemplate inv={(allGroupedInvoices[activeClient] || []).find(i => i.id === selectedInvoiceId)} /></div></div>
        )}

        {viewMode === 'printAll' && (
            <div className="w-full bg-slate-200 min-h-screen py-10 print:bg-white print:p-0 flex flex-col items-center"><div className="w-[210mm] mb-6 flex justify-between items-center print:hidden px-4"><button onClick={() => setViewMode('dashboard')} className="text-slate-700 font-bold"><ArrowLeft className="w-5 h-5 inline" /> 返回</button><button onClick={() => window.print()} className="bg-emerald-600 text-white px-6 py-2 rounded-lg font-bold"><Printer className="w-5 h-5 inline" /> 列印全部</button></div><div id="print-area">{displayedGroupedInvoices[activeClient]?.map(inv => <div key={inv.id} className="print-page-break"><InvoiceTemplate inv={inv} /></div>)}</div></div>
        )}

        {viewMode === 'dataManagement' && (
             <div className="w-full px-6 py-8 min-h-screen bg-slate-50 space-y-8">
                <div className="bg-white rounded-2xl shadow-sm border p-6">
                    <h3 className="font-black mb-4 flex items-center gap-2 text-xl"><TableIcon className="text-blue-600"/> 基礎設定與初始化</h3>
                    <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex justify-between items-center">
                        <div><h4 className="font-bold text-blue-900">匯入初始庫存表 (Inventory Baseline)</h4><p className="text-xs text-blue-600 mt-1">請上傳含有「2026年初始數量」欄位的 CSV，系統會建立防呆庫存表。</p></div>
                        <label className={`bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg cursor-pointer font-bold text-sm shadow-sm ${isUploadingBase ? 'opacity-50 pointer-events-none' : ''}`}>{isUploadingBase ? '建檔中...' : '建檔匯入'}<input type="file" accept=".csv" className="hidden" onChange={handleInventoryBaseUpload} disabled={isUploadingBase} /></label>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border"><h3 className="font-black mb-4 flex items-center gap-2"><KeyRound className="text-purple-600"/> 字典與設定重置</h3><button onClick={resetConfigToDefaults} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 rounded-lg mb-2">重置客戶櫃號至預設</button><button onClick={() => {if(window.confirm("確定清空品名對應字典？")) updateConfig('productMappings', {});}} className="w-full bg-orange-50 hover:bg-orange-100 text-orange-700 font-bold py-2 rounded-lg">清空品名智能對應字典</button></div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border"><h3 className="font-black mb-4 flex items-center gap-2"><Archive className="text-emerald-600"/> 歷史資料管理</h3><div className="h-40 overflow-auto border rounded-lg"><table className="w-full text-left text-sm"><thead className="bg-slate-100 sticky top-0"><tr><th className="p-2">來源檔名</th><th className="p-2 text-right">操作</th></tr></thead><tbody className="divide-y">{[...new Set(masterData.map(d => d.source || 'Unknown'))].map(source => <tr key={source}><td className="p-2 font-mono text-xs">{source} ({masterData.filter(d=>(d.source||'Unknown')===source).length} 筆)</td><td className="p-2 text-right"><button onClick={() => deleteBatchBySource(source)} className="text-red-500 font-bold text-xs"><Trash2 className="w-3 h-3 inline"/> 刪除</button></td></tr>)}</tbody></table></div></div>
                </div>
             </div>
        )}
      </main>

      <style dangerouslySetInnerHTML={{ __html: ` 
        @media print {
          body * { visibility: hidden; } #print-area, #print-area * { visibility: visible; }
          #print-area { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; }
          .bg-slate-200, .bg-slate-50, .shadow-xl, .bg-white { background: white !important; box-shadow: none !important; }
          .print-page-break { page-break-after: always !important; break-after: page !important; min-height: 297mm; }
          .print\\:hidden, nav, button { display: none !important; } @page { size: A4; margin: 0; }
        }
        .font-tnr { font-family: 'Times New Roman', Times, serif; }
      `}} />
    </div>
  );
};

export default App;