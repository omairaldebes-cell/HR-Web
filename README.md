# HR Management System - Cloud Version
* نظام إدارة الموارد البشرية والحضور والرواتب السحابي.

## Project Description (وصف المشروع)
This is a modern, lightweight, and fully cloud-synced HR Management System designed to track employee attendance, manage leave balances, calculate penalties, and manage monthly salary advances. 

هذا النظام هو تطبيق حديث وخفيف ومتزامن سحابياً مصمم لتتبع حضور الموظفين، إدارة أرصدة الإجازات، حساب خصومات التأخير، وإدارة السلف النقدية الشهرية واستخراج الصافي للرواتب.

## Features (الميزات)
* **Real-time Cloud Sync**: Powered by Firebase Firestore, changes made by one HR admin reflect instantly for all other users.
* **Smart Penalty Engine**: Automatically calculates delay hours where (15 mins = 1 hr penalty, 61 mins = 2 hrs penalty, etc.).
* **Leave Days Auto-Deductions**: Automatically translates accumulated delay hours into full-day absences subtracted from annual leave balances.
* **Finance & Advances**: Add cash advances directly deducted from an employee's targeted month's salary.
* **Sleek Dashboard**: A fully responsive interface displaying dynamic net salary, total deductions, and remaining leave days synced locally with Syrian Pounds (ل.س).

## Technologies Used (التقنيات المستخدمة)
* **React + Vite**: For blazing-fast interface performance and dynamic components.
* **Firebase Firestore**: For NoSQL real-time cloud data storage.
* **Vanilla CSS (Variables + Flexbox)**: For a lightweight dark-mode/light-mode ready styling.
* **Lucide React**: For scalable and beautiful SVG iconography.

## Getting Started (طريقة التشغيل)

1. **Install Dependencies** (تثبيت الحزم)
   ```bash
   npm install
   ```
2. **Setup Firebase** (إعداد قاعدة البيانات)
   Open `src/firebase.js` and ensure the `firebaseConfig` block contains your project's valid Firebase Configuration keys. You must have a Firestore Database initialized in the Firebase Console (Test mode is recommended for testing).

3. **Run Locally** (التشغيل المحلي)
   ```bash
   npm run dev
   ```

## User Guide & SOP (دليل المستخدم)
For detailed instructions on how to use the interface, manage employees, and calculate attendance, please read the Standard Operating Procedure in Arabic: [SOP-AR.md](./SOP-AR.md).
