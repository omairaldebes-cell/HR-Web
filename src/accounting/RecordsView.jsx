import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { FileSpreadsheet, Trash2, Edit, TrendingUp, TrendingDown, Wallet } from 'lucide-react';

export default function RecordsView({ showToast, loggedInUser }) {
  const [entries, setEntries] = useState([]);
  const [settings, setSettings] = useState({ categories: [], customColumns: [] });
  
  const [filterMonth, setFilterMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    // Fetch settings to know labels of custom columns
    const unsubSet = onSnapshot(doc(db, 'accounting_settings', 'global'), (docSnap) => {
      if (docSnap.exists()) setSettings(docSnap.data());
    });

    const unsubEnt = onSnapshot(collection(db, 'accounting_entries'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEntries(data);
    });
    return () => { unsubSet(); unsubEnt(); };
  }, []);

  const handleDelete = async (id) => {
    if (window.confirm('هل أنت متأكد من حذف هذا السجل المحاسبي؟')) {
      await deleteDoc(doc(db, 'accounting_entries', id));
      showToast('تم حذف السجل', 'info');
    }
  };

  // 1. Filter by month
  // 2. Sort by timestamp (chronological) to calculate scale
  // 3. Map with Running Balance calculation
  const chronologicalEntries = entries
    .filter(e => e.date && e.date.startsWith(filterMonth))
    .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  let runningBalance = 0;
  const processedEntries = chronologicalEntries.map(entry => {
    const change = entry.transactionType === 'وارد' ? entry.amount : -entry.amount;
    runningBalance += change;
    return { ...entry, currentBalance: runningBalance };
  }).reverse(); // Latest on top for the UI

  const totalIn = chronologicalEntries.filter(e => e.transactionType === 'وارد').reduce((s, e) => s + e.amount, 0);
  const totalOut = chronologicalEntries.filter(e => e.transactionType === 'صادر').reduce((s, e) => s + e.amount, 0);

  return (
    <div className="animate-fade-in card">
      <div className="card-header no-print">
        <div style={{ display:'flex', gap:'1rem', alignItems:'center' }}>
          <h2 className="card-title" style={{ margin:0 }}><FileSpreadsheet /> سجل القيد الدفتري ({filterMonth})</h2>
          <input 
            type="month" 
            value={filterMonth} 
            onChange={e => setFilterMonth(e.target.value)} 
            className="btn-outline btn" 
            style={{ padding: '0.4rem 1rem' }} 
          />
        </div>
        <div className="stats-grid" style={{ marginBottom:0, gap:'1rem' }}>
          <div className="stat-card" style={{ padding:'0.5rem 1rem', display:'flex', gap:'1rem', alignItems:'center', background:'var(--surface)' }}>
            <div><TrendingUp size={16} color="var(--success)"/> <span style={{fontSize:'0.8rem'}}>وارد:</span> <span style={{fontWeight:'700'}}>{totalIn.toLocaleString()}</span></div>
            <div><TrendingDown size={16} color="var(--danger)"/> <span style={{fontSize:'0.8rem'}}>صادر:</span> <span style={{fontWeight:'700'}}>{totalOut.toLocaleString()}</span></div>
            <div><Wallet size={16} color="var(--primary)"/> <span style={{fontSize:'0.8rem'}}>صافي:</span> <span style={{fontWeight:'700'}}>{(totalIn - totalOut).toLocaleString()}</span></div>
          </div>
        </div>
      </div>

      <div className="table-container" style={{ WebkitOverflowScrolling: 'touch', overflowX: 'auto', maxHeight:'600px' }}>
        <table style={{ minWidth: '1200px' }}>
          <thead style={{ position:'sticky', top:0, zIndex:10 }}>
            <tr>
              <th style={{ width:'120px' }}>التاريخ</th>
              <th style={{ width:'250px' }}>البيان / الملاحظة</th>
              <th style={{ width:'150px' }}>الحساب</th>
              <th>وارد (+)</th>
              <th>صادر (-)</th>
              <th style={{ background:'var(--primary)', color:'white', fontWeight:'bold' }}>الرصيد التراكمي</th>
              {settings.customColumns.map(col => <th key={col.id}>{col.label}</th>)}
              {loggedInUser?.role === 'admin' && <th style={{ position: 'sticky', left: 0, zIndex: 11, background: 'var(--surface)' }}>إجراءات</th>}
            </tr>
          </thead>
          <tbody>
            {processedEntries.length === 0 ? (
              <tr>
                <td colSpan={settings.customColumns.length + 6} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding:'2rem' }}>لا يوجد سجلات متوفرة لهذا الشهر</td>
              </tr>
            ) : (
              processedEntries.map((entry, idx) => (
                <tr key={entry.id} style={{ animation: `fade-in 0.3s ease-out ${idx * 0.05}s forwards` }}>
                  <td style={{ fontWeight: 'bold' }}>{entry.date}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize:'0.9rem' }}>{entry.description}</td>
                  <td><span className="badge" style={{ background:'var(--surface)', color:'var(--text-primary)', border:'1px solid var(--border)' }}>{entry.account}</span></td>
                  <td style={{ color: entry.transactionType === 'وارد' ? 'var(--success)' : 'var(--text-secondary)', fontWeight: entry.transactionType === 'وارد' ? 'bold' : 'normal' }}>
                    {entry.transactionType === 'وارد' ? entry.amount.toLocaleString() : '-'}
                  </td>
                  <td style={{ color: entry.transactionType === 'صادر' ? 'var(--danger)' : 'var(--text-secondary)', fontWeight: entry.transactionType === 'صادر' ? 'bold' : 'normal' }}>
                    {entry.transactionType === 'صادر' ? entry.amount.toLocaleString() : '-'}
                  </td>
                  <td style={{ fontWeight: '800', color: 'var(--primary)', background: 'rgba(59, 130, 246, 0.05)' }}>
                    {entry.currentBalance.toLocaleString()} ل.س
                  </td>
                  {settings.customColumns.map(col => (
                    <td key={col.id} style={{ fontSize:'0.85rem' }}>
                      {entry.metadata?.[col.id] || '-'}
                    </td>
                  ))}
                  {loggedInUser?.role === 'admin' && (
                    <td style={{ position: 'sticky', left: 0, zIndex: 5, background: 'var(--surface)', display: 'flex', gap: '0.4rem' }}>
                      <button onClick={() => handleDelete(entry.id)} className="btn btn-danger" style={{ padding: '0.3rem 0.5rem' }} title="حذف">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
