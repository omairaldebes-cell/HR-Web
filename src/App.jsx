import { useState, useEffect, useMemo } from 'react';
import { calculatePenaltyHours, parseExcel } from './utils';
import { db } from './firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot } from 'firebase/firestore';
import { 
  Users, 
  Clock, 
  Upload, 
  LayoutDashboard, 
  PlusCircle, 
  ListTodo,
  AlertCircle,
  FileSpreadsheet,
  Settings,
  Trash2,
  CalendarCheck,
  Banknote,
  FileText,
  Edit
} from 'lucide-react';

const DEFAULT_SETTINGS = {
  workStart: '09:00',
  workEnd: '15:00',
  hoursPerLeaveDay: 6,
  overtimeRate: 0
};

const navItems = [
  { id: 'dashboard', label: 'لوحة القيادة', icon: LayoutDashboard },
  { id: 'employees', label: 'إدارة الموظفين', icon: Users },
  { id: 'attendance', label: 'تسجيل الحضور', icon: Clock },
  { id: 'records', label: 'سجل الحضور الكامل', icon: FileText },
  { id: 'leaves', label: 'طلبات الإجازة', icon: CalendarCheck },
  { id: 'advances', label: 'السلف النقدية', icon: Banknote },
  { id: 'upload', label: 'رفع ملف إكسل', icon: Upload },
  { id: 'settings', label: 'الإعدادات', icon: Settings },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // App State (from Firebase)
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [advances, setAdvances] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [settingsDocId, setSettingsDocId] = useState(null);

  // Current View Month
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // Fetch from Firebase
  useEffect(() => {
    const unsubEmp = onSnapshot(collection(db, 'employees'), (snapshot) => {
      setEmployees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubAtt = onSnapshot(collection(db, 'attendance'), (snapshot) => {
      setAttendance(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubAdv = onSnapshot(collection(db, 'advances'), (snapshot) => {
      setAdvances(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubSet = onSnapshot(collection(db, 'settings'), (snapshot) => {
      if (!snapshot.empty) {
        setSettingsDocId(snapshot.docs[0].id);
        const data = snapshot.docs[0].data();
        setSettings({ ...DEFAULT_SETTINGS, ...data });
      } else {
        // Init settings doc if none exists
        addDoc(collection(db, 'settings'), DEFAULT_SETTINGS).then(ref => {
          setSettingsDocId(ref.id);
        });
      }
    });

    return () => {
      unsubEmp();
      unsubAtt();
      unsubAdv();
      unsubSet();
    };
  }, []);

  // Derived Statistics for Dashboard (Filtered by Month)
  const stats = useMemo(() => {
    return employees.map(emp => {
      const allRecords = attendance.filter(a => a.employeeId === emp.id);
      const totalAllPenaltyHours = allRecords.reduce((sum, r) => sum + (r.penaltyHours || 0), 0);
      const hoursPerLeaveDay = settings.hoursPerLeaveDay || 6;
      const consumedLeavesAllTime = (totalAllPenaltyHours / hoursPerLeaveDay).toFixed(2);
      const remainingLeaves = (emp.totalLeaves - consumedLeavesAllTime).toFixed(2);

      const monthRecords = allRecords.filter(a => a.date && a.date.startsWith(viewMonth));
      const monthPenaltyHours = monthRecords.reduce((sum, r) => sum + (r.penaltyHours || 0), 0);
      const monthExtraHours = monthRecords.reduce((sum, r) => sum + (parseFloat(r.extraHours) || 0), 0);
      
      const baseSalary = parseFloat(emp.salary) || 0;
      const otValue = monthExtraHours * (parseFloat(settings.overtimeRate) || 0);

      const monthAdvancesList = advances.filter(ad => ad.employeeId === emp.id && ad.month === viewMonth);
      const totalAdvances = monthAdvancesList.reduce((sum, ad) => sum + (parseFloat(ad.amount) || 0), 0);

      const netSalary = baseSalary + otValue - totalAdvances;

      return {
        ...emp,
        remainingLeaves,
        monthPenaltyHours,
        monthExtraHours,
        otValue,
        totalAdvances,
        netSalary
      };
    });
  }, [employees, attendance, advances, settings, viewMonth]);

  const Dashboard = () => (
    <div className="animate-fade-in">
      <div className="card-header">
        <h2 className="card-title"><LayoutDashboard /> لوحة القيادة</h2>
        <div>
          <input type="month" value={viewMonth} onChange={e => setViewMonth(e.target.value)} className="btn-outline btn" style={{padding: '0.4rem 1rem'}} />
        </div>
      </div>

      <div className="card">
        <h3 className="card-title" style={{ marginBottom: '1rem' }}><ListTodo /> التقرير الشهري ({viewMonth})</h3>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>اسم الموظف</th>
                <th>الراتب الأساسي</th>
                <th>رصيد الإجازات المتبقي</th>
                <th>ساعات التأخير (الشهر)</th>
                <th>العمل الإضافي (ساعات)</th>
                <th>قيمة الإضافي</th>
                <th>السلف المخصومة</th>
                <th>الصافي المستحق</th>
              </tr>
            </thead>
            <tbody>
              {stats.length === 0 ? (
                <tr><td colSpan="8" style={{textAlign: 'center', color: 'var(--text-secondary)'}}>لا يوجد بيانات (جاري التحميل أو لا يوجد موظفين)</td></tr>
              ) : (
                stats.map(s => (
                  <tr key={s.id}>
                    <td style={{fontWeight: '700'}}>{s.name}</td>
                    <td>{s.salary} ل.س</td>
                    <td>
                      <span className={`badge ${s.remainingLeaves < 3 ? 'badge-danger' : 'badge-success'}`}>
                        {s.remainingLeaves} أيام
                      </span>
                    </td>
                    <td style={{color: s.monthPenaltyHours > 0 ? 'var(--danger)' : 'inherit'}}>{s.monthPenaltyHours} ساعة</td>
                    <td>{s.monthExtraHours} ساعة</td>
                    <td>{s.otValue.toLocaleString()} ل.س</td>
                    <td style={{color: s.totalAdvances > 0 ? 'var(--warning)' : 'inherit'}}>{s.totalAdvances.toLocaleString()} ل.س</td>
                    <td style={{fontWeight: '800', color: 'var(--primary)'}}>{s.netSalary.toLocaleString()} ل.س</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const EmployeesView = () => {
    const [name, setName] = useState('');
    const [salary, setSalary] = useState('');
    const [leaves, setLeaves] = useState(12);
    const [workDays, setWorkDays] = useState([0, 1, 2, 3, 4]); // 0=Sun, 1=Mon, ..., 4=Thu
    const [editId, setEditId] = useState(null);

    const handleAdd = async (e) => {
      e.preventDefault();
      if (!name.trim() || !salary.trim()) return;
      
      const data = {
        name: name.trim(),
        salary: salary,
        totalLeaves: parseFloat(leaves),
        workDays
      };

      if (editId) {
        await updateDoc(doc(db, 'employees', editId), data);
        setEditId(null);
      } else {
        await addDoc(collection(db, 'employees'), data);
      }
      
      setName('');
      setSalary('');
      setLeaves(12);
      setWorkDays([0, 1, 2, 3, 4]);
    };

    const handleEdit = (emp) => {
      setEditId(emp.id);
      setName(emp.name);
      setSalary(emp.salary);
      setLeaves(emp.totalLeaves);
      setWorkDays(emp.workDays || [0, 1, 2, 3, 4]);
    };

    const handleDelete = async (id) => {
      if(window.confirm('هل أنت متأكد من حذف هذا الموظف؟')) {
        await deleteDoc(doc(db, 'employees', id));
      }
    };

    const toggleDay = (dayIndex) => {
      if (workDays.includes(dayIndex)) {
        setWorkDays(workDays.filter(d => d !== dayIndex));
      } else {
        setWorkDays([...workDays, dayIndex].sort());
      }
    };

    const daysOfWeek = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];

    return (
      <div className="animate-fade-in grid-cols-2" style={{display: 'flex', flexDirection: 'column', gap: '2rem'}}>
        <div className="card">
          <div className="card-header">
            <h2 className="card-title"><PlusCircle /> إضافة موظف جديد</h2>
          </div>
          <form onSubmit={handleAdd}>
            <div className="grid-cols-2" style={{marginBottom: '1rem'}}>
              <div className="form-group">
                <label>اسم الموظف</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>الراتب الشهري (ل.س)</label>
                <input type="number" value={salary} onChange={e => setSalary(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>رصيد الإجازات السنوي (أيام)</label>
                <input type="number" step="0.5" value={leaves} onChange={e => setLeaves(e.target.value)} required />
              </div>
            </div>
            
            <div className="form-group">
              <label>أيام العمل الافتراضية</label>
              <div style={{display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.5rem'}}>
                {daysOfWeek.map((day, i) => (
                  <label key={i} style={{display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer'}}>
                    <input type="checkbox" checked={workDays.includes(i)} onChange={() => toggleDay(i)} style={{width: 'auto'}} />
                    {day}
                  </label>
                ))}
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{marginTop: '1rem'}}>
              {editId ? 'تحديث بيانات الموظف' : 'إضافة الموظف'}
            </button>
          </form>
        </div>

        <div className="card">
          <h2 className="card-title" style={{marginBottom: '1rem'}}><Users /> قائمة الموظفين</h2>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>الراتب (ل.س)</th>
                  <th>رصيد الإجازة</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {employees.map(emp => (
                  <tr key={emp.id}>
                    <td style={{fontWeight: '700'}}>{emp.name}</td>
                    <td>{parseFloat(emp.salary).toLocaleString()}</td>
                    <td>{emp.totalLeaves}</td>
                    <td>
                      <button onClick={() => handleEdit(emp)} className="btn btn-secondary" style={{padding: '0.4rem 0.8rem', marginLeft: '0.5rem'}}>
                        <Edit size={16} /> تعديل
                      </button>
                      <button onClick={() => handleDelete(emp.id)} className="btn btn-danger" style={{padding: '0.4rem 0.8rem'}}>
                        <Trash2 size={16} /> حذف
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const AttendanceView = () => {
    const [empId, setEmpId] = useState('');
    const [date, setDate] = useState('');
    const [checkIn, setCheckIn] = useState('');
    const [checkOut, setCheckOut] = useState('');
    const [extraHours, setExtraHours] = useState(0);

    const handleAdd = async (e) => {
      e.preventDefault();
      if (!empId || !date) return;

      const penaltyHours = calculatePenaltyHours(checkIn, checkOut, settings.workStart, settings.workEnd);
      
      const record = {
        employeeId: empId,
        date,
        checkIn,
        checkOut,
        penaltyHours,
        extraHours: parseFloat(extraHours) || 0,
        type: 'manual',
        timestamp: Date.now()
      };

      await addDoc(collection(db, 'attendance'), record);
      alert(`تم إضافة السجل بنجاح. ساعات التأخير المحسوبة: ${penaltyHours} ساعة.`);
      setDate(''); setCheckIn(''); setCheckOut(''); setEmpId(''); setExtraHours(0);
    };

    return (
      <div className="animate-fade-in card">
        <h2 className="card-title" style={{marginBottom: '1.5rem'}}><Clock /> إضافة سجل حضور وعمل إضافي</h2>
        <form onSubmit={handleAdd}>
          <div className="stats-grid">
            <div className="form-group">
              <label>الموظف</label>
              <select value={empId} onChange={e => setEmpId(e.target.value)} required>
                <option value="">-- اختر الموظف --</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>التاريخ</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>الحضور الفعلي</label>
              <input type="time" value={checkIn} onChange={e => setCheckIn(e.target.value)} />
            </div>
            <div className="form-group">
              <label>الانصراف الفعلي</label>
              <input type="time" value={checkOut} onChange={e => setCheckOut(e.target.value)} />
            </div>
            <div className="form-group">
              <label>ساعات العمل الإضافي</label>
              <input type="number" step="0.5" value={extraHours} onChange={e => setExtraHours(e.target.value)} />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" style={{marginTop: '1rem'}}>حفظ السجل السحابي</button>
        </form>
      </div>
    );
  };

  const RecordsView = () => {
    const [filterEmp, setFilterEmp] = useState('');
    const [filterDate, setFilterDate] = useState('');
    const [editId, setEditId] = useState(null);
    const [editData, setEditData] = useState({ checkIn: '', checkOut: '', extraHours: 0 });

    const handleEdit = async (rec) => {
      if (editId === rec.id) {
        const penaltyHours = calculatePenaltyHours(editData.checkIn, editData.checkOut, settings.workStart, settings.workEnd);
        await updateDoc(doc(db, 'attendance', rec.id), {
          checkIn: editData.checkIn,
          checkOut: editData.checkOut,
          extraHours: parseFloat(editData.extraHours) || 0,
          penaltyHours
        });
        setEditId(null);
      } else {
        setEditId(rec.id);
        setEditData({ checkIn: rec.checkIn || '', checkOut: rec.checkOut || '', extraHours: rec.extraHours || 0 });
      }
    };

    const handleDelete = async (id) => {
      if(window.confirm('हل أنت متأكد من حذف السجل؟')) {
        await deleteDoc(doc(db, 'attendance', id));
      }
    }

    const filtered = attendance.slice()
      .sort((a,b) => (b.timestamp || 0) - (a.timestamp || 0)) // Sort newest
      .filter(rec => {
        const emp = employees.find(e => e.id === rec.employeeId);
        const empName = emp ? emp.name.toLowerCase() : '';
        const matchEmp = filterEmp ? empName.includes(filterEmp.toLowerCase()) : true;
        const matchDate = filterDate ? rec.date === filterDate : true;
        return matchEmp && matchDate;
      });

    return (
      <div className="animate-fade-in card">
        <h2 className="card-title" style={{marginBottom: '1.5rem'}}><FileText /> سجل الحضور (مزامنة سحابية)</h2>
        
        <div className="stats-grid" style={{marginBottom: '1rem', backgroundColor: 'var(--bg-color)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)'}}>
          <div className="form-group" style={{marginBottom: 0}}>
            <label>تصفية باسم الموظف</label>
            <input type="text" placeholder="ابحث بالاسم..." value={filterEmp} onChange={e => setFilterEmp(e.target.value)} />
          </div>
          <div className="form-group" style={{marginBottom: 0}}>
            <label>تصفية بالتاريخ</label>
            <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
          </div>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>الموظف</th>
                <th>التاريخ</th>
                <th>النوع</th>
                <th>الحضور</th>
                <th>الانصراف</th>
                <th>العمل الإضافي</th>
                <th>ساعات التأخير</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(rec => {
                const emp = employees.find(e => e.id === rec.employeeId);
                const isEditing = editId === rec.id;
                
                return (
                  <tr key={rec.id}>
                    <td style={{fontWeight: '700'}}>{emp?.name || 'محذوف'}</td>
                    <td>{rec.date}</td>
                    <td>{rec.type === 'leave' ? 'إجازة' : rec.type === 'excel' ? 'إكسل' : 'يدوي'}</td>
                    
                    {isEditing ? (
                      <>
                        <td><input type="time" value={editData.checkIn} onChange={e => setEditData({...editData, checkIn: e.target.value})} style={{padding: '0.2rem', width: 'auto'}} /></td>
                        <td><input type="time" value={editData.checkOut} onChange={e => setEditData({...editData, checkOut: e.target.value})} style={{padding: '0.2rem', width: 'auto'}} /></td>
                        <td><input type="number" step="0.5" value={editData.extraHours} onChange={e => setEditData({...editData, extraHours: e.target.value})} style={{padding: '0.2rem', width: '60px'}} /></td>
                        <td>سيتم الحساب</td>
                      </>
                    ) : (
                      <>
                        <td>{rec.checkIn || (rec.type==='leave' ? '-' : 'غير مسجل')}</td>
                        <td>{rec.checkOut || (rec.type==='leave' ? '-' : 'غير مسجل')}</td>
                        <td>{rec.extraHours || 0} ساعة</td>
                        <td style={{color: rec.penaltyHours > 0 ? 'var(--danger)' : 'inherit'}}>{rec.penaltyHours} ساعة</td>
                      </>
                    )}

                    <td>
                      {rec.type !== 'leave' && (
                        <button onClick={() => handleEdit(rec)} className={`btn ${isEditing ? 'btn-success' : 'btn-secondary'}`} style={{padding: '0.3rem 0.6rem', marginLeft: '0.5rem', backgroundColor: isEditing ? 'var(--success)' : ''}}>
                          {isEditing ? 'حفظ' : 'تعديل'}
                        </button>
                      )}
                      <button onClick={() => handleDelete(rec.id)} className="btn btn-danger" style={{padding: '0.3rem 0.6rem'}}>
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && <tr><td colSpan="8" style={{textAlign: 'center'}}>لا يوجد سجلات</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const LeaveRequestsView = () => {
    const [empId, setEmpId] = useState('');
    const [date, setDate] = useState('');

    const handleAdd = async (e) => {
      e.preventDefault();
      if (!empId || !date) return;
      
      const record = {
        employeeId: empId,
        date,
        checkIn: '',
        checkOut: '',
        penaltyHours: settings.hoursPerLeaveDay, 
        extraHours: 0,
        type: 'leave',
        timestamp: Date.now()
      };

      await addDoc(collection(db, 'attendance'), record);
      alert(`تم تسجيل إجازة للموظف واحتساب ${settings.hoursPerLeaveDay} ساعات غياب تعادل يوماً واحداً.`);
      setDate(''); setEmpId('');
    };

    return (
      <div className="animate-fade-in grid-cols-2" style={{display: 'flex', flexDirection: 'column', gap: '2rem'}}>
        <div className="card">
          <h2 className="card-title" style={{marginBottom: '1.5rem'}}><CalendarCheck /> إضافة يوم إجازة (خصم من الرصيد)</h2>
          <form onSubmit={handleAdd} className="flex-row" style={{alignItems: 'flex-end'}}>
            <div className="form-group" style={{flex: 1, marginBottom: 0}}>
              <label>الموظف</label>
              <select value={empId} onChange={e => setEmpId(e.target.value)} required>
                <option value="">-- اختر الموظف --</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div className="form-group" style={{flex: 1, marginBottom: 0}}>
              <label>تاريخ الإجازة</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} required />
            </div>
            <button type="submit" className="btn btn-primary">حفظ الإجازة</button>
          </form>
        </div>
      </div>
    );
  };

  const AdvancesView = () => {
    const [empId, setEmpId] = useState('');
    const [month, setMonth] = useState(() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    const [amount, setAmount] = useState('');

    const handleAdd = async (e) => {
      e.preventDefault();
      if (!empId || !month || !amount) return;
      
      const newAdv = {
        employeeId: empId,
        month,
        amount: parseFloat(amount),
        timestamp: Date.now()
      };

      await addDoc(collection(db, 'advances'), newAdv);
      alert(`تم تسجيل السلفة بنجاح.`);
      setEmpId(''); setAmount('');
    };

    const handleDelete = async (id) => {
      if(window.confirm('حذف هذه السلفة؟')) {
         await deleteDoc(doc(db, 'advances', id));
      }
    }

    return (
      <div className="animate-fade-in grid-cols-2" style={{display: 'flex', flexDirection: 'column', gap: '2rem'}}>
        <div className="card">
          <h2 className="card-title" style={{marginBottom: '1.5rem'}}><Banknote /> تقديم سلفة على الراتب</h2>
          <form onSubmit={handleAdd}>
            <div className="stats-grid">
              <div className="form-group">
                <label>الموظف</label>
                <select value={empId} onChange={e => setEmpId(e.target.value)} required>
                  <option value="">-- اختر --</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>تخصم من راتب شهر</label>
                <input type="month" value={month} onChange={e => setMonth(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>المبلغ (ل.س)</label>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} required />
              </div>
            </div>
            <button type="submit" className="btn btn-primary" style={{marginTop: '1rem'}}>صرف السلفة</button>
          </form>
        </div>
        
        <div className="card">
          <h2 className="card-title" style={{marginBottom: '1rem'}}>سجل السلف المدفوعة</h2>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>الموظف</th>
                  <th>الشهر المعني</th>
                  <th>المبلغ (ل.س)</th>
                  <th>حذف</th>
                </tr>
              </thead>
              <tbody>
                {advances.slice()
                .sort((a,b) => (b.timestamp || 0) - (a.timestamp || 0))
                .map(adv => {
                  const emp = employees.find(e => e.id === adv.employeeId);
                  return (
                    <tr key={adv.id}>
                      <td>{emp?.name}</td>
                      <td>{adv.month}</td>
                      <td>{adv.amount.toLocaleString()}</td>
                      <td>
                        <button onClick={() => handleDelete(adv.id)} className="btn btn-danger" style={{padding: '0.3rem'}}>
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const UploadView = () => {
    const handleFile = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const data = await parseExcel(file);
        if (!data || data.length === 0) return alert('الملف فارغ أو غير صالح');
        let newRecords = [];
        data.forEach((row, i) => {
          const keys = Object.keys(row);
          const getVal = (keywords) => {
            const k = keys.find(key => keywords.some(kw => key.toLowerCase().includes(kw)));
            return k ? row[k] : null;
          };

          const empName = getVal(['اسم', 'name', 'employee']);
          const dateVal = getVal(['تاريخ', 'date']);
          const inVal = getVal(['حضور', 'in', 'start']);
          const outVal = getVal(['انصراف', 'out', 'end']);

          if (empName && dateVal) {
            const emp = employees.find(e => e.name.toLowerCase() === empName.toString().toLowerCase().trim());
            if (emp) {
              const penaltyHours = calculatePenaltyHours(inVal, outVal, settings.workStart, settings.workEnd);
              newRecords.push({
                employeeId: emp.id,
                date: typeof dateVal === 'number' ? new Date((dateVal - (25567 + 1))*86400*1000).toISOString().split('T')[0] : dateVal,
                checkIn: inVal || '',
                checkOut: outVal || '',
                penaltyHours,
                extraHours: 0,
                type: 'excel',
                timestamp: Date.now() + i
              });
            }
          }
        });

        if (newRecords.length > 0) {
          // Add docs concurrently
          await Promise.all(newRecords.map(rec => addDoc(collection(db, 'attendance'), rec)));
          alert(`تم مزامنة ورفع ${newRecords.length} سجل على السحابة بنجاح.`);
        } else {
          alert("لم يتم العثور على بيانات مطابقة بموظفين سحابيين.");
        }
      } catch (err) {
        alert('حدث خطأ');
      }
    };

    return (
      <div className="animate-fade-in card">
        <div className="card-header">
          <h2 className="card-title"><FileSpreadsheet /> رفع ملف إكسل للحضور والانصراف (استيراد سحابي)</h2>
        </div>
        <label className="drop-zone">
          <Upload className="drop-zone-icon" />
          <span style={{fontSize: '1.25rem', fontWeight: '700'}}>اضغط هنا لاختيار ملف إكسل</span>
          <input type="file" accept=".xlsx, .xls" onChange={handleFile} style={{display: 'none'}} />
        </label>
      </div>
    );
  };

  const SettingsView = () => {
    const [stg, setStg] = useState(settings);

    // Keep form state in sync with external DB changes if someone else modifies
    useEffect(() => {
      setStg(settings);
    }, [settings]);

    const handleSave = async (e) => {
      e.preventDefault();
      if (settingsDocId) {
        await updateDoc(doc(db, 'settings', settingsDocId), stg);
        alert('تم حفظ الإعدادات على السحابة بنجاح.');
      }
    };

    return (
      <div className="animate-fade-in card" style={{maxWidth: '600px'}}>
        <div className="card-header">
          <h2 className="card-title"><Settings /> الإعدادات العامة للشركة (مشتركة سحابياً)</h2>
        </div>
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label>وقت بداية العمل (افتراضي)</label>
            <input type="time" value={stg.workStart} onChange={e => setStg({...stg, workStart: e.target.value})} required />
          </div>
          <div className="form-group">
            <label>وقت الانصراف (افتراضي)</label>
            <input type="time" value={stg.workEnd} onChange={e => setStg({...stg, workEnd: e.target.value})} required />
          </div>
          <div className="form-group">
            <label>ساعات العمل اليومية (لحساب خصم أيام الإجازة الكاملة)</label>
            <input type="number" value={stg.hoursPerLeaveDay} onChange={e => setStg({...stg, hoursPerLeaveDay: parseInt(e.target.value)})} required />
          </div>
          <div className="form-group">
            <label>قيمة ساعة العمل الإضافية الواحدة (ل.س)</label>
            <input type="number" value={stg.overtimeRate} onChange={e => setStg({...stg, overtimeRate: parseFloat(e.target.value)})} required />
          </div>
          <button type="submit" className="btn btn-primary" style={{marginTop: '1rem'}}>مزامنة الإعدادات</button>
        </form>
      </div>
    );
  };

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'employees': return <EmployeesView />;
      case 'attendance': return <AttendanceView />;
      case 'records': return <RecordsView />;
      case 'leaves': return <LeaveRequestsView />;
      case 'advances': return <AdvancesView />;
      case 'upload': return <UploadView />;
      case 'settings': return <SettingsView />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="app-container">
      <header className="header">
        <div className="header-title">
          <Clock size={28} /> نظام إدارة الموارد البشرية (Cloud)
        </div>
      </header>

      <main className="main-content">
        <div className="tabs" style={{overflowX: 'auto', paddingBottom: '0.5rem'}}>
          {navItems.map(tab => {
            const Icon = tab.icon;
            return (
              <div 
                key={tab.id}
                className={`tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
                style={{whiteSpace: 'nowrap'}}
              >
                <Icon size={18} /> {tab.label}
              </div>
            );
          })}
        </div>
        
        {renderActiveView()}
      </main>
    </div>
  );
}
