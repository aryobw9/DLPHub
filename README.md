# DLPHub
> **Professional Optimization Suite & Toolkit for Valve's Deadlock**  
> **بهینه‌ساز تخصصی و جعبه‌ابزار بازی Deadlock**

[English](#english) | [فارسی](#فارسی)

---

<a name="english"></a>
## English

**DLPHub** is a high-performance, open-source utility designed to maximize framerates, eliminate micro-stutters, and streamline graphic and engine configuration for Valve's **Deadlock** with zero manual friction.

### Why DLPHub?
Deadlock is actively developed on the Source 2 engine. Players frequently face sudden frame drops, severe stuttering in chaotic teamfights, and suboptimal GPU/CPU utilization. Manually editing and maintaining hundreds of console commands across configuration files (`video.txt`, `autoexec.cfg`, `gameinfo.gi`) is error-prone, tedious, and often gets overwritten by weekly game updates.

**DLPHub** automates the entire process in one click, extracting maximum performance from your hardware while safeguarding your original game files and personal settings.

---

### Key Features

#### 🎮 4 Dedicated Graphics Presets
- **Tier 1 (High Graphics):** Conservative visual cuts for the highest visual fidelity with competitive framerate stability.
- **Tier 2 (Medium Graphics):** The balanced profile, offering an optimal trade-off between visual clarity and high FPS.
- **Tier 3 (Low Graphics / Max FPS):** Aggressive texture, effect, and particle cuts engineered for maximum competitive framerates.
- **POTATO Mode:** Extreme low-spec configuration with standalone optimization VPKs, allowing Deadlock to run smoothly on low-end laptops and older hardware.

#### ⚡ 3-Way Rendering API Switch (DirectX 11 / Default / Vulkan)
- One-click toggle between **DirectX 11**, **Default**, and **Vulkan**.
- Alleviates driver-specific crashes, eliminates frame pacing hitches, and stabilizes frametimes across NVIDIA, AMD, and Intel GPUs.
- Automatically passed to the game when launched via the built-in Play button or Steam.

#### 👁️ Custom Field of View (FOV) Slider
- Adjust your horizontal camera FOV from **70° to 120°** in 5° increments.
- Interactive mouse-wheel scrolling directly over the FOV box.
- One-click reset back to default **90°** via the `DEFAULT · 90°` tick.

#### 🌐 Built-In Valve Relay Network Ping Tester
- Real-time ICMP ping measurement across 8 official Valve server regions:
  - **Frankfurt** (Europe West)
  - **Vienna** (Europe East)
  - **Dubai** (Middle East)
  - **Stockholm** (Europe North)
  - **Warsaw** (Europe Central)
  - **Amsterdam** (Europe West)
  - **London** (Europe West)
  - **US East - Virginia** (North America)
- Comprehensive route telemetry: average ping, jitter (mean deviation), packet loss %, and a route stability score.
- Highlights the **RECOMMENDED BEST ROUTE** with an integrated sparkline latency history graph.

#### ⏱️ Framerate Limit & Engine Controls
- **10-Step FPS Limit:** Select between **DEFAULT**, **45**, **60**, **75**, **90**, **144**, **165**, **245**, **320**, or **Unlimited (∞ / 0)**. Applied cleanly to `video.txt` and synced with `autoexec.cfg`.
- **Launch Options Buttons:** One-click copy buttons for `-dx11`, `-vulkan`, and `-high`, complete with informative hover tooltips.
- **HUD Unit Status Switch:** Toggle the modern Citadel unit status and health bar style (`citadel_unit_status_use_new`).

#### 🛡️ Smart Backup, Restore & Revert
- **Automated Retention:** Automatically maintains up to 15 backups with disk usage tracking per snapshot.
- **Baseline Protection:** Permanently preserves your original unmodded game files (`.dlp.bak`) on the first run; the initial baseline backup can never be deleted accidentally.
- **One-Click Revert:** Cleanly uninstall all presets and mods, returning your game installation to 100% vanilla state.
- **Process Guard:** Prevents applying configs while Deadlock is running to eliminate file corruption risks.

#### 🔍 Diagnostics & Rotating Logger
- Built-in rotating log saved to `%APPDATA%\DLPHub\logs\app.log`.
- **Copy Diagnostics:** Single-click export of system info, Deadlock install path, active profile, backup records, and recent logs for fast assistance.

---

### Technical Highlights
- **Ultra-Lightweight (Rust + Tauri v2):** Near-instant startup, negligible CPU consumption, and a heavily optimized WebView2 memory footprint (~64MB heap cap).
- **Single Standalone Portable Executable:** Zero installation required, zero registry tampering, zero background services.
- **100% VAC-Safe:** Modifies only official Source 2 configuration files and console variables (CVars). No memory injection, no binary hooking.
- **Free & Open Source:** Licensed under the **GNU General Public License v3.0 (GPLv3)**.

---

### How to Use in 3 Steps
1. Download `DLPHub.exe` from the latest release and run it (Deadlock is auto-detected).
2. Choose your preferred graphics tier, rendering API, FOV, and options.
3. Click **"APPLY TO DEADLOCK"** and launch the game!

---

<a name="فارسی"></a>
## فارسی

**DLPHub** یک ابزار بهینه‌ساز تخصصی، متن‌باز و سبک برای بازی **Deadlock** است که با هدف افزایش چشمگیر نرخ فریم، حذف کامل لگ‌ها و استاترهای ناگهانی و بهینه‌سازی تنظیمات گرافیکی توسعه یافته است.

### چرا DLPHub؟
بازی Deadlock به دلیل توسعه مداوم روی موتور Source 2، برای بسیاری از بازیکنان با افت فریم سنگین در فایت‌ها، لگ‌های استاتیک و فشار نامتعادل روی CPU و کارت گرافیک همراه است. تنظیم دستی صدها دستور در فایل‌های کانفیگ (`video.txt`, `autoexec.cfg`, `gameinfo.gi`) دشوار و وقت‌گیر است و با آپدیت‌های هفتگی بازی پاک یا خراب می‌شود.

**DLPHub** این فرآیند را به صورت کاملاً خودکار و با یک کلیک انجام می‌دهد؛ بیشترین فریم ممکن را از سخت‌افزار شما استخراج کرده و از فایل‌های اصلی بازی محافظت می‌کند.

---

### امکانات کلیدی نرم‌افزار

#### 🎮 ۴ پروفایل گرافیکی اختصاصی
- **تییر ۱ (گرافیک بالا):** بهینه‌سازی ملایم با حفظ حداکثری کیفیت بصری و ثبات کامل فریم‌ریت.
- **تییر ۲ (متعادل):** توازن ایده‌آل میان شفافیت و وضوح تصویر با افزایش محسوس نرخ فریم.
- **تییر ۳ (گرافیک پایین / بیشترین فریم):** کاهش هوشمند بافت‌ها، ذرات و افکت‌های اضافی جهت دستیابی به بالاترین FPS در مسابقات رقابتی.
- **حالت ذغالی (POTATO):** تنظیمات فوق‌العاده سبک با پکیج‌های اختصاصی VPK جهت اجرای روان روی لپ‌تاپ‌های ضعیف و سیستم‌های قدیمی.

#### ⚡ سوئیچ سریع رندرر (DirectX 11 / پیش‌فرض / Vulkan)
- سوییچ سریع میان **DirectX 11**، **پیش‌فرض** و **Vulkan**.
- رفع کرش‌های درایور، حذف لگ‌های فریم‌تایم و ایجاد تجربه‌ای روان‌تر متناسب با کارت‌های NVIDIA، AMD و Intel.
- اعمال خودکار هنگام اجرای بازی از طریق استیم.

#### 👁️ اسلایدر اختصاصی زاویه دید (FOV)
- تنظیم زاویه دید از **۷۰ تا ۱۲۰ درجه** با گام‌های ۵ تایی.
- امکان اسکرول مستقیم با چرخ ماوس (Mouse Wheel) روی کادر FOV.
- بازنشانی سریع به زاویه دید پیش‌فرض با کلیک روی گزینه **`DEFAULT · 90°`**.

#### 🌐 تست زنده پینگ رله‌های سرور ولو
- اندازه‌گیری دقیق تاخیر با ۸ منطقه سرور رسمی ولو:
  - **فرانکفورت** (غرب اروپا)
  - **وین** (شرق اروپا)
  - **دبی** (خاورمیانه)
  - **استکهلم** (شمال اروپا)
  - **ورشو** (مرکز اروپا)
  - **آمستردام** (غرب اروپا)
  - **لندن** (غرب اروپا)
  - **شرق آمریکا - ویرجینیا** (آمریکای شمالی)
- تله‌متری پیشرفته شامل میانگین پینگ، نوسان (Jitter)، درصد پکت‌لاس و امتیاز پایداری مسیر.
- مشخص کردن **بهترین مسیر پیشنهادی** با نمودار اسپارک‌لاین زنده.

#### ⏱️ تنظیمات فریم‌ریت و موتور بازی
- **۱۰ گزینه محدودیت نرخ فریم (FPS Limit):** امکان انتخاب بین **DEFAULT**، **۴۵**، **۶۰**، **۷۵**، **۹۰**، **۱۴۴**، **۱۶۵**، **۲۴۵**، **۳۲۰** یا **نامحدود (∞ / 0)**.
- **دکمه‌های کپی Launch Options:** کپی با یک کلیک برای گزینه‌های `-dx11`، `-vulkan` و `-high` همراه با توضیحات راهنما هنگام هاور ماوس.
- **نوارهای سلامت جدید (Health Bars):** فعال/غیرفعال‌سازی نوارهای خون به‌روزشده هیروها و یونیت‌ها (`citadel_unit_status_use_new`).

#### 🛡️ سیستم بکاپ هوشمند و بازگردانی سریع
- **نگهداری تا ۱۵ بکاپ:** مدیریت خودکار نسخه‌های پشتیبان با نمایش دقیق حجم دیسک اشغال‌شده.
- **حفظ دائمی فایل‌های اصلی:** ذخیره دائمی اسنپ‌شات‌های اورجینال (`.dlp.bak`) در اولین اجرا؛ بکاپ اولیه به هیچ وجه به اشتباه حذف نخواهد شد.
- **بازگردانی کامل (Revert Vanilla):** بازگشت ۱۰۰٪ به فایل‌های اورجینال استیم و حذف تمام مادها با یک کلیک.
- **گارد محافظ پروسه:** جلوگیری هوشمند از اعمال تنظیمات هنگام باز بودن ددلاک جهت حفظ سلامت فایل‌ها.

#### 🔍 گزارش عیب‌یابی و لاگر سیستمی
- لاگ فایل چرخشی در مسیر `%APPDATA%\DLPHub\logs\app.log`.
- **دکمه کپی گزارش عیب‌یابی (Copy Diagnostics):** کپی یکپارچه مشخصات سیستم، مسیر بازی، وضعیت بکاپ‌ها و لاگ‌ها در کلیپ‌بورد.

---

### راهنمای استفاده در ۳ گام ساده
1. فایل `DLPHub.exe` را دانلود و اجرا کنید (مسیر نصب بازی به صورت خودکار شناسایی می‌شود).
2. پروفایل گرافیکی، رندرر دلخواه (DX11 / Vulkan / Default)، زاویه دید (FOV) و گزینه‌های مدنظرتان را انتخاب کنید.
3. دکمه **«اعمال روی ددلاک»** را بزنید و بازی را اجرا کنید!

---

### مشخصات فایل
- **نام فایل:** `DLPHub.exe` (Portable)
- **نسخه:** `0.1.0`
- **مجوز نرم‌افزار:** GNU General Public License v3.0 (GPLv3)
- **پیش‌نیاز:** ویندوز ۱۰ یا ۱۱ (۶۴ بیتی) + مایکروسافت WebView2
- **توسعه‌دهنده:** [aryobw9](https://github.com/aryobw9)
- **کانال تلگرام:** [@deadlock_persian](https://t.me/deadlock_persian)
- **وبسایت:** [deadlockpersian.ir](https://deadlockpersian.ir)
