# DLPHub
> **Professional Optimization Suite & Toolkit for Valve's Deadlock**  
> **بهینه‌ساز تخصصی و جعبه‌ابزار بازی Deadlock**

[English](#english) | [فارسی](#فارسی)

---

<a name="english"></a>
## English

**DLPHub** is a high-performance, open-source utility designed to boost framerates, eliminate micro-stutters, and optimize graphic and engine settings for Valve's **Deadlock** without manual configuration hassle.

### Why DLPHub?
Deadlock is actively developed on the Source 2 engine. Many players experience abrupt frame drops, heavy stuttering in teamfights, and uneven CPU/GPU load. Manually configuring hundreds of console commands across multiple files (`video.txt`, `autoexec.cfg`, `gameinfo.gi`) is tedious and frequently breaks after weekly game updates.

**DLPHub** automates this entire process with a single click, unlocking the highest framerates and lowest latency from your hardware while preserving your personal settings.

---

### Key Features

#### 🎮 4 Dedicated Graphics Presets
- **Tier 1 (Max FPS):** Ultra-optimized for budget hardware and competitive play.
- **Tier 2 (Balanced):** The sweet spot between high framerates and clear visibility.
- **Tier 3 (Light):** Subtle optimizations for mid-to-high-end rigs.
- **POTATO Mode:** Extreme low-spec configuration designed to run Deadlock on low-end laptops and older PCs.

#### ⚡ 3-Way Rendering API Switch (DirectX 11 / Default / Vulkan)
- Instant one-click toggle between **DirectX 11**, **Default**, and **Vulkan**.
- Resolves driver crashes, static frame drops, and delivers smoother frametimes across different GPU architectures (NVIDIA / AMD / Intel).
- Seamlessly integrates with game launches via Steam.

#### 👁️ Custom Field of View (FOV) Slider
- Adjust your camera FOV from **70° to 120°** in clean 5° increments.
- Overrides default narrow view angles for full situational awareness and lane control.

#### 🌐 Built-In Valve Relay Network Ping Tester
- Real-time ICMP ping measurement across 8 official Valve server regions (Frankfurt, Vienna, Dubai, Stockholm, Warsaw, Amsterdam, London, US East).
- Advanced telemetry: average latency, jitter calculation, packet loss percentage, and overall stability scoring.

#### ⏱️ Framerate Limit & Engine Controls
- **Framerate Limit (FPS Limit):** Toggle between **MAX (0 / Uncapped)**, **144**, **165**, and **240 FPS**. Applied directly to `video.txt` and enforced in `autoexec.cfg` without modifying your monitor's native refresh rate (Hz).
- **Rendering API Selection:** Switch between **DirectX 11**, **Default**, and **Vulkan** via launch options with one click.
- **HUD Configuration:** Toggle updated Citadel unit status and health bar visuals (`citadel_unit_status_use_new`).

#### 🛡️ Automatic Backup & Safe Revert
- **15-Backup Retention:** Automatically manages up to 15 backups, pruning the oldest automatically.
- **Backup Size Tracking:** Displays exact disk space consumed by each backup.
- **One-Click Revert:** Completely restore original game files (`.dlp.bak`) and remove all mods anytime.
- **Process Guard:** Prevents file modifications while Deadlock is running to eliminate file corruption risks.

#### 🔍 System Diagnostics & Rotating Logger
- Built-in rotating logger in `%APPDATA%\DLPHub\logs\app.log`.
- **Copy Diagnostics:** One-click clipboard copy of system specifications, game path, detection status, and recent logs for fast troubleshooting.

---

### Technical Highlights
- **Ultra-Lightweight Architecture (Rust + Tauri):** Built with Rust and Tauri for near-instant boot, minimal CPU footprint, and memory-optimized WebView2 execution.
- **Single Portable Executable:** No installation, no registry pollution, no extra installer files.
- **100% VAC-Safe:** Modifies only official Source 2 configuration files and console variables (CVars). Zero code injection, zero memory tampering.

---

### How to Use in 3 Simple Steps
1. Download `DLPHub.exe` and run it (Deadlock's install folder is auto-detected).
2. Choose your preferred graphics tier, rendering API (DX11/Vulkan/Default), FOV, and options.
3. Click **"Apply to Deadlock"** and launch the game!

---

<a name="فارسی"></a>
## فارسی

**DLP Hub** بهینه‌ساز تخصصی و جعبه‌ابزار بازی **Deadlock** است که با هدف افزایش نرخ فریم، حذف استاتر و بهینه‌سازی کامل تنظیمات بدون نیاز به دستکاری دستی فایل‌های بازی توسعه یافته است.

### چرا DLP Hub؟
بازی Deadlock به دلیل توسعه مداوم روی موتور Source 2، برای بسیاری از بازیکنان با افت فریم ناگهانی، لگ‌های سنگین در درگیری‌ها و بار پردازشی نامتعادل همراه است. اعمال دستی صدها خط دستور در فایل‌های کانفیگ علاوه بر زمان‌بر بودن، با هر آپدیت هفتگی بازی دچار اختلال می‌شود.

**DLP Hub** تمامی این فرآیندها را خودکار کرده است تا بدون درگیر شدن با کدهای پیچیده، با یک کلیک بهترین تجربه بصری و روان‌ترین فریم‌ریت را از سخت‌افزار خود دریافت کنید.

---

### امکانات کلیدی نرم‌افزار

#### 🎮 ۴ پروفایل گرافیکی اختصاصی
- **تییر ۱ (حداکثر فریم):** بهینه‌سازی حداکثری برای سیستم‌های ضعیف و پلی رقابتی.
- **تییر ۲ (متعادل):** توازن ایده‌آل میان فریم‌ریت بالا و شفافیت تصویر.
- **تییر ۳ (سبک):** بهینه‌سازی‌های ملایم برای سیستم‌های متوسط و قوی.
- **حالت ذغالی (POTATO):** تنظیمات فوق‌العاده سبک جهت اجرای بازی روی لپ‌تاپ‌های ضعیف و سیستم‌های قدیمی.

#### ⚡ سوئیچ سریع رندرر (DirectX 11 / پیش‌فرض / Vulkan)
- سوییچ ۳ حالته میان **DirectX 11**، **پیش‌فرض** و **Vulkan**.
- رفع کرش‌ها، لگ‌های استاتیک و دریافت فریم‌تایم پایدارتر متناسب با کارت گرافیک‌های مختلف (NVIDIA / AMD / Intel).
- اعمال مستقیم روی اجرای بازی از طریق استیم.

#### 👁️ اسلایدر اختصاصی میدان دید (FOV)
- تنظیم دلخواه زاویه دید از **۷۰ تا ۱۲۰ درجه** با گام‌های ۵ تایی.
- تسلط کامل بر نقشه و خطوط دید حریفان فراتر از محدودیت پیش‌فرض بازی.

#### 🌐 پینگ‌چکر اختصاصی رله‌های سرور ولو
- اندازه‌گیری تاخیر واقعی (ICMP) تا ۸ منطقه سرور رسمی ولو (فرانکفورت، وین، دبی، استکهلم، ورشو، آمستردام، لندن، شرق آمریکا).
- تله‌متری پیشرفته: نمایش میانگین پینگ، نوسان (Jitter)، درصد پکت‌لاس و امتیاز پایداری مسیر.

#### ⏱️ تنظیمات فریم‌ریت و موتور بازی
- **محدودیت نرخ فریم (FPS Limit):** امکان انتخاب بین **حالت حداکثر (0 / نامحدود)**، **۱۴۴**، **۱۶۵** و **۲۴۰ فریم بر ثانیه**. این مقدار مستقیماً در `video.txt` و `autoexec.cfg` اعمال می‌شود بدون تغییر در رفرش‌ریت اصلی مانیتور شما.
- **انتخاب موتور گرافیکی (Rendering API):** سوییچ سریع میان **DirectX 11**، **حالت پیش‌فرض** و **Vulkan** از طریق Launch Options.
- **نوارهای سلامت جدید (Health Bars):** فعال‌سازی یا غیرفعال‌سازی ظاهر جدید نوار خون هیروها و یونیت‌ها (`citadel_unit_status_use_new`).

#### 🛡️ سیستم بکاپ هوشمند و بازگردانی سریع
- **نگهداری خودکار تا ۱۵ بکاپ:** ذخیره خودکار نسخه‌های پشتیبان با پاکسازی خودکار قدیمی‌ترین‌ها.
- **محاسبه و نمایش حجم هر بکاپ:** اطلاع دقیق از فضای اشغال‌شده توسط هر اسنپ‌شات.
- **بازگردانی کامل (Revert Vanilla):** بازگشت ۱۰۰٪ به فایل‌های دست‌نخورده اولیه بازی تنها با یک کلیک.
- **گارد محافظ پروسه:** جلوگیری از اعمال کانفیگ هنگام باز بودن بازی برای جلوگیری از خرابی فایل‌ها.

#### 🔍 گزارش عیب‌یابی و لاگر سیستمی
- لاگ فایل چرخشی در مسیر `%APPDATA%\DLPHub\logs\app.log`.
- **دکمه کپی گزارش عیب‌یابی (Copy Diagnostics):** کپی آنی مشخصات سیستم، مسیرها، وضعیت بکاپ‌ها و لاگ‌ها در کلیپ‌بورد جهت دریافت پشتیبانی سریع.

---

### ویژگی‌های فنی
- **معماری فوق‌سبک (Rust + Tauri):** توسعه‌یافته بر پایه زبان Rust و فریمورک مدرن Tauri؛ کمترین میزان مصرف رم، بدون پردازش سنگین در پس‌زمینه و با رابط کاربری روان.
- **تک‌فایل پرتابل (`DLPHub.exe`):** بدون نیاز به نصب، بدون تولید فایل‌های اضافه در رجیستری ویندوز.
- **۱۰۰٪ ایمن و بدون خطر بن (VAC-Safe):** کلیه بهینه‌سازی‌ها صرفاً از طریق دستورات رسمی موتور Source 2 (CVars) و فایل‌های مجاز کانفیگ اعمال می‌شوند و هیچ‌گونه تزریق کدی (Inject) به حافظه بازی صورت نمی‌گیرد.

---

### راهنمای استفاده در ۳ گام ساده
1. فایل `DLPHub.exe` را دانلود و اجرا کنید (مسیر نصب Deadlock به صورت خودکار شناسایی می‌شود).
2. پروفایل گرافیکی، رندرر دلخواه (DX11 / Vulkan / Default)، زاویه دید (FOV) و گزینه‌های مدنظرتان را انتخاب کنید.
3. دکمه **«اعمال روی ددلاک»** را بزنید و بازی را اجرا کنید!

---

### سوالات متداول (FAQ)

**آیا استفاده از این برنامه خطر بن (VAC) دارد؟**  
خیر. برنامه تنها فایل‌های متنی و کانفیگ استاندارد بازی را ویرایش می‌کند و در فایل‌های اجرایی، مموری یا کتابخانه‌های بازی هیچ‌گونه تغییری ایجاد نمی‌کند.

**اگر بعد از آپدیت بازی با مشکل مواجه شدم چه کنم؟**  
کافی است در تب پیشرفته (Advanced) روی گزینه **«بازگردانی تمام تغییرات»** کلیک کنید تا تمام فایل‌های بازی به نسخه دست‌نخورده اولیه بازگردند.

**آیا برنامه باید حین بازی باز بماند؟**  
خیر. پس از زدن دکمه اعمال می‌توانید برنامه را ببندید؛ تنظیمات مستقیماً در کانفیگ‌های بازی ذخیره شده‌اند.

**چرا هنگام اولین اجرا با پنجره آبی Windows SmartScreen مواجه می‌شوم؟**  
این اخطار به دلیل ناشناخته بودن فایل‌های اجرایی جدید و مستقل در دیتابیس اولیه مایکروسافت نمایش داده می‌شود و ارتباطی با بدافزار ندارد. فایل کاملاً متن‌باز، امن و عاری از هرگونه کد مخرب است. برای اجرا:
1. روی گزینه **More info** (اطلاعات بیشتر) کلیک کنید.
2. دکمه **Run anyway** (اجرا در هر صورت) را بزنید.

---

### مشخصات فایل
- **نام فایل:** `DLPHub.exe` (Portable)
- **نسخه:** `0.1.0 Beta`
- **پیش‌نیاز:** ویندوز ۱۰ یا ۱۱ (۶۴ بیتی) + مایکروسافت WebView2
- **توسعه‌دهنده:** [aryobw9](https://github.com/aryobw9)
- **کانال تلگرام:** [@deadlock_persian](https://t.me/deadlock_persian)
- **وبسایت:** [deadlockpersian.ir](https://deadlockpersian.ir)
