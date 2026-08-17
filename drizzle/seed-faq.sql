-- Seed FAQ entries for the medical CRM system
-- Run this after migration: psql $DATABASE_URL -f backend/drizzle/seed-faq.sql

INSERT INTO faq_entries (question_fa, answer_fa, question_en, answer_en, category, tags, source, is_published)
VALUES
  -- General
  (
    'چگونه می‌توانم وارد سیستم شوم؟',
    'برای ورود به سیستم، شماره تلفن و رمز عبور خود را در صفحه ورود وارد کنید. اگر رمز عبور خود را فراموش کرده‌اید، روی "فراموشی رمز عبور" کلیک کنید تا کد تأیید از طریق پیامک ارسال شود.',
    'How do I log into the system?',
    'To log in, enter your phone number and password on the login page. If you forgot your password, click "Forgot Password" to receive a verification code via SMS.',
    'general',
    ARRAY['ورود', 'login', 'password', 'رمز عبور'],
    'manual',
    true
  ),
  (
    'چگونه تم حالت تاریک را تغییر دهم؟',
    'روی آیکون خورشید/ماه در نوار بالای صفحه کلیک کنید تا بین حالت روشن و تاریک سوئیچ کنید. تنظیمات شما ذخیره می‌شود.',
    'How do I switch dark mode?',
    'Click the sun/moon icon in the top bar to toggle between light and dark mode. Your preference is saved.',
    'general',
    ARRAY['تم', 'تاریک', 'theme', 'dark mode'],
    'manual',
    true
  ),
  (
    'چگونه زبان سیستم را تغییر دهم؟',
    'روی آیکون گلوب در نوار بالای صفحه کلیک کنید و زبان مورد نظر (فارسی یا انگلیسی) را انتخاب کنید.',
    'How do I change the system language?',
    'Click the globe icon in the top bar and select your preferred language (Farsi or English).',
    'general',
    ARRAY['زبان', 'language', 'فارسی', 'انگلیسی'],
    'manual',
    true
  ),
  -- Patients
  (
    'چگونه بیمار جدید ثبت کنم؟',
    'از بخش "بیماران" در منوی سمت راست وارد شوید و روی "بیمار جدید" کلیک کنید. فرم اطلاعات بیمار را با دقت پر کنید و ذخیره کنید. اطلاعات هویتی، بیمه‌ای و تماس بیمار ضروری است.',
    'How do I create a new patient?',
    'Go to "Patients" in the sidebar and click "New Patient". Fill out the patient form carefully and save. Demographic, insurance, and contact information are required.',
    'patients',
    ARRAY['بیمار', 'ثبت', 'patient', 'create'],
    'manual',
    true
  ),
  (
    'چگونه پروفایل بیمار را مشاهده کنم؟',
    'از بخش "بیماران" روی نام بیمار مورد نظر کلیک کنید تا پروفایل کامل بیمار شامل اطلاعات شخصی، تاریخچه پزشکی، نسخه‌ها و نتایج آزمایش نمایش داده شود.',
    'How do I view a patient profile?',
    'In the "Patients" section, click on the patient\'s name to view their full profile including personal info, medical history, prescriptions, and lab results.',
    'patients',
    ARRAY['پروفایل', 'بیمار', 'profile', 'patient'],
    'manual',
    true
  ),
  -- Scheduling
  (
    'چگونه نوبت‌دهی کنم؟',
    'از بخش "نوبت‌دهی" وارد شوید. تاریخ و ساعت مورد نظر را انتخاب کنید، بیمار را انتخاب کرده و نوع ویزیت را مشخص کنید. سپس "ذخیره" را بزنید.',
    'How do I book an appointment?',
    'Go to the "Appointments" section. Select the date and time, choose the patient, specify the visit type, and click "Save".',
    'scheduling',
    ARRAY['نوبت', 'وقت', 'appointment', 'booking'],
    'manual',
    true
  ),
  (
    'چگونه زمان‌بندی کاری پزشک را تنظیم کنم؟',
    'از بخش "زمان‌بندی" در پنل مدیریت، روزها و ساعات کاری مورد نظر را اضافه یا ویرایش کنید. هر بازه زمانی باید حداقل و حداکثر نوبت‌ها را مشخص کند.',
    'How do I configure doctor availability?',
    'In the "Scheduling" section of the admin panel, add or edit working days and hours. Each time slot should specify minimum and maximum appointments.',
    'scheduling',
    ARRAY['زمان‌بندی', 'کاری', 'scheduling', 'availability'],
    'manual',
    true
  ),
  -- Clinical
  (
    'چگونه نسخه اضافه کنم؟',
    'در پروفایل بیمار، به تب "نسخه‌ها" بروید و "نسخه جدید" را کلیک کنید. نام دارو، دوز، دفعات مصرف و مدت زمان مصرف را وارد کنید. می‌توانید نسخه را چاپ کنید.',
    'How do I add a prescription?',
    'In the patient profile, go to the "Prescriptions" tab and click "New Prescription". Enter medication name, dosage, frequency, and duration. You can print the prescription.',
    'prescriptions',
    ARRAY['نسخه', 'دارو', 'prescription', 'medication'],
    'manual',
    true
  ),
  (
    'چگونه نتایج آزمایش را ببینم؟',
    'از بخش "نتایج آزمایش" در منوی سمت راست وارد شوید. می‌توانید بر اساس بیمار یا تاریخ فیلتر کنید. نتایج شامل مقادیر مرجع و وضعیت نرمال/غیرنرمال هستند.',
    'How do I view lab results?',
    'Go to "Lab Results" in the sidebar. You can filter by patient or date. Results include reference values and normal/abnormal status.',
    'lab_results',
    ARRAY['آزمایش', 'نتیجه', 'lab', 'results'],
    'manual',
    true
  ),
  (
    'چگونه علائم حیاتی بیمار را ثبت کنم؟',
    'در پروفایل بیمار، به تب "ابزارهای بالینی" بروید. فشار خون، ضربان قلب، دما، وزن و قد را وارد کنید. سیستم BMI را به صورت خودکار محاسبه می‌کند.',
    'How do I record patient vitals?',
    'In the patient profile, go to the "Clinical Tools" tab. Enter blood pressure, heart rate, temperature, weight, and height. The system automatically calculates BMI.',
    'clinical',
    ARRAY['علائم حیاتی', 'فشار خون', 'vitals', 'blood pressure'],
    'manual',
    true
  ),
  -- Billing
  (
    'چگونه صورتحساب ایجاد کنم؟',
    'از بخش "صورتحساب" وارد شوید، بیمار مورد نظر را انتخاب کنید و "صورتحساب جدید" را کلیک کنید. نوع خدمت، مبلغ و وضعیت پرداخت را مشخص کنید.',
    'How do I create a billing record?',
    'Go to the "Billing" section, select the patient, and click "New Billing". Specify the service type, amount, and payment status.',
    'billing',
    ARRAY['صورتحساب', 'پرداخت', 'billing', 'payment'],
    'manual',
    true
  ),
  -- Staff
  (
    'چگونه حضور و غیاب کارکنان را ثبت کنم؟',
    'از بخش "حضور و غیاب" در منوی مدیریت وارد شوید. برای هر کارمند، دکمه "ورود" یا "خروج" را فشار دهید. سیستم به صورت خودکار ساعات کاری را محاسبه می‌کند.',
    'How do I record staff attendance?',
    'Go to the "Attendance" section in the admin menu. For each staff member, press the "Check-in" or "Check-out" button. The system automatically calculates working hours.',
    'staff',
    ARRAY['حضور', 'غیاب', 'attendance', 'staff'],
    'manual',
    true
  ),
  -- Inventory
  (
    'چگونه موجودی انبار را مدیریت کنم؟',
    'از بخش "انبار" وارد شوید. می‌توانید محصولات جدید اضافه کنید، موجودی را بروزرسانی کنید و تاریخچه جابجایی‌ها را مشاهده کنید.',
    'How do I manage inventory?',
    'Go to the "Inventory" section. You can add new products, update stock levels, and view movement history.',
    'inventory',
    ARRAY['انبار', 'موجودی', 'inventory', 'stock'],
    'manual',
    true
  ),
  -- Account
  (
    'چگونه رمز عبور خود را تغییر دهم؟',
    'از بخش "پروفایل من" در منوی سمت راست وارد شوید و روی "تغییر رمز عبور" کلیک کنید. رمز فعلی و رمز جدید را وارد کنید و ذخیره کنید.',
    'How do I change my password?',
    'Go to "My Profile" in the sidebar and click "Change Password". Enter your current and new password, then save.',
    'settings',
    ARRAY['رمز', 'تغییر', 'password', 'change'],
    'manual',
    true
  ),
  -- Reports
  (
    'چگونه گزارش روزانه ببینم؟',
    'از بخش "گزارش‌های روزانه" در منوی مالی وارد شوید. تاریخ مورد نظر را انتخاب کنید تا خلاصه فعالیت‌های کلینیک شامل تعداد ویزیت‌ها، درآمد و بیماران نمایش داده شود.',
    'How do I view daily reports?',
    'Go to "Daily Reports" in the finance menu. Select the date to see a summary of clinic activities including visits, revenue, and patients.',
    'accounting',
    ARRAY['گزارش', 'روزانه', 'daily', 'report'],
    'manual',
    true
  );
