import { useState, useRef } from 'react';
import { useAccounting } from './context/AccountingContext';
import { createTransaction, COLL } from './accountingService';
import { Upload, CheckCircle, AlertTriangle, X, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

const FIELD_MAP = {
  'التاريخ': 'transaction_date',
  'تاريخ': 'transaction_date',
  'البيان': 'description',
  'بيان': 'description',
  'الملاحظة': 'description',
  'ملاحظة': 'description',
  'الوارد': '_in',
  'وارد': '_in',
  'الصادر': '_out',
  'صادر': '_out',
  'المبلغ': 'amount',
  'مبلغ': 'amount',
  'التصنيف': 'category_name',
  'تصنيف': 'category_name',
  'نوع': 'category_name',
  'الحساب': 'account_name',
  'حساب': 'account_name',
  'الرصيد': '_balance_skip',
  'رصيد': '_balance_skip',
  'الطرف': 'counterparty_name',
  'طرف': 'counterparty_name',
  'ملاحظات': 'notes',
  'مرجع': 'reference_no',
  'reference': 'reference_no',
};

export default function ImportLegacy({ showToast }) {
  const { accounts, categories, loggedInUser } = useAccounting();
  const [step, setStep] = useState(1); // 1=upload, 2=map, 3=preview, 4=done
  const [sheets, setSheets] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [rawData, setRawData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({});
  const [preview, setPreview] = useState([]);
  const [errors, setErrors] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const fileRef = useRef();

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target.result, { type: 'array' });
      setSheets(wb.SheetNames);
      setSelectedSheet(wb.SheetNames[0]);
      // store workbook for sheet switching
      fileRef._wb = wb;
    };
    reader.readAsArrayBuffer(file);
  };

  const loadSheet = () => {
    const wb = fileRef._wb;
    if (!wb || !selectedSheet) return;
    const ws = wb.Sheets[selectedSheet];
    const data = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });
    // Find header row (first non-empty row)
    let headerRowIdx = 0;
    for (let i = 0; i < data.length; i++) {
      if (data[i].some(cell => typeof cell === 'string' && cell.trim().length > 0)) {
        headerRowIdx = i;
        break;
      }
    }
    const hdrs = data[headerRowIdx].map(h => String(h).trim());
    setHeaders(hdrs);
    setRawData(data.slice(headerRowIdx+1).filter(row => row.some(c => c !== '')));
    // Auto-map
    const autoMap = {};
    hdrs.forEach(h => {
      if (FIELD_MAP[h]) autoMap[h] = FIELD_MAP[h];
      else autoMap[h] = '';
    });
    setMapping(autoMap);
    setStep(2);
  };

  const buildPreview = () => {
    const rows = [];
    const errs = [];
    rawData.slice(0, 100).forEach((row, i) => {
      const entry = {};
      headers.forEach((h, hi) => {
        const field = mapping[h];
        if (!field || field === '_balance_skip') return;
        entry[field] = String(row[hi] || '').trim();
      });

      // Parse amounts
      let amount = 0;
      let direction = 'صادر';
      const inVal = parseFloat(entry['_in']?.replace(/,/g,'') || 0);
      const outVal = parseFloat(entry['_out']?.replace(/,/g,'') || 0);
      if (inVal > 0) { amount = inVal; direction = 'وارد'; }
      else if (outVal > 0) { amount = outVal; direction = 'صادر'; }
      else if (entry.amount) { amount = parseFloat(entry.amount.replace(/,/g,'')) || 0; }

      delete entry['_in']; delete entry['_out'];
      entry.amount = amount;
      entry.direction = direction;
      entry.transaction_type = direction === 'وارد' ? 'قبض' : 'صرف';
      entry.status = 'مرحّل';
      entry.is_imported = true;
      entry.legacy_source_sheet = selectedSheet;
      entry.legacy_source_row = i + 2;

      if (!entry.transaction_date) {
        errs.push({ row: i+1, msg: 'تاريخ مفقود' }); return;
      }
      if (amount <= 0) {
        errs.push({ row: i+1, msg: 'مبلغ غير صالح' }); return;
      }
      rows.push(entry);
    });
    setPreview(rows);
    setErrors(errs);
    setStep(3);
  };

  const runImport = async () => {
    setImporting(true);
    let count = 0;
    for (const row of preview) {
      try {
        await createTransaction(row, loggedInUser?.username || 'import');
        count++;
      } catch(e) { console.error(e); }
    }
    setImportedCount(count);
    setImporting(false);
    setStep(4);
    showToast(`تم استيراد ${count} قيد بنجاح`, 'success');
  };

  return (
    <div className="animate-fade-in" style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
      <div className="card-header">
        <h2 className="card-title"><Upload /> استيراد البيانات القديمة (Excel/CSV)</h2>
      </div>

      {/* Step indicators */}
      <div style={{ display:'flex', gap:'0.5rem', alignItems:'center' }}>
        {['رفع الملف', 'ربط الأعمدة', 'معاينة', 'مكتمل'].map((label, i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:'0.4rem' }}>
            <div style={{
              width:'28px', height:'28px', borderRadius:'50%',
              background: step > i+1 ? 'var(--success)' : step === i+1 ? 'var(--primary)' : 'var(--border)',
              display:'flex', alignItems:'center', justifyContent:'center',
              color:'white', fontWeight:'700', fontSize:'0.85rem', flexShrink:0
            }}>{step > i+1 ? '✓' : i+1}</div>
            <span style={{ fontSize:'0.85rem', color: step === i+1 ? 'var(--primary)' : 'var(--text-secondary)' }}>{label}</span>
            {i < 3 && <span style={{ color:'var(--border)' }}>›</span>}
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === 1 && (
        <div className="card" style={{ textAlign:'center', padding:'3rem' }}>
          <Upload size={48} style={{ margin:'0 auto 1rem', color:'var(--primary)' }} />
          <h3 style={{ marginBottom:'0.5rem' }}>ارفع ملف Excel أو CSV</h3>
          <p style={{ color:'var(--text-secondary)', marginBottom:'1.5rem' }}>يدعم .xls و .xlsx و .csv — سيتم اكتشاف الترويسات العربية تلقائياً</p>
          <input type="file" accept=".xls,.xlsx,.csv" onChange={handleFile} id="fileInput" style={{ display:'none' }} />
          <label htmlFor="fileInput" className="btn btn-primary" style={{ cursor:'pointer', padding:'0.75rem 2rem' }}>اختيار ملف</label>
          {sheets.length > 0 && (
            <div style={{ marginTop:'1.5rem' }}>
              <div className="form-group" style={{ maxWidth:'300px', margin:'0 auto 1rem' }}>
                <label>اختر الورقة (Sheet)</label>
                <select value={selectedSheet} onChange={e => setSelectedSheet(e.target.value)}>
                  {sheets.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <button className="btn btn-primary" onClick={loadSheet}>تحميل الورقة</button>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Map columns */}
      {step === 2 && (
        <div className="card">
          <div className="card-header" style={{ marginBottom:'1rem' }}>
            <h3 className="card-title">ربط أعمدة الملف بحقول النظام</h3>
            <span style={{ color:'var(--text-secondary)', fontSize:'0.85rem' }}>{rawData.length} صف للاستيراد</span>
          </div>
          <div className="stats-grid">
            {headers.map(h => (
              <div key={h} className="form-group">
                <label style={{ fontSize:'0.85rem' }}>"{h}"</label>
                <select value={mapping[h] || ''} onChange={e => setMapping(m => ({...m, [h]: e.target.value}))}>
                  <option value="">تجاهل هذا العمود</option>
                  <option value="transaction_date">التاريخ</option>
                  <option value="description">البيان</option>
                  <option value="_in">وارد (+)</option>
                  <option value="_out">صادر (-)</option>
                  <option value="amount">المبلغ</option>
                  <option value="category_name">الفئة</option>
                  <option value="account_name">الحساب</option>
                  <option value="counterparty_name">الطرف</option>
                  <option value="reference_no">مرجع</option>
                  <option value="notes">ملاحظات</option>
                  <option value="_balance_skip">تجاهل (رصيد)</option>
                </select>
              </div>
            ))}
          </div>
          <button className="btn btn-primary" onClick={buildPreview} style={{ marginTop:'1rem', width:'100%' }}>معاينة البيانات</button>
        </div>
      )}

      {/* Step 3: Preview */}
      {step === 3 && (
        <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
          {errors.length > 0 && (
            <div className="card" style={{ borderColor:'var(--warning)', borderWidth:'2px', padding:'1rem' }}>
              <h4 style={{ color:'var(--warning)', marginBottom:'0.5rem' }}><AlertTriangle size={16}/> {errors.length} تحذير</h4>
              {errors.slice(0,5).map((e,i) => <div key={i} style={{ fontSize:'0.85rem', color:'var(--text-secondary)' }}>السطر {e.row}: {e.msg}</div>)}
            </div>
          )}
          <div className="card">
            <div className="card-header" style={{ marginBottom:'1rem' }}>
              <h3 className="card-title"><CheckCircle size={18}/> معاينة ({preview.length} قيد)</h3>
              <div style={{ display:'flex', gap:'0.5rem' }}>
                <button className="btn btn-outline" onClick={() => setStep(2)}>تعديل الربط</button>
                <button className="btn btn-primary" onClick={runImport} disabled={importing || preview.length === 0}>
                  {importing ? 'جاري الاستيراد...' : `استيراد ${preview.length} قيد`}
                </button>
              </div>
            </div>
            <div className="table-container" style={{ maxHeight:'400px' }}>
              <table>
                <thead><tr><th>التاريخ</th><th>البيان</th><th>وارد</th><th>صادر</th></tr></thead>
                <tbody>
                  {preview.slice(0,20).map((row, i) => (
                    <tr key={i}>
                      <td>{row.transaction_date}</td>
                      <td>{row.description}</td>
                      <td style={{ color:'var(--success)' }}>{row.direction === 'وارد' ? row.amount.toLocaleString() : ''}</td>
                      <td style={{ color:'var(--danger)' }}>{row.direction === 'صادر' ? row.amount.toLocaleString() : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.length > 20 && <div style={{ padding:'0.5rem', textAlign:'center', color:'var(--text-secondary)' }}>...و{preview.length-20} قيد آخر</div>}
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Done */}
      {step === 4 && (
        <div className="card" style={{ textAlign:'center', padding:'3rem' }}>
          <CheckCircle size={60} style={{ margin:'0 auto 1rem', color:'var(--success)' }} />
          <h3 style={{ marginBottom:'0.5rem' }}>تم الاستيراد بنجاح!</h3>
          <p style={{ color:'var(--text-secondary)' }}>تم استيراد {importedCount} قيد إلى قاعدة البيانات</p>
          <button className="btn btn-primary" style={{ marginTop:'1.5rem' }} onClick={() => { setStep(1); setPreview([]); setErrors([]); setSheets([]); }}>استيراد ملف آخر</button>
        </div>
      )}
    </div>
  );
}
