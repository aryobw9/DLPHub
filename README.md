# DLPHub
> **Professional Optimization Suite & Toolkit for Valve's Deadlock**  
> **بهینه‌ساز تخصصی، ابزار مسیریابی شبکه و جعبه‌ابزار بازی Deadlock**

[English](#english) | [فارسی](#فارسی)

---

<a name="english"></a>
## English

**DLPHub** is a high-performance, open-source desktop utility engineered to maximize framerates, eliminate frametime micro-stutters, optimize network routing, and manage game assets for Valve's **Deadlock** with zero manual friction.

### Why DLPHub?
Deadlock is actively developed on the Source 2 engine. Players frequently experience severe FPS drops in chaotic late-game teamfights, input delay, and unoptimized network routing. Manually editing hundreds of console variables across `video.txt`, `autoexec.cfg`, and `gameinfo.gi` is tedious, error-prone, and constantly overwritten by game updates.

**DLPHub** automates engine optimization, provides custom HUD enhancements, manages game aspect ratios, benchmarks network routing, and shields your original files with smart automated backups.

---

### Key Features

#### 🎮 5 Dedicated Graphics Presets
- **Tier 1 (High Graphics):** Conservative visual optimizations delivering high visual fidelity with rock-solid competitive framerate stability.
- **Tier 2 (Medium Graphics):** The balanced profile, offering an optimal trade-off between clean visuals and elevated FPS.
- **Tier 3 (Low Graphics):** Aggressive texture, effect, and particle cuts engineered for high refresh-rate competitive monitors.
- **Potato Graphics:** Extreme low-spec configuration with custom optimization VPKs for older PCs and low-end laptops.
- **Russian Potato (ذغالی روس):** Ultimate ultra-performance configuration featuring dedicated texture reduction VPKs, customized LOD culling curves, optimized particle handling, and 120 FPS Panorama UI updates.

#### 🎯 Visual & HUD Mods
- **Better Breakables:** Enhances the visibility of breakable boxes, crates, and flying golden statues/bats across the map (Zero FPS impact).
- **Higher Brightness:** Boosts ambient lighting and visibility in darker alleyways and interior sections (`-FPS` low downgrade impact).
- **Reduce Clutter:** Strips distracting ground debris, clutter, and non-essential ambient props for maximum frame stability (`MAX` impact).

#### 👁️ FOV & Aspect Ratio Controls
- **In-Game FOV (video.txt):** Smoothly adjust your in-game field of view up to 90°.
- **True Aspect Ratio (gameinfo.gi):** Custom aspect ratio override slider (from `1.33` to `3.50`) with instant quick-select presets:
  - `1.78` (16:9 standard)
  - `2.15` (90° ultra-wide FOV equivalent)
  - `2.33` (21:9 cinematic ultrawide)
  - `2.49` (100° FOV equivalent)
  - `3.09` (120° extreme competitive vision)
  - Full Enable/Disable toggle to revert back to default engine aspect ratio without affecting other tweaks.

#### 🏃 Animation & Physics Optimizations
- **Cloth Animations Toggle:** Halts CPU-heavy cloth simulations (`cloth_update "0"`, `cloth_sim_on_tick "0"`).
- **Fade Hero Ragdolls:** Quickly removes dead hero ragdolls from teamfights (`cl_ragdoll_limit "0"`), relieving physics processing.

#### 🌐 Network Latency & Server Routing Tools
- **Live Valve Relay Ping Tester:** Real-time latency measurement across 8 official Valve regions (Frankfurt, Vienna, Dubai, Stockholm, Warsaw, Amsterdam, London, US East) with packet loss, jitter analysis, and sparkline latency graphs.
- **DNS Benchmarker & 1-Click Switcher:** Benchmark and switch between popular global and gaming DNS servers (Cloudflare, Google, Electro, Shecan, 403.online, Radar Game, Quad9, OpenDNS).
- **Server Blocker:** One-click Windows Firewall IP filtering to block high-ping server regions, ensuring matchmaking connects only to your preferred low-latency clusters.

#### ⚡ 3-Way Rendering API Switch (DirectX 11 / Default / Vulkan)
- One-click toggle between **DirectX 11**, **Default**, and **Vulkan**.
- Alleviates driver-specific crashes, eliminates frametime hitches, and optimizes GPU pipeline utilization.

#### ⏱️ Framerate Limit & Launch Options
- **10-Step FPS Limit:** Instant selection between **DEFAULT**, **45**, **60**, **75**, **90**, **144**, **165**, **245**, **320**, or **Unlimited (∞ / 0)**.
- **Launch Options Helper:** One-click copy buttons for `-dx11`, `-vulkan`, and `-high`.

#### 🛡️ Smart Backup, Restore & Revert
- **Automated Retention:** Automatically captures and manages up to 15 backups with per-snapshot disk usage metrics.
- **Permanent Baseline Protection:** Safeguards your original unmodded game files (`.dlp.bak`) on the first run; baseline snapshots are never deleted.
- **One-Click Revert:** Cleanly uninstalls all presets, addons, and tweaks, restoring your game installation to 100% vanilla state.
- **Process Guard:** Prevents file modification while Deadlock is running to eliminate corruption risks.

---

### Technical Highlights
- **Ultra-Lightweight (Rust + Tauri v2):** Instant launch, near-zero CPU usage, and strict memory limits (~60MB heap cap).
- **Single Standalone Portable Executable:** Zero installation required, zero background daemons, zero registry pollution.
- **100% VAC-Safe:** Modifies only official Source 2 text configs (`gameinfo.gi`, `autoexec.cfg`, `video.txt`) and VPK addons. No memory injection, no DLL hooking.
- **Free & Open Source:** Licensed under the **GNU General Public License v3.0 (GPLv3)**.

---

### Security, Transparency & VirusTotal Report
🛡️ **VirusTotal Scan:** [Verified Safe](https://www.virustotal.com/gui/file/c519c55ecdff5cedac66611f44b182c0cc216df327fab6dca2a7faf2c3e7f925?nocache=1)

DLPHub is 100% open-source, safe, and transparent:
- Verified clean by all major vendors including **Microsoft Defender**, **Kaspersky**, **Bitdefender**, **ESET**, **Sophos**, **Malwarebytes**, **Avast**, and **Symantec**.
- As a standalone portable executable, it unpacks embedded configuration templates to a temporary folder on first run.
- Every release binary is automatically compiled and published through [GitHub Actions CI/CD](https://github.com/aryobw9/DLPHub/actions).

---

### How to Use in 3 Steps
1. Download `DLPHub.exe` from the latest release and run it (Deadlock is auto-detected).
2. Choose your preferred graphics preset, aspect ratio, HUD mods, and rendering API.
3. Click **"APPLY TO DEADLOCK"** and launch the game!

---

<a name="فارسی"></a>
## فارسی

**DLPHub** یک ابزار تخصصی، پرتابل، بسیار سبک و متن‌باز برای بازی **Deadlock** است که با هدف افزایش چشمگیر فریم‌ریت، حذف استاترها و لگ‌های فریم‌تایم، بهینه‌سازی مسیرهای شبکه و پینگ، و مدیریت بدون دردسر فایل‌های کانفیگ ددلاک توسعه یافته است.

### چرا DLPHub؟
بازی ددلاک به دلیل توسعه پیوسته بر پایه موتور سورس ۲، برای بسیاری از بازیکنان با افت فریم شدید در درگیری‌ها، لگ‌های استاتیک و ناهماهنگی در مصرف منابع پردازنده و کارت گرافیک همراه است. تنظیم دستی صدها دستور در فایل‌های `video.txt`، `autoexec.cfg` و `gameinfo.gi` کاری دشوار و زمان‌بر بوده و با آپدیت‌های هفتگی استیم بازنویسی یا خراب می‌شود.

**DLPHub** این فرآیند را تنها با یک کلیک انجام می‌دهد؛ بیشترین فریم ممکن را از سیستم شما استخراج کرده، از فایل‌های اورجینال بازی پشتیبان‌گیری هوشمند انجام داده و امکانات شخصی‌سازی متنوعی را در اختیارتان می‌گذارد.

---

### امکانات کلیدی نرم‌افزار

#### 🎮 ۵ پروفایل گرافیکی اختصاصی
- **تییر ۱ (گرافیک بالا):** بهینه‌سازی استاندارد با حفظ حداکثری کیفیت بصری و ثبات کامل فریم در صحنه‌های شلوغ.
- **تییر ۲ (متعادل):** توازن ایده‌آل میان شفافیت و زیبایی تصویر با افزایش محسوس نرخ فریم.
- **تییر ۳ (گرافیک پایین):** کاهش شدید بافت‌ها، ذرات و افکت‌های اضافی جهت دستیابی به حداکثر فریم در مسابقات رقابتی.
- **گرافیک ذغالی (POTATO):** تنظیمات فوق‌العاده سبک همراه با مادهای اختصاصی VPK جهت اجرای روان روی لپ‌تاپ‌ها و سیستم‌های ضعیف.
- **ذغالی روس (Russian Potato):** نسخه ویژه فوق‌بهینه با VPK فشرده بافت‌ها، تنظیم منحنی LOD، روشنایی اصلاح‌شده، رندر کامل افکت‌ها و فریم‌ریت ۱۲۰ هرتزی Panorama UI جهت جلوگیری از هرگونه باگ در نمایش خون مینیون‌ها.

#### 🎯 مادهای بصری و رابط کاربری (HUD)
- **دید راحت‌تر باکس و خفاش‌ها (Better Breakables):** متمایزسازی جعبه‌های چوبی لوت و خفاش‌ها/مجسمه‌های متحرک طلایی در آسمان برای فارم سریع‌تر (بدون افت فریم - `0 FPS`).
- **روشنایی بیشتر (Higher Brightness):** افزایش نور محیطی و دید بهتر در راهروهای تاریک نقشه (`-FPS`).
- **کاهش شلوغی بصری (Reduce Clutter):** حذف زباله‌ها، آوارها و آبجکت‌های تزیینی غیرضروری از زمین برای افزایش حداکثری فریم (`MAX`).

#### 👁️ زاویه دید و نسبت تصویر (FOV & Aspect Ratio)
- **زاویه دید درون بازی (video.txt):** تنظیم اسلایدر دید درون بازی تا ۹۰ درجه.
- **نسبت تصویر واقعی (gameinfo.gi):** اسلایدر اختصاصی تنظیم نسبت تصویر از `1.33` تا `3.50` همراه با کلیدهای میانبر سریع:
  - `1.78` (استاندارد 16:9)
  - `2.15` (معادل دید عریض 90 درجه)
  - `2.33` (دید عریض سینمایی 21:9)
  - `2.49` (معادل دید 100 درجه)
  - `3.09` (دید فوق عریض 120 درجه برای اشراف کامل به محیط)
  - کلید روشن/خاموش اختصاصی برای بازگشت به نسبت تصویر پیش‌فرض بازی در هر لحظه.

#### 🏃 بهینه‌سازی فیزیک و انیمیشن
- **توقف شبیه‌سازی لباس:** خاموش کردن پردازش مداوم فیزیک لباس‌ها برای آزادسازی توان پردازنده (`cloth_update "0"`, `cloth_sim_on_tick "0"`).
- **محو سریع اجساد (Ragdolls):** حذف فوری فیزیک اجساد پس از کشته شدن هیروها برای جلوگیری از افت فریم در فایت‌های تیمی سنگین (`cl_ragdoll_limit "0"`).

#### 🌐 تنظیمات پینگ، DNS و مسیریابی ددلاک
- **تست دقیق و زنده پینگ سرورها:** پایش لحظه‌ای پینگ با ۸ منطقه سرور رسمی ولو (فرانکفورت، وین، دبی، استکهلم، ورشو، آمستردام، لندن و شرق آمریکا) همراه با محاسبه پکت‌لاس، نوسان (Jitter) و نمودار اسپارک‌لاین.
- **تست و تغییر DNS با یک کلیک:** بنچمارک و تعویض خودکار DNS بین ارائه‌دهندگان مطرح ایرانی و بین‌المللی (Cloudflare, Google, الکترو، شکن، 403 آنلاین، رادار گیم، Quad9 و OpenDNS).
- **سرور بلاکر (Server Blocker):** فیلتر و مسدودسازی سرورهای با پینگ بالا از طریق فایروال ویندوز با یک کلیک، جهت تضمین اتصال بازی فقط به بهترین ریجن‌های دارای کمترین پینگ.

#### ⚡ سوئیچ سریع رندرر (DirectX 11 / پیش‌فرض / Vulkan)
- تغییر سریع بین **DirectX 11**، **پیش‌فرض** و **Vulkan**.
- رفع کرش‌های گرافیکی، حذف استاترهای فریم‌تایم و سازگاری با کارت‌های گرافیک NVIDIA، AMD و Intel.

#### ⏱️ تنظیمات فریم‌ریت و Launch Options
- **محدودکننده فریم‌ریت (FPS Limit):** امکان انتخاب سریع بین **DEFAULT**، **۴۵**، **۶۰**، **۷۵**، **۹۰**، **۱۴۴**، **۱۶۵**، **۲۴۵**، **۳۲۰** یا **نامحدود (∞ / 0)**.
- **دکمه‌های کپی Launch Options:** کپی آسان دستورات استیم (`-dx11`، `-vulkan`، `-high`) همراه با توضیحات راهنما.

#### 🛡️ سیستم هوشمند پشتیبان‌گیری و بازگردانی
- **نگهداری تا ۱۵ نسخه پشتیبان:** مدیریت خودکار بکاپ‌ها با نمایش دقیق حجم دیسک.
- **محافظت دائمی از فایل‌های اولیه:** ذخیره دائمی اسنپ‌شات‌های اورجینال استیم (`.dlp.bak`) در اولین اجرا، غیرقابل حذف به اشتباه.
- **بازگردانی کامل (Revert Vanilla):** بازگرداندن ۱۰۰٪ تنظیمات به وضعیت خام استیم و حذف تمام مادها با یک کلیک.
- **گارد محافظ پروسه:** جلوگیری خودکار از دستکاری فایل‌ها هنگام باز بودن بازی ددلاک برای پیشگیری از هرگونه خرابی.

---

### مشخصات فنی
- **فوق‌العاده سبک (Rust + Tauri v2):** اجرای آنی، مصرف ناچیز رم و پردازنده (محدودیت حافظه ~۶۰ مگابایت).
- **فایل اجرایی مستقل و پرتابل:** بدون نیاز به نصب، بدون سرویس‌های مخفی در پس‌زمینه و بدون دستکاری ریجستری ویندوز.
- **۱۰۰٪ ایمن در برابر VAC استیم:** فقط فایل‌های کانفیگ رسمی Source 2 (`gameinfo.gi`، `autoexec.cfg`، `video.txt`) و مادهای مجاز VPK را تنظیم می‌کند و به رم بازی تزریق نمی‌شود.
- **رایگان و متن‌باز:** تحت مجوز **GNU General Public License v3.0 (GPLv3)**.

---

### امنیت، شفافیت و گزارش VirusTotal
🛡️ **بررسی ویروس‌توتال:** [تأیید ایمنی و سلامت کامل](https://www.virustotal.com/gui/file/c519c55ecdff5cedac66611f44b182c0cc216df327fab6dca2a7faf2c3e7f925?nocache=1)

نرم‌افزار DLPHub کاملاً متن‌باز، ایمن و شفاف است:
- تمامی آنتی‌ویروس‌های معتبر جهان از جمله **Microsoft Defender**, **Kaspersky**, **Bitdefender**, **ESET**, **Sophos**, **Malwarebytes**, **Avast** و **Symantec** سلامت ۱۰۰٪ فایل را تأیید کرده‌اند.
- سورس‌کد نرم‌افزار به صورت کاملاً عمومی در گیت‌هاب قرار دارد و تمامی بیلدها مستقیماً توسط [GitHub Actions](https://github.com/aryobw9/DLPHub/actions) کامپایل و منتشر می‌شوند.

---

### راهنمای استفاده در ۳ گام ساده
1. فایل `DLPHub.exe` را دانلود و اجرا کنید (مسیر نصب بازی به صورت خودکار شناسایی می‌شود).
2. پریست گرافیکی، نسبت تصویر، مادهای HUD و گزینه‌های مدنظرتان را انتخاب کنید.
3. دکمه **«اعمال روی ددلاک»** را بزنید و بازی را اجرا کنید!

---

### مشخصات فایل
- **نام فایل:** `DLPHub.exe` (Portable)
- **نسخه:** `0.1.4 BETA`
- **مجوز نرم‌افزار:** GNU General Public License v3.0 (GPLv3)
- **پیش‌نیاز:** ویندوز ۱۰ یا ۱۱ (۶۴ بیتی) + مایکروسافت WebView2
- **توسعه‌دهنده:** [aryobw9](https://github.com/aryobw9)
- **کانال تلگرام:** [@deadlock_persian](https://t.me/deadlock_persian)
- **وبسایت:** [deadlockpersian.ir](https://deadlockpersian.ir)
