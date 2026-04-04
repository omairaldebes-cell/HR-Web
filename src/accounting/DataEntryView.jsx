import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, doc, updateDoc, setDoc } from 'firebase/firestore';
import { PlusCircle, FileText, Download, Hash, Tag, Settings as SettingsIcon, X } from 'lucide-react';

export default function DataEntryView({ showToast, loggedInUser }) {
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [account, setAccount] = useState(''); 
  const [transactionType, setTransactionType] = useState('صادر');
  const [amount, setAmount] = useState('');
  
  // Dynamic settings from Firestore
  const [settings, setSettings] = useState({ categories: [], customColumns: [] });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [newColumnLabel, setNewColumnLabel] = useState('');

  // Metadata for custom columns
  const [metadata, setMetadata] = useState({});

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'accounting_settings', 'global'), (docSnap) => {
      if (docSnap.exists()) {
        setSettings(docSnap.data());
      } else {
        // Initial defaults
        const defaults = { 
          categories: ['نقدية', 'مواصلات', 'مياه', 'مكتب تنمية', 'أبو محمد'], 
          customColumns: [{ id: 'receipt', label: 'رقم الإيصال', type: 'text' }] 
        };
        setDoc(doc(db, 'accounting_settings', 'global'), defaults);
      }
    });
    return () => unsub();
  }, []);

  const handleMetadataChange = (id, value) => {
    setMetadata(prev => ({ ...prev, [id]: value }));
  };

  const handleAddCategory = async () => {
    if (!newCategory.trim()) return;
    const updated = { ...settings, categories: [...settings.categories, newCategory.trim()] };
    await updateDoc(doc(db, 'accounting_settings', 'global'), updated);
    setNewCategory('');
    showToast('تم إضافة الحساب الجديد بنجاح', 'success');
  };

  const handleAddColumn = async () => {
    if (!newColumnLabel.trim()) return;
    const newCol = { id: `col_${Date.now()}`, label: newColumnLabel.trim(), type: 'text' };
    const updated = { ...settings, customColumns: [...settings.customColumns, newCol] };
    await updateDoc(doc(db, 'accounting_settings', 'global'), updated);
    setNewColumnLabel('');
    showToast('تم إضافة العمود الجديد بنجاح', 'success');
  };

  const handleAddEntry = async (e) => {
    e.preventDefault();
    if (!date || !description.trim() || !amount || !account) {
      showToast('يرجى تعبئة كافة الحقول المطلوبة', 'error');
      return;
    }

    try {
      await addDoc(collection(db, 'accounting_entries'), {
        date,
        description: description.trim(),
        account,
        transactionType,
        amount: parseFloat(amount) || 0,
        metadata,
        timestamp: Date.now(),
        createdBy: loggedInUser?.username || 'unknown'
      });
      
      showToast('تم حفظ القيد المحاسبي بنجاح', 'success');
      
      // Reset form
      setDescription('');
      setAmount('');
      setMetadata({});
      window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (err) {
      console.error(err);
      showToast('حدث خطأ أثناء الحفظ', 'error');
    }
  };

  return (
    <div className="animate-fade-in card">
      <div className="card-header">
        <h2 className="card-title"><PlusCircle /> إدخال قيد محاسبي (صادر / وارد)</h2>
        {loggedInUser?.role === 'admin' && (
          <button className="btn btn-outline" onClick={() => setIsSettingsOpen(!isSettingsOpen)}>
            <SettingsIcon size={16} /> إعدادات الحسابات
          </button>
        )}
      </div>

      {/* Settings Modal (Admin only) */}
      {isSettingsOpen && (
        <div className="card animate-fade-in" style={{ marginBottom: '2rem', border: '2px solid var(--primary)', position: 'relative' }}>
          <button onClick={() => setIsSettingsOpen(false)} style={{ position:'absolute', top:'10px', left:'10px', background:'none', border:'none', color:'var(--text-secondary)', cursor:'pointer' }}><X size={18}/></button>
          <h3 className="card-title" style={{ marginBottom: '1.5rem' }}>إدارة الحسابات والأعمدة</h3>
          
          <div className="stats-grid">
            <div className="form-group">
              <label>إضافة حساب جديد (Dropdown)</label>
              <div style={{ display:'flex', gap:'0.5rem' }}>
                <input type="text" value={newCategory} onChange={e=>setNewCategory(e.target.value)} placeholder="مثال: مكتب تنمية" />
                <button className="btn btn-primary" onClick={handleAddCategory}>إضافة</button>
              </div>
            </div>
            <div className="form-group">
              <label>إضافة عمود بيانات جديد (Custom Input)</label>
              <div style={{ display:'flex', gap:'0.5rem' }}>
                <input type="text" value={newColumnLabel} onChange={e=>setNewColumnLabel(e.target.value)} placeholder="مثال: رقم الصك" />
                <button className="btn btn-primary" onClick={handleAddColumn}>إضافة</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleAddEntry}>
        <div style={{ padding: '1.25rem', background: 'var(--bg-color)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', border: '1px solid var(--border)' }}>
          <h3 style={{ marginBottom: '1.25rem', fontSize: '1.1rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <FileText size={18} /> البيانات المحاسبية الأساسية
          </h3>
          
          <div className="stats-grid">
            <div className="form-group">
              <label>التاريخ</label>
              <input type="date" value={date} onChange={e=>setDate(e.target.value)} required />
            </div>

            <div className="form-group">
              <label>الحساب / الوجهة</label>
              <div style={{ position:'relative' }}>
                <Tag size={14} style={{ position:'absolute', top:'12px', right:'10px', color:'var(--text-secondary)' }} />
                <select value={account} onChange={e=>setAccount(e.target.value)} style={{ paddingRight:'2rem' }} required>
                  <option value="">-- اختر الحساب --</option>
                  {settings.categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>نوع القيد (Dual-Ledger)</label>
              <div style={{ display:'flex', background:'var(--surface)', borderRadius:'var(--radius-sm)', padding:'0.25rem', border:'1px solid var(--border)' }}>
                <button 
                  type="button" 
                  className={`btn ${transactionType === 'وارد' ? 'btn-success' : 'btn-ghost'}`} 
                  style={{ flex: 1, borderRadius:'var(--radius-xs)' }}
                  onClick={() => setTransactionType('وارد')}
                >وارد (+)</button>
                <button 
                  type="button" 
                  className={`btn ${transactionType === 'صادر' ? 'btn-danger' : 'btn-ghost'}`} 
                  style={{ flex: 1, borderRadius:'var(--radius-xs)' }}
                  onClick={() => setTransactionType('صادر')}
                >صادر (-)</button>
              </div>
            </div>

            <div className="form-group">
              <label>المبلغ (ل.س)</label>
              <div style={{ position:'relative' }}>
                <Hash size={14} style={{ position:'absolute', top:'12px', right:'10px', color:'var(--text-secondary)' }} />
                <input 
                  type="number" 
                  step="any"
                  style={{ paddingRight:'2rem' }}
                  placeholder="0.00"
                  value={amount} 
                  onChange={e => setAmount(e.target.value)} 
                  required
                />
              </div>
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '1rem' }}>
            <label>البيان / الملاحظة التفصيلية</label>
            <input type="text" placeholder="اكتب وصف العملية هنا..." value={description} onChange={e=>setDescription(e.target.value)} required />
          </div>
        </div>

        {/* Dynamic Custom Columns */}
        {settings.customColumns.length > 0 && (
          <div style={{ padding: '1.25rem', background: 'var(--bg-color)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <h3 style={{ marginBottom: '1.25rem', fontSize: '1.1rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Download size={18} /> بيانات إضافية (أعمدة مخصصة)
            </h3>
            
            <div className="stats-grid">
              {settings.customColumns.map(col => (
                <div key={col.id} className="form-group">
                  <label>{col.label}</label>
                  <input 
                    type={col.type}
                    value={metadata[col.id] || ''} 
                    onChange={e => handleMetadataChange(col.id, e.target.value)} 
                    placeholder="..." 
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <button type="submit" className="btn btn-primary" style={{ marginTop: '1.5rem', width: '100%', fontSize: '1.1rem', padding: '0.9rem', fontWeight:'bold', boxShadow:'0 4px 12px rgba(59, 130, 246, 0.3)' }}>
          حفظ القيد المحاسبي
        </button>
      </form>
    </div>
  );
}
