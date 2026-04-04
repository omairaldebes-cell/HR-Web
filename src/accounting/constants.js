// ==========================================
// دفتر اليومية الذكي — Constants & Enums
// ==========================================

export const TRANSACTION_TYPES = {
  RECEIPT: 'قبض',
  PAYMENT: 'صرف',
  TRANSFER: 'تحويل',
  OPENING_BALANCE: 'رصيد افتتاحي',
  ADJUSTMENT: 'تسوية',
  DONATION: 'تبرع',
  LOAN: 'قرض',
  ADVANCE: 'سلفة',
  LOAN_REPAYMENT: 'تسديد قرض',
  EXPENSE: 'مصروف',
  REVENUE: 'إيراد',
  MANUAL: 'قيد يدوي',
};

export const DIRECTION = {
  IN: 'وارد',
  OUT: 'صادر',
  TRANSFER: 'تحويل',
  OPENING: 'افتتاحي',
};

export const STATUS = {
  DRAFT: 'مسودة',
  POSTED: 'مرحّل',
  CANCELLED: 'ملغى',
};

export const ACCOUNT_TYPES = {
  CASH: 'صندوق نقدي',
  INTERNAL_FUND: 'صندوق داخلي',
  PROJECT_FUND: 'صندوق مشروع',
  PERSON_LEDGER: 'حساب شخص',
  RECEIVABLE: 'ذمم مدينة',
  PAYABLE: 'ذمم دائنة',
  EXPENSE_BUCKET: 'حساب مصروف',
  INCOME_BUCKET: 'حساب إيراد',
  TRANSFER: 'حساب تحويل',
  ADJUSTMENT: 'حساب تسوية',
};

export const CATEGORY_TYPES = {
  INCOME: 'إيراد',
  EXPENSE: 'مصروف',
  TRANSFER: 'تحويل',
  LOAN: 'قرض',
  ADVANCE: 'سلفة',
  DONATION: 'تبرع',
  RECEIVABLE: 'ذمة مدينة',
  PAYABLE: 'ذمة دائنة',
  ADJUSTMENT: 'تسوية',
};

export const COUNTERPARTY_TYPES = {
  PERSON: 'شخص',
  DONOR: 'متبرع',
  VENDOR: 'مورد',
  EMPLOYEE: 'موظف',
  BENEFICIARY: 'مستفيد',
  PROJECT: 'مشروع',
  ORGANIZATION: 'مؤسسة',
  OTHER: 'أخرى',
};

export const CUSTOM_FIELD_TYPES = {
  TEXT: 'نص قصير',
  LONG_TEXT: 'نص طويل',
  NUMBER: 'رقم',
  CURRENCY: 'مبلغ',
  DATE: 'تاريخ',
  SELECT: 'قائمة اختيار',
  BOOLEAN: 'نعم/لا',
};

export const PAYMENT_METHODS = ['نقدي', 'شيك', 'حوالة', 'بطاقة', 'أخرى'];

export const ARABIC_MONTHS = [
  'كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران',
  'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'
];

export const ROLES = {
  ADMIN: 'admin',
  ACCOUNTANT: 'accountant',
  DATA_ENTRY: 'data_entry',
  VIEWER: 'viewer',
};

// Seed: Starter Income Categories
export const SEED_INCOME_CATEGORIES = [
  'تبرعات', 'قرض', 'قروض', 'سلفة', 'آجار', 'آجارات', 'أجرة سيارة',
  'ثمن قبر', 'جديد ثمن قبر', 'اشتراك و انتساب', 'اشتراك مركز',
  'اشتراكات مركز خطوة أمل', 'تبرع مركز أمل', 'زكاة فطر',
  'كفارة صيام', 'كفارة يمين', 'مكتب تعليمي', 'فواتير مكتب تعليمي',
  'مركز خطوة أمل', 'هلال', 'مياه قص', 'مياه بلا قص', 'مكتب تنمية',
  'ايراد روضة', 'سلة غذائية', 'نباتا حسنا', 'سبل عيش', 'مطبخ',
  'أكسجين', 'أمر قبض للصندوق', 'دفعة آلاء',
];

// Seed: Starter Expense Categories
export const SEED_EXPENSE_CATEGORIES = [
  'نقدية', 'مواصلات', 'بطارية + لوح', 'بطاريات', 'مساعدات أخرى',
  'روضة', 'تدفئة', 'غذائية', 'مساعدات مالية', 'طبية', 'تعليم',
  'ترميم', 'قرض حسن', 'عمل', 'زواج', 'رواتب موظفين', 'قرطاسية',
  'صيانة', 'فطرة', 'دين خارجي',
];

// Seed: Starter Accounts/Ledgers
export const SEED_ACCOUNTS = [
  { name_ar: 'الصندوق الرئيسي', type: 'CASH', is_main: true },
  { name_ar: 'آلاء', type: 'PERSON_LEDGER' },
  { name_ar: 'أبو عمران', type: 'PERSON_LEDGER' },
  { name_ar: 'أبو عبدو (خاص)', type: 'PERSON_LEDGER' },
  { name_ar: 'أبو عبدو (مستفيدين)', type: 'PERSON_LEDGER' },
  { name_ar: 'أبو أنس ناجي', type: 'PERSON_LEDGER' },
  { name_ar: 'أبو محمد حسان', type: 'PERSON_LEDGER' },
  { name_ar: 'أبو محمد الدبس', type: 'PERSON_LEDGER' },
  { name_ar: 'عبد الهادي محيسن', type: 'PERSON_LEDGER' },
  { name_ar: 'أم عبد الله', type: 'PERSON_LEDGER' },
  { name_ar: 'نعمات', type: 'PERSON_LEDGER' },
  { name_ar: 'روضة', type: 'PROJECT_FUND' },
  { name_ar: 'هلال', type: 'PROJECT_FUND' },
  { name_ar: 'مياه', type: 'PROJECT_FUND' },
  { name_ar: 'مكتب تنمية', type: 'PROJECT_FUND' },
  { name_ar: 'غرامات', type: 'INTERNAL_FUND' },
  { name_ar: 'بلا قص', type: 'INTERNAL_FUND' },
  { name_ar: 'قص (أبو عبدو)', type: 'INTERNAL_FUND' },
  { name_ar: 'سحب', type: 'INTERNAL_FUND' },
];
