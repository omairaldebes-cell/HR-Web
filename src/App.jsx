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
  FileSpreadsheet,
  Settings,
  Trash2,
  CalendarCheck,
  Banknote,
  FileText,
  Edit,
  Lock,
  LogOut,
  UserCog,
  Menu,
  Printer
} from 'lucide-react';

const ARABIC_MONTHS = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];

const MonthPicker = ({ value, onChange }) => {
  const [year, month] = value.split('-');
  return (
    <div style={{display:'flex', gap:'0.5rem', alignItems:'center'}}>
      <select value={month} onChange={e => onChange(`${year}-${e.target.value}`)} className="btn-outline btn" style={{padding: '0.4rem 1rem'}}>
        {ARABIC_MONTHS.map((m, i) => <option key={i} value={String(i+1).padStart(2,'0')}>{m}</option>)}
      </select>
      <input type="number" value={year} onChange={e => onChange(`${e.target.value}-${month}`)} className="btn-outline btn" style={{padding: '0.4rem', width:'80px'}} />
    </div>
  );
};

const DEFAULT_SETTINGS = {
  workStart: '09:00',
  workEnd: '15:00',
  hoursPerLeaveDay: 6,
  overtimeRate: 0,
  themeMode: 'dark'
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
  { id: 'users', label: 'إدارة المستخدمين', icon: UserCog },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Auth State
  const [loggedInUser, setLoggedInUser] = useState(() => {
    const saved = localStorage.getItem('hr_logged_in_user');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });

  // App State (from Firebase)
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [advances, setAdvances] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [settingsDocId, setSettingsDocId] = useState(null);
  const [appUsers, setAppUsers] = useState([]);

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
    const unsubUsers = onSnapshot(collection(db, 'app_users'), (snapshot) => {
      const usersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAppUsers(usersList);
      
      // Auto-create default admin if collection is completely empty
      if (usersList.length === 0) {
        addDoc(collection(db, 'app_users'), {
          username: 'faez',
          password: 'faez@123',
          role: 'admin',
          permissions: navItems.map(item => item.id) // all permissions
        });
      }
    });

    const unsubSet = onSnapshot(collection(db, 'settings'), (snapshot) => {
      if (!snapshot.empty) {
        setSettingsDocId(snapshot.docs[0].id);
        const data = snapshot.docs[0].data();
        setSettings({ ...DEFAULT_SETTINGS, ...data });
      } else {
        addDoc(collection(db, 'settings'), DEFAULT_SETTINGS).then(ref => {
          setSettingsDocId(ref.id);
        });
      }
    });

    return () => {
      unsubEmp(); unsubAtt(); unsubAdv(); unsubSet(); unsubUsers();
    };
  }, []);

  // Apply theme mode
  useEffect(() => {
    document.body.className = settings.themeMode || 'dark';
  }, [settings.themeMode]);

  // Update localStorage when logged in user changes
  useEffect(() => {
    if (loggedInUser) {
      localStorage.setItem('hr_logged_in_user', JSON.stringify(loggedInUser));
    } else {
      localStorage.removeItem('hr_logged_in_user');
    }
  }, [loggedInUser]);

  const handleLogin = (e) => {
    e.preventDefault();
    const user = appUsers.find(u => u.username === loginForm.username && u.password === loginForm.password);
    if (user) {
      setLoggedInUser(user);
      
      // Redirect to the first available tab for this user if they don't have dashboard
      if (user.permissions && !user.permissions.includes('dashboard')) {
        setActiveTab(user.permissions[0]);
      } else {
        setActiveTab('dashboard');
      }
    } else {
      alert('خطأ في اسم المستخدم أو كلمة المرور');
    }
  };

  const handleLogout = () => {
    setLoggedInUser(null);
    setLoginForm({ username: '', password: '' });
  };

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

  // LOGIN VIEW
  if (!loggedInUser) {
    return (
      <div style={{display:'flex', justifyContent:'center', alignItems:'center', height:'100vh', background:'var(--bg-color)'}}>
        <div className="card animate-fade-in" style={{maxWidth: '400px', width: '100%', textAlign: 'center'}}>
          <Lock size={48} style={{margin:'0 auto 1rem', color:'var(--primary)'}} />
          <h2 className="card-title" style={{marginBottom: '2rem'}}>تسجيل الدخول للنظام</h2>
          
          <form onSubmit={handleLogin} style={{textAlign: 'right'}}>
            <div className="form-group">
              <label>اسم المستخدم</label>
              <input 
                type="text" 
                value={loginForm.username} 
                onChange={e => setLoginForm({...loginForm, username: e.target.value})} 
                required 
              />
            </div>
            <div className="form-group" style={{marginBottom: '2rem'}}>
              <label>كلمة المرور</label>
              <input 
                type="password" 
                value={loginForm.password} 
                onChange={e => setLoginForm({...loginForm, password: e.target.value})} 
                required 
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{width: '100%'}}>دخول</button>
          </form>
        </div>
      </div>
    );
  }

  // --- REGULAR VIEWS ---

  const Dashboard = () => (
    <div className="animate-fade-in">
      <div className="card-header no-print">
        <h2 className="card-title"><LayoutDashboard /> لوحة القيادة</h2>
        <div>
          <MonthPicker value={viewMonth} onChange={setViewMonth} />
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
                <tr><td colSpan="8" style={{textAlign: 'center', color: 'var(--text-secondary)'}}>لا يوجد بيانات</td></tr>
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
    const [workDays, setWorkDays] = useState([0, 1, 2, 3, 4]);
    const [editId, setEditId] = useState(null);

    const handleAdd = async (e) => {
      e.preventDefault();
      if (!name.trim() || !salary.trim()) return;
      
      const data = { name: name.trim(), salary: salary, totalLeaves: parseFloat(leaves), workDays };

      if (editId) {
        await updateDoc(doc(db, 'employees', editId), data);
        setEditId(null);
      } else {
        await addDoc(collection(db, 'employees'), data);
      }
      setName(''); setSalary(''); setLeaves(12); setWorkDays([0, 1, 2, 3, 4]);
    };

    const handleEdit = (emp) => {
      setEditId(emp.id); setName(emp.name); setSalary(emp.salary); setLeaves(emp.totalLeaves); setWorkDays(emp.workDays || [0, 1, 2, 3, 4]);
    };

    const handleDelete = async (id) => {
      if(window.confirm('هل أنت متأكد من حذف هذا الموظف؟')) await deleteDoc(doc(db, 'employees', id));
    };

    const toggleDay = (i) => workDays.includes(i) ? setWorkDays(workDays.filter(d=>d!==i)) : setWorkDays([...workDays, i].sort());
    const daysOfWeek = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];

    return (
      <div className="animate-fade-in grid-cols-2" style={{display: 'flex', flexDirection: 'column', gap: '2rem'}}>
        <div className="card">
          <div className="card-header">
            <h2 className="card-title"><PlusCircle /> {editId ? 'تحديث موظف' : 'إضافة موظف جديد'}</h2>
          </div>
          <form onSubmit={handleAdd}>
            <div className="grid-cols-2" style={{marginBottom: '1rem'}}>
              <div className="form-group"><label>اسم الموظف</label><input type="text" value={name} onChange={e=>setName(e.target.value)} required /></div>
              <div className="form-group"><label>الراتب الشهري (ل.س)</label><input type="number" value={salary} onChange={e=>setSalary(e.target.value)} required /></div>
              <div className="form-group"><label>رصيد الإجازات السنوي (أيام)</label><input type="number" step="0.5" value={leaves} onChange={e=>setLeaves(e.target.value)} required /></div>
            </div>
            
            <div className="form-group">
              <label>أيام العمل الافتراضية</label>
              <div style={{display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.5rem'}}>
                {daysOfWeek.map((day, i) => (
                  <label key={i} style={{cursor: 'pointer'}}><input type="checkbox" checked={workDays.includes(i)} onChange={()=>toggleDay(i)} style={{width: 'auto', marginLeft:'5px'}} />{day}</label>
                ))}
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{marginTop: '1rem'}}>{editId ? 'حفظ التحديث' : 'إضافة'}</button>
          </form>
        </div>

        <div className="card">
          <h2 className="card-title" style={{marginBottom: '1rem'}}><Users /> قائمة الموظفين</h2>
          <div className="table-container">
            <table>
              <thead><tr><th>الاسم</th><th>الراتب (ل.س)</th><th>رصيد الإجازة</th><th>إجراءات</th></tr></thead>
              <tbody>
                {employees.map(emp => (
                  <tr key={emp.id}>
                    <td style={{fontWeight: '700'}}>{emp.name}</td><td>{parseFloat(emp.salary).toLocaleString()}</td><td>{emp.totalLeaves}</td>
                    <td>
                      <button onClick={()=>handleEdit(emp)} className="btn btn-secondary" style={{padding:'0.4rem 0.8rem', marginLeft:'0.5rem'}}><Edit size={16} /> تعديل</button>
                      <button onClick={()=>handleDelete(emp.id)} className="btn btn-danger" style={{padding:'0.4rem 0.8rem'}}><Trash2 size={16} /> حذف</button>
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
    const [empId, setEmpId] = useState(''); const [date, setDate] = useState('');
    const [checkIn, setCheckIn] = useState(settings.workStart || '09:00'); const [checkOut, setCheckOut] = useState('');
    const [extraHours, setExtraHours] = useState(0);

    const handleAdd = async (e) => {
      e.preventDefault();
      if (!empId || !date) return;
      const actualCheckOut = checkOut || settings.workEnd;
      const penaltyHours = calculatePenaltyHours(checkIn, actualCheckOut, settings.workStart, settings.workEnd);
      await addDoc(collection(db, 'attendance'), { employeeId: empId, date, checkIn, checkOut: actualCheckOut, penaltyHours, extraHours: parseFloat(extraHours) || 0, type: 'manual', timestamp: Date.now() });
      alert(`تم بنجاح. التأخير: ${penaltyHours} ساعة.`);
      setDate(''); setCheckIn(settings.workStart || '09:00'); setCheckOut(''); setEmpId(''); setExtraHours(0);
    };

    return (
      <div className="animate-fade-in card">
        <h2 className="card-title" style={{marginBottom: '1.5rem'}}><Clock /> إضافة سجل حضور وعمل إضافي</h2>
        <form onSubmit={handleAdd}>
          <div className="stats-grid">
            <div className="form-group">
              <label>الموظف</label>
              <select value={empId} onChange={e=>setEmpId(e.target.value)} required><option value="">-- اختر --</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
            </div>
            <div className="form-group"><label>التاريخ</label><input type="date" value={date} onChange={e=>setDate(e.target.value)} required /></div>
            <div className="form-group"><label>الحضور الفعلي</label><input type="time" value={checkIn} onChange={e=>setCheckIn(e.target.value)} /></div>
            <div className="form-group"><label>الانصراف الفعلي</label><input type="time" value={checkOut} onChange={e=>setCheckOut(e.target.value)} /></div>
            <div className="form-group"><label>عمل إضافي (ساعات)</label><input type="number" step="0.5" value={extraHours} onChange={e=>setExtraHours(e.target.value)} /></div>
          </div>
          <button type="submit" className="btn btn-primary" style={{marginTop: '1rem'}}>حفظ السجل</button>
        </form>
      </div>
    );
  };

  const RecordsView = () => {
    const [filterEmp, setFilterEmp] = useState(''); 
    const [filterDateStart, setFilterDateStart] = useState('');
    const [filterDateEnd, setFilterDateEnd] = useState('');
    const [editId, setEditId] = useState(null); const [editData, setEditData] = useState({ checkIn: '', checkOut: '', extraHours: 0 });

    const handleEdit = async (rec) => {
      if (editId === rec.id) {
        const penaltyHours = calculatePenaltyHours(editData.checkIn, editData.checkOut, settings.workStart, settings.workEnd);
        await updateDoc(doc(db, 'attendance', rec.id), { checkIn: editData.checkIn, checkOut: editData.checkOut, extraHours: parseFloat(editData.extraHours) || 0, penaltyHours });
        setEditId(null);
      } else {
        setEditId(rec.id); setEditData({ checkIn: rec.checkIn||'', checkOut: rec.checkOut||'', extraHours: rec.extraHours||0 });
      }
    };

    const handleDelete = async(id) => window.confirm('متأكد من عملية الحذف؟') && await deleteDoc(doc(db, 'attendance', id));

    const filtered = attendance.slice().sort((a,b) => (b.timestamp||0)-(a.timestamp||0)).filter(rec => {
        const passEmp = filterEmp ? rec.employeeId === filterEmp : true;
        const passStart = filterDateStart ? rec.date >= filterDateStart : true;
        const passEnd = filterDateEnd ? rec.date <= filterDateEnd : true;
        return passEmp && passStart && passEnd;
      });

    const isSingleEmployee = filterEmp !== '';
    const selectedEmp = isSingleEmployee ? employees.find(e => e.id === filterEmp) : null;
    
    let summary = null;
    if (selectedEmp) {
      const allRecords = attendance.filter(a => a.employeeId === selectedEmp.id);
      const totalAllPenaltyHours = allRecords.reduce((sum, r) => sum + (r.penaltyHours || 0), 0);
      const hoursPerLeaveDay = settings.hoursPerLeaveDay || 6;
      const consumedLeavesAllTime = (totalAllPenaltyHours / hoursPerLeaveDay).toFixed(2);
      const remainingLeaves = (selectedEmp.totalLeaves - consumedLeavesAllTime).toFixed(2);

      const rangeExtraHours = filtered.reduce((sum, r) => sum + (parseFloat(r.extraHours) || 0), 0);
      const rangePenaltyHours = filtered.reduce((sum, r) => sum + (parseFloat(r.penaltyHours) || 0), 0);
      const rangeOtValue = rangeExtraHours * (parseFloat(settings.overtimeRate) || 0);
      const rangeConsumedLeaves = (rangePenaltyHours / hoursPerLeaveDay).toFixed(2);

      const rangeAdvancesList = advances.filter(ad => {
         if (ad.employeeId !== selectedEmp.id) return false;
         const adDate = ad.date || `${ad.month}-01`;
         const passStart = filterDateStart ? adDate >= filterDateStart : true;
         const passEnd = filterDateEnd ? adDate <= filterDateEnd : true;
         return passStart && passEnd;
      });

      const totalRangeAdvances = rangeAdvancesList.reduce((sum, ad) => sum + (parseFloat(ad.amount) || 0), 0);
      const baseSalary = parseFloat(selectedEmp.salary) || 0;
      const netSalary = baseSalary + rangeOtValue - totalRangeAdvances;

      summary = {
        name: selectedEmp.name,
        baseSalary,
        rangeExtraHours,
        rangeOtValue,
        totalRangeAdvances,
        netSalary,
        remainingLeaves,
        rangeConsumedLeaves,
        rangePenaltyHours
      };
    }

    return (
      <div className="animate-fade-in card print-card">
        <div className="card-header no-print">
          <h2 className="card-title"><FileText /> سجل الحضور الكامل</h2>
          <button onClick={() => window.print()} className="btn btn-outline" style={{display:'flex', alignItems:'center', gap:'0.5rem'}}><Printer size={18}/> طباعة</button>
        </div>
        <div className="stats-grid no-print" style={{marginBottom: '1rem', backgroundColor: 'var(--bg-color)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)'}}>
          <div className="form-group" style={{marginBottom: 0}}>
            <label>الموظف</label>
            <select value={filterEmp} onChange={e=>setFilterEmp(e.target.value)}>
              <option value="">الكل</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div className="form-group" style={{marginBottom: 0}}><label>من تاريخ</label><input type="date" value={filterDateStart} onChange={e=>setFilterDateStart(e.target.value)} /></div>
          <div className="form-group" style={{marginBottom: 0}}><label>إلى تاريخ</label><input type="date" value={filterDateEnd} onChange={e=>setFilterDateEnd(e.target.value)} /></div>
        </div>
        
        {summary && (
          <div className="print-summary" style={{marginBottom: '1.5rem', padding: '1.5rem', border: '2px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)'}}>
            <h3 style={{marginBottom: '1rem', color: 'var(--primary)', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem'}}>
              تقرير الموظف: {summary.name} 
              {filterDateStart && filterDateEnd ? ` (من ${filterDateStart} إلى ${filterDateEnd})` : ''}
            </h3>
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', fontWeight: 'bold'}}>
               <div>الراتب الأساسي:<br/><span style={{color: 'var(--text-secondary)', fontSize:'1.2rem'}}>{summary.baseSalary.toLocaleString()} ل.س</span></div>
               <div>ساعات العمل الإضافي:<br/><span style={{color: 'var(--success)', fontSize:'1.2rem'}}>{summary.rangeExtraHours} ساعة ({summary.rangeOtValue.toLocaleString()} ل.س)</span></div>
               <div>ساعات التأخير (للفترة):<br/><span style={{color: 'var(--danger)', fontSize:'1.2rem'}}>{summary.rangePenaltyHours} ساعة (~ {summary.rangeConsumedLeaves} يوم إجازة)</span></div>
               <div>السلف (للفترة):<br/><span style={{color: 'var(--warning)', fontSize:'1.2rem'}}>{summary.totalRangeAdvances.toLocaleString()} ل.س</span></div>
               <div>رصيد الإجازات المتبقي (الكلي):<br/><span style={{color: summary.remainingLeaves < 3 ? 'var(--danger)' : 'var(--primary)', fontSize:'1.2rem'}}>{summary.remainingLeaves} يوم</span></div>
               <div style={{borderRight: '4px solid var(--primary)', paddingRight: '0.5rem', color: 'var(--primary)'}}>
                 صافي الراتب المستحق:<br/>
                 <span style={{fontSize:'1.5rem', color: 'var(--primary)'}}>{summary.netSalary.toLocaleString()} ل.س</span>
               </div>
            </div>
          </div>
        )}

        <div className="table-container">
          <table>
            <thead><tr><th>الموظف</th><th>التاريخ</th><th>النوع</th><th>الحضور</th><th>الانصراف</th><th>إضافي</th><th>تأخير</th><th>إجراءات</th></tr></thead>
            <tbody>
              {filtered.map(rec => {
                const emp = employees.find(e => e.id === rec.employeeId);
                const isEditing = editId === rec.id;
                return (
                  <tr key={rec.id}>
                    <td style={{fontWeight:'700'}}>{emp?.name || 'محذوف'}</td><td>{rec.date}</td><td>{rec.type==='leave'?'إجازة':rec.type==='excel'?'إكسل':'يدوي'}</td>
                    {isEditing ? (
                      <>
                        <td><input type="time" value={editData.checkIn} onChange={e=>setEditData({...editData,checkIn:e.target.value})} style={{padding:'0.2rem',width:'auto'}} /></td>
                        <td><input type="time" value={editData.checkOut} onChange={e=>setEditData({...editData,checkOut:e.target.value})} style={{padding:'0.2rem',width:'auto'}} /></td>
                        <td><input type="number" step="0.5" value={editData.extraHours} onChange={e=>setEditData({...editData,extraHours:e.target.value})} style={{padding:'0.2rem',width:'60px'}} /></td>
                        <td>سيتم الحساب</td>
                      </>
                    ) : (
                      <>
                        <td>{rec.checkIn || (rec.type==='leave'?'-':'غير مسجل')}</td><td>{rec.checkOut || (rec.type==='leave'?'-':'غير مسجل')}</td><td>{rec.extraHours||0}</td><td style={{color: rec.penaltyHours > 0 ? 'var(--danger)' : 'inherit'}}>{rec.penaltyHours} ساعة</td>
                      </>
                    )}
                    <td>
                      {rec.type !== 'leave' && <button onClick={()=>handleEdit(rec)} className={`btn ${isEditing?'btn-success':'btn-secondary'}`} style={{padding:'0.3rem 0.6rem',marginLeft:'0.5rem',background:isEditing?'var(--success)':''}}>{isEditing?'حفظ':'تعديل'}</button>}
                      <button onClick={()=>handleDelete(rec.id)} className="btn btn-danger" style={{padding:'0.3rem 0.6rem'}}><Trash2 size={16} /></button>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && <tr><td colSpan="8" style={{textAlign:'center'}}>لا يوجد سجلات</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const LeaveRequestsView = () => {
    const [empId, setEmpId] = useState(''); const [date, setDate] = useState('');
    const handleAdd = async (e) => {
      e.preventDefault(); if (!empId || !date) return;
      await addDoc(collection(db, 'attendance'), { employeeId: empId, date, checkIn: '', checkOut: '', penaltyHours: settings.hoursPerLeaveDay, extraHours: 0, type: 'leave', timestamp: Date.now() });
      alert(`تم خصم وتنزيل الإجازة بنجاح.`); setDate(''); setEmpId('');
    };

    return (
      <div className="animate-fade-in card">
        <h2 className="card-title" style={{marginBottom:'1.5rem'}}><CalendarCheck /> إضافة يوم إجازة (يخصم من الرصيد والغيابات)</h2>
        <form onSubmit={handleAdd} className="flex-row" style={{alignItems:'flex-end'}}>
          <div className="form-group" style={{flex:1,marginBottom:0}}>
            <label>الموظف</label><select value={empId} onChange={e=>setEmpId(e.target.value)} required><option value="">-- اختر --</option>{employees.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select>
          </div>
          <div className="form-group" style={{flex:1,marginBottom:0}}><label>التاريخ</label><input type="date" value={date} onChange={e=>setDate(e.target.value)} required /></div>
          <button type="submit" className="btn btn-primary">حفظ الإجازة</button>
        </form>
      </div>
    );
  };

  const AdvancesView = () => {
    const [empId, setEmpId] = useState(''); 
    const [month, setMonth] = useState(() => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; });
    const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [amount, setAmount] = useState('');

    const handleAdd = async (e) => {
      e.preventDefault(); if (!empId || !month || !amount || !date) return;
      await addDoc(collection(db, 'advances'), { employeeId: empId, date, month, amount: parseFloat(amount), timestamp: Date.now() });
      alert('تم التسجيل بنجاح.'); setEmpId(''); setAmount('');
    };

    const handleDelete = async (id) => window.confirm('متأكد؟') && await deleteDoc(doc(db, 'advances', id));

    return (
      <div className="animate-fade-in grid-cols-2" style={{display:'flex', flexDirection:'column', gap:'2rem'}}>
        <div className="card">
          <h2 className="card-title" style={{marginBottom:'1.5rem'}}><Banknote /> سلفة نقدية</h2>
          <form onSubmit={handleAdd}>
            <div className="stats-grid">
              <div className="form-group"><label>الموظف</label><select value={empId} onChange={e=>setEmpId(e.target.value)} required><option value="">-- اختر --</option>{employees.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></div>
              <div className="form-group"><label>تاريخ الطلب</label><input type="date" value={date} onChange={e=>setDate(e.target.value)} required /></div>
              <div className="form-group"><label>تخصم من شهر</label><MonthPicker value={month} onChange={setMonth} /></div>
              <div className="form-group"><label>المبلغ (ل.س)</label><input type="number" value={amount} onChange={e=>setAmount(e.target.value)} required /></div>
            </div>
            <button type="submit" className="btn btn-primary" style={{marginTop:'1rem'}}>صرف</button>
          </form>
        </div>
        
        <div className="card">
          <h2 className="card-title" style={{marginBottom:'1rem'}}>السلف السابقة</h2>
          <div className="table-container">
            <table>
              <thead><tr><th>الموظف</th><th>تاريخ الطلب</th><th>لشهر</th><th>المبلغ</th><th>حذف</th></tr></thead>
              <tbody>
                {advances.slice().sort((a,b)=>(b.timestamp||0)-(a.timestamp||0)).map(adv => (
                  <tr key={adv.id}><td>{employees.find(e=>e.id===adv.employeeId)?.name}</td><td>{adv.date || '-'}</td><td>{adv.month}</td><td>{adv.amount.toLocaleString()}</td><td><button onClick={()=>handleDelete(adv.id)} className="btn btn-danger" style={{padding:'0.3rem'}}><Trash2 size={16}/></button></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const UploadView = () => {
    const [previewRecords, setPreviewRecords] = useState(null);
    const [isUploading, setIsUploading] = useState(false);

    const handleFile = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      try {
        const rawSheets = await parseExcel(file);
        if (!rawSheets || Object.keys(rawSheets).length === 0) return alert('الملف فارغ أو غير صالح');
        let newRecords = [];
        
        Object.keys(rawSheets).forEach((sheetName, sIndex) => {
          const rows = rawSheets[sheetName];
          let matchedEmp = employees.find(e => e.name.toLowerCase().trim() === sheetName.toLowerCase().trim());

          rows.forEach((row, i) => {
            const keys = Object.keys(row);
            const getVal = (keywords) => { const k = keys.find(key=>keywords.some(kw=>key.toLowerCase().includes(kw))); return k ? row[k] : null; };
            const rowEmpName = getVal(['اسم', 'name', 'employee']);
            
            let finalEmp = matchedEmp;
            if (rowEmpName) {
               finalEmp = employees.find(e => e.name.toLowerCase().trim() === rowEmpName.toString().toLowerCase().trim()) || finalEmp;
            }

            const dateVal = getVal(['تاريخ', 'date', 'يوم']);
            let inVal = getVal(['حضور', 'in', 'start']); 
            let outVal = getVal(['انصراف', 'out', 'end']);
            
            const formatExcelTime = (val) => {
              if (typeof val === 'number') {
                const totalSeconds = Math.round(val * 86400);
                const hrs = Math.floor(totalSeconds / 3600);
                const mins = Math.floor((totalSeconds % 3600) / 60);
                return `${String(hrs).padStart(2,'0')}:${String(mins).padStart(2,'0')}`;
              }
              return val ? String(val) : '';
            };

            inVal = formatExcelTime(inVal);
            outVal = formatExcelTime(outVal);

            if (finalEmp && dateVal) {
               const parsedDate = typeof dateVal === 'number' 
                 ? new Date((dateVal - (25567 + 1)) * 86400 * 1000).toISOString().split('T')[0]
                 : String(dateVal);
                 
               const actualOutVal = outVal || settings.workEnd;
               const penaltyHours = calculatePenaltyHours(inVal, actualOutVal, settings.workStart, settings.workEnd);
               
               newRecords.push({
                 id: Date.now() + '-' + i + '-' + sIndex,
                 employeeId: finalEmp.id,
                 empName: finalEmp.name,
                 date: parsedDate,
                 checkIn: inVal,
                 checkOut: outVal,
                 actualCheckOut: actualOutVal,
                 penaltyHours,
                 extraHours: 0,
                 type: 'excel'
               });
            }
          });
        });

        if (newRecords.length > 0) {
          setPreviewRecords(newRecords);
        } else {
          alert('لم يتم العثور على بيانات مطابقة. تأكد من أن أسماء أوراق العمل أو عمود "الاسم" يطابق أسماء الموظفين.');
        }
      } catch (err) { alert('حدث خطأ في قراءة الملف.'); }
      e.target.value = '';
    };

    const updatePreviewRecord = (id, field, value) => {
      setPreviewRecords(prev => prev.map(rec => {
        if (rec.id === id) {
          const updated = { ...rec, [field]: value };
          if (field === 'checkIn' || field === 'checkOut') {
            const actualOutVal = updated.checkOut || settings.workEnd;
            updated.actualCheckOut = actualOutVal;
            updated.penaltyHours = calculatePenaltyHours(updated.checkIn, actualOutVal, settings.workStart, settings.workEnd);
          }
          return updated;
        }
        return rec;
      }));
    };

    const confirmUpload = async () => {
      if(!previewRecords || previewRecords.length === 0) return;
      setIsUploading(true);
      try {
        await Promise.all(previewRecords.map(rec => {
          const { id, empName, actualCheckOut, ...dbData } = rec;
          dbData.checkOut = actualCheckOut;
          dbData.timestamp = Date.now();
          return addDoc(collection(db, 'attendance'), dbData);
        }));
        alert(`تم اعتماد ${previewRecords.length} سجل بنجاح.`);
        setPreviewRecords(null);
      } catch(e) { alert('حدث خطأ في الرفع.'); }
      setIsUploading(false);
    };

    return (
      <div className="animate-fade-in card">
        <div className="card-header"><h2 className="card-title"><FileSpreadsheet /> رفع ملف إكسل</h2></div>
        
        {!previewRecords ? (
          <label className="drop-zone">
            <Upload className="drop-zone-icon" />
            <span style={{fontSize:'1.25rem', fontWeight:'700'}}>اختر ملف للإكسل (معلومة: يمكن استخدام ورقة لكل موظف يحمل اسمه)</span>
            <input type="file" accept=".xlsx, .xls" onChange={handleFile} style={{display:'none'}} />
          </label>
        ) : (
          <div className="preview-container">
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem'}}>
              <h3>مراجعة البيانات المستخرجة ({previewRecords.length} سجل)</h3>
              <div style={{display:'flex', gap:'0.5rem'}}>
                <button className="btn btn-secondary" onClick={() => setPreviewRecords(null)}>إلغاء</button>
                <button className="btn btn-primary" onClick={confirmUpload} disabled={isUploading}>{isUploading ? 'جاري الرفع...' : 'حفظ واعتماد'}</button>
              </div>
            </div>
            
            <div className="table-container" style={{maxHeight:'60vh', overflowY:'auto'}}>
              <table>
                <thead style={{position:'sticky', top:0, zIndex:2, backgroundColor:'var(--surface)'}}>
                  <tr><th>الموظف</th><th>التاريخ</th><th>الحضور</th><th>الانصراف</th><th>تأخير (ساعات)</th><th>ملاحظة</th></tr>
                </thead>
                <tbody>
                  {previewRecords.map(rec => (
                    <tr key={rec.id}>
                      <td style={{fontWeight:'bold'}}>{rec.empName}</td>
                      <td><input type="date" value={rec.date} onChange={(e)=>updatePreviewRecord(rec.id, 'date', e.target.value)} style={{width:'auto'}}/></td>
                      <td><input type="time" value={rec.checkIn} onChange={(e)=>updatePreviewRecord(rec.id, 'checkIn', e.target.value)} style={{width:'auto'}}/></td>
                      <td><input type="time" value={rec.checkOut} onChange={(e)=>updatePreviewRecord(rec.id, 'checkOut', e.target.value)} style={{width:'auto'}}/></td>
                      <td style={{color: rec.penaltyHours > 0 ? 'var(--danger)' : ''}}>{rec.penaltyHours}</td>
                      <td style={{color:'var(--text-secondary)', fontSize:'0.8rem'}}>{!rec.checkOut ? `يفترض الساعة ${settings.workEnd}` : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  const SettingsView = () => {
    const [stg, setStg] = useState(settings);
    useEffect(() => { setStg(settings); }, [settings]);
    const handleSave = async (e) => {
      e.preventDefault();
      if (settingsDocId) { await updateDoc(doc(db, 'settings', settingsDocId), stg); alert('تم حفظ الإعدادات سحابياً بنجاح.'); }
    };
    return (
      <div className="animate-fade-in card" style={{maxWidth:'600px'}}>
        <div className="card-header"><h2 className="card-title"><Settings /> الإعدادات العامة</h2></div>
        <form onSubmit={handleSave}>
          <div className="form-group"><label>وقت بداية العمل</label><input type="time" value={stg.workStart} onChange={e=>setStg({...stg, workStart:e.target.value})} required /></div>
          <div className="form-group"><label>وقت الانصراف</label><input type="time" value={stg.workEnd} onChange={e=>setStg({...stg, workEnd:e.target.value})} required /></div>
          <div className="form-group"><label>ساعات العمل اليومية (تعادل يوم إجازة كامل)</label><input type="number" value={stg.hoursPerLeaveDay} onChange={e=>setStg({...stg, hoursPerLeaveDay:parseInt(e.target.value)})} required /></div>
          <div className="form-group"><label>قيمة ساعة العمل الإضافية الواحدة (ل.س)</label><input type="number" value={stg.overtimeRate} onChange={e=>setStg({...stg, overtimeRate:parseFloat(e.target.value)})} required /></div>
          <div className="form-group">
            <label>المظهر (Theme)</label>
            <select value={stg.themeMode || 'dark'} onChange={e=>setStg({...stg, themeMode: e.target.value})}>
              <option value="light">فاتح (Light)</option>
              <option value="dark">داكن (Dark)</option>
              <option value="colorful">ملون (Colorful)</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary" style={{marginTop:'1rem'}}>حفظ الإعدادات</button>
        </form>
      </div>
    );
  };

  // NEW: User Management View
  const UsersView = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [selectedPermissions, setSelectedPermissions] = useState(navItems.map(i => i.id));
    const [editId, setEditId] = useState(null);

    const handleAdd = async (e) => {
      e.preventDefault();
      if (!username.trim() || !password.trim()) return;

      const data = {
        username: username.trim(),
        password: password.trim(),
        permissions: selectedPermissions,
        role: 'user'
      };

      if (editId) {
        await updateDoc(doc(db, 'app_users', editId), data);
        setEditId(null);
      } else {
        await addDoc(collection(db, 'app_users'), data);
      }
      setUsername(''); setPassword(''); setSelectedPermissions(navItems.map(i => i.id));
    };

    const handleEdit = (u) => {
      setEditId(u.id);
      setUsername(u.username);
      setPassword(u.password);
      setSelectedPermissions(u.permissions || []);
    };

    const handleDelete = async (id, role, uname) => {
      if (role === 'admin' && uname === 'faez') return alert("لا يمكنك حذف حساب المدير الافتراضي!");
      if(window.confirm('متاكد؟')) {
        await deleteDoc(doc(db, 'app_users', id));
      }
    };

    const togglePermission = (id) => {
      if (selectedPermissions.includes(id)) {
        setSelectedPermissions(selectedPermissions.filter(p => p !== id));
      } else {
        setSelectedPermissions([...selectedPermissions, id]);
      }
    };

    return (
      <div className="animate-fade-in grid-cols-2" style={{display: 'flex', flexDirection: 'column', gap: '2rem'}}>
        <div className="card">
          <div className="card-header">
            <h2 className="card-title"><UserCog /> {editId ? 'تعديل مستخدم' : 'إضافة مستخدم للوحة التحكم'}</h2>
          </div>
          <form onSubmit={handleAdd}>
            <div className="grid-cols-2" style={{marginBottom: '1rem'}}>
              <div className="form-group"><label>اسم المستخدم</label><input type="text" value={username} onChange={e=>setUsername(e.target.value)} required /></div>
              <div className="form-group"><label>كلمة المرور</label><input type="text" value={password} onChange={e=>setPassword(e.target.value)} required /></div>
            </div>
            <div className="form-group">
              <label>صلاحيات الوصول للقوائم (اختر المسموح له)</label>
              <div style={{display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.5rem', background:'var(--bg-color)', padding:'1rem', borderRadius:'var(--radius-md)'}}>
                {navItems.map((item) => (
                  <label key={item.id} style={{display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', background:'var(--card-bg)', padding:'0.5rem', borderRadius:'4px', border:'1px solid var(--border)'}}>
                    <input type="checkbox" checked={selectedPermissions.includes(item.id)} onChange={() => togglePermission(item.id)} style={{width: 'auto'}} />
                    <span><item.icon size={14} style={{verticalAlign:'middle'}}/> {item.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <button type="submit" className="btn btn-primary" style={{marginTop: '1rem'}}>{editId ? 'حفظ' : 'إضافة مستخدم'}</button>
          </form>
        </div>

        <div className="card">
          <h2 className="card-title" style={{marginBottom: '1rem'}}>المستخدمين الحاليين</h2>
          <div className="table-container">
            <table>
              <thead><tr><th>الاسم</th><th>الرقم السري</th><th>الصلاحيات</th><th>إجراءات</th></tr></thead>
              <tbody>
                {appUsers.map(u => (
                  <tr key={u.id}>
                    <td style={{fontWeight: 'bold', color: u.role === 'admin' ? 'var(--primary)': ''}}>{u.username} {u.role==='admin'?'(مدير)':''}</td>
                    <td>{u.password}</td>
                    <td>{u.permissions?.length === navItems.length ? 'الكل' : (u.permissions?.length || 0) + ' نوافذ'}</td>
                    <td>
                      <button onClick={()=>handleEdit(u)} className="btn btn-secondary" style={{padding:'0.4rem 0.8rem', marginLeft:'0.5rem'}}>تعديل</button>
                      <button onClick={()=>handleDelete(u.id, u.role, u.username)} disabled={u.role === 'admin' && u.username === 'faez'} className="btn btn-danger" style={{padding:'0.4rem 0.8rem', opacity: u.role === 'admin' && u.username === 'faez' ? 0.5 : 1}}>حذف</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

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
      case 'users': return <UsersView />;
      default: return null;
    }
  };

  // Filter nav items based on permissions
  const allowedNavItems = navItems.filter(item => 
    loggedInUser?.permissions?.includes(item.id) || (loggedInUser?.role === 'admin' && item.id === 'users') // Ensure admins always see users implicitly if checked, but users list covers it.
  );

  return (
    <div className="app-container">
      {/* SIDEBAR */}
      <aside 
        className={`sidebar ${isSidebarOpen ? 'expanded' : ''}`}
        onMouseEnter={() => setIsSidebarOpen(true)}
        onMouseLeave={() => setIsSidebarOpen(false)}
      >
        <div className="sidebar-header">
           <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="sidebar-toggle">
              <Menu size={24} />
           </button>
           <span className="sidebar-title">تطبيق HR</span>
        </div>
        
        <nav className="sidebar-nav">
          {allowedNavItems.map(tab => {
            const Icon = tab.icon;
            return (
              <div 
                key={tab.id}
                className={`sidebar-nav-item ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={24} /> 
                <span className="sidebar-label">{tab.label}</span>
              </div>
            );
          })}
        </nav>
        
        <div className="sidebar-footer">
          <div className="sidebar-user" title={loggedInUser.username}>
            <UserCog size={24} />
            <span className="sidebar-label">{loggedInUser.username} {loggedInUser.role === 'admin' ? '(مدير)' : ''}</span>
          </div>
          <button onClick={handleLogout} className="sidebar-nav-item logout-btn">
            <LogOut size={24} /> 
            <span className="sidebar-label">تسجيل خروج</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="main-wrapper">
        <header className="top-header">
          <div className="header-title">
             نظام إدارة الموارد البشرية (النسخة السحابية)
          </div>
        </header>

        <main className="main-content">
          {renderActiveView()}
        </main>
      </div>
    </div>
  );
}
