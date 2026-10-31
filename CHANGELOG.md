# Changelog — DLPHub

All notable changes to **DLPHub** are documented in this file.

---

## [0.1.4] - 2026-10-09

[English](#english-014) | [فارسی](#فارسی-014)

---

<a name="english-014"></a>
### 🌐 English

#### 🚀 Highlights & New Features
* **New Preset: Russian Potato ("ذغالی روس"):**
  * Added a dedicated ultra-low-end performance preset featuring custom asset-reduction VPKs and aggressive engine LOD optimizations.
  * **Trooper Health Bar Fix:** Raised Panorama UI update framerate to 120 FPS (`panorama_max_fps "120"`), completely resolving the issue where minion/trooper health bars would fail to render.
  * **Particle & Ability FX Fixes:** Configured `r_particle_skip_postsim "0"`, `particle_cluster_nodraw "0"`, `r_particle_max_size_cull "0"`, and `r_directlighting "1"` so hero ability particles, weapon tracers, and beams (e.g. Bebop laser, Celest gun, projectile trails) remain fully visible during combat.
* **New Visual & HUD Mods:**
  * **Better Breakables ("دید راحت‌تر باکس و خفاش‌ها"):** Enhances visibility of breakable wooden loot crates and flying golden bats across the map without performance cost (`0 FPS` impact).
  * **Higher Brightness ("روشنایی بیشتر"):** Amplifies ambient lighting in darker corridors, alleys, and underground tunnels (`-FPS` low downgrade impact).
  * **Reduce Clutter ("کاهش شلوغی بصری"):** Strips away distracting debris, trash props, and non-essential ambient clutter for maximum frame pacing (`MAX` impact).
* **FOV & True Aspect Ratio Overhaul:**
  * Separated the in-game FOV control (`video.txt`, up to 90°) from the true aspect ratio override (`gameinfo.gi`).
  * Added fine-tuned Aspect Ratio slider (from `1.33` to `3.50`) with quick-select buttons for standard ratios:
    * `1.78` (16:9 standard)
    * `2.15` (90° FOV equivalent)
    * `2.33` (21:9 cinematic ultrawide)
    * `2.49` (100° FOV equivalent)
    * `3.09` (120° FOV equivalent)
  * Dedicated toggle to instantly enable/disable aspect ratio override back to default game behavior.
* **Physics & Animation Tweaks:**
  * Added toggle to stop CPU-heavy cloth simulations (`cloth_update "0"`, `cloth_sim_on_tick "0"`).
  * Added toggle to immediately fade dead hero ragdolls (`cl_ragdoll_limit "0"`), smoothing chaotic teamfights.
* **Latency & Server Routing Overhaul:**
  * **Live Valve Relay Ping Tester:** Real-time ICMP ping measurement across 8 official Valve regions with packet loss, jitter analysis, and sparkline latency graphs.
  * **DNS Benchmarker & Switcher:** 1-Click benchmarking and switching between 8 leading global and Iranian DNS providers.
  * **Server Blocker:** Integrated Windows Firewall IP filtering to block high-ping server regions.

#### 🎨 UI & UX Improvements
* **Individual FPS Impact Badges:** Added individual, color-coded badges to each HUD switch:
  * Better Breakables: `0 FPS` (`impact-none`, subtle white glow)
  * Higher Brightness: `-FPS` (`impact-downgrade`, amber neon)
  * Reduce Clutter: `MAX` (`impact-ultra`, purple neon)
  * Potato & Russian Potato: `MAX` (`impact-ultra`, purple neon)
* **Custom Tooltip Refinement:** Fixed tooltip translation mappings so hover descriptions properly display localized text (`FPS Impact: VeryHigh` / `تاثیر بر فریم‌ریت: بسیار زیاد`) instead of raw key names.
* **Icon Reversion:** Reverted the HUD box header icon to the classic heart pulse icon (`fa-heart-pulse`).
* **Bidirectional Layout:** Polished spacing and layout across both RTL (Persian) and LTR (English) display modes.

#### 🛠️ Engine & Core Improvements
* **Payload Isolation:** Renumbered internal addon packages to high slot allocations (`pak90`..`pak99`) so community mods (`pak01`..`pak89`) are never overwritten or touched.
* **Test Suite:** All 74 unit tests in `dlp-core` pass cleanly with zero regressions.

---

<a name="فارسی-014"></a>
### 🇮🇷 فارسی

#### 🚀 تغییرات کلیدی و امکانات جدید
* **پریست جدید: ذغالی روس (Russian Potato):**
  * اضافه شدن پریست گرافیکی فوق‌سبک اختصاصی با VPK فشرده بافت‌ها و بهینه‌سازی‌های سنگین LOD.
  * **رفع مشکل عدم نمایش جان مینیون‌ها:** افزایش سقف فریم‌ریت رابط کاربری Panorama به ۱۲۰ فریم (`panorama_max_fps "120"`) که مشکل ناپدید شدن نوار سلامت مینیون‌ها/تروپرها را به طور کامل برطرف کرد.
  * **اصلاح نمایش پارتیکل‌ها و تیرها:** تنظیم دستورات `r_particle_skip_postsim "0"`، `particle_cluster_nodraw "0"`، `r_particle_max_size_cull "0"` و `r_directlighting "1"` برای رندر کامل پارتیکل‌ها و تیرهای هیروها (مانند لیزر بیباپ، شلیک‌های سلست و اثر پرتابه‌ها).
* **مادهای جدید بصری و رابط کاربری (HUD):**
  * **دید راحت‌تر باکس و خفاش‌ها (Better Breakables):** متمایزسازی جعبه‌های چوبی لوت و خفاش‌های طلایی پرنده در آسمان برای فارم سریع‌تر (بدون افت فریم - `0 FPS`).
  * **روشنایی بیشتر (Higher Brightness):** افزایش نور محیط در راهروها و بخش‌های تاریک نقشه (`-FPS` افت جزئی).
  * **کاهش شلوغی بصری (Reduce Clutter):** حذف آوارها، زباله‌ها و آبجکت‌های تزیینی زمین برای دستیابی به حداکثر فریم‌ریت (`MAX` بیشترین تاثیر).
* **بهینه‌سازی کامل زاویه دید و نسبت تصویر (FOV & Aspect Ratio):**
  * تفکیک کامل زاویه دید بازی (`video.txt` تا ۹۰ درجه) از نسبت تصویر واقعی (`gameinfo.gi`).
  * اسلایدر تنظیم پیوسته نسبت تصویر از `1.33` تا `3.50` همراه با کلیدهای سریع:
    * `1.78` (استاندارد ۱۶:۹)
    * `2.15` (معادل زاویه دید ۹۰ درجه)
    * `2.33` (دید عریض سینمایی ۲۱:۹)
    * `2.49` (معادل زاویه دید ۱۰۰ درجه)
    * `3.09` (دید فوق‌عریض ۱۲۰ درجه)
  * کلید فعال/غیرفعال‌سازی سریع برای بازگشت به نسبت تصویر پیش‌فرض بازی.
* **تنظیمات فیزیک و انیمیشن:**
  * کلید توقف پردازش فیزیک لباس برای کاهش بار پردازنده (`cloth_update "0"`, `cloth_sim_on_tick "0"`).
  * کلید محو سریع اجساد کشته‌شده در فایت‌ها (`cl_ragdoll_limit "0"`).
* **پایش پینگ، DNS و مسیریابی شبکه:**
  * **تست زنده پینگ سرورها:** سنجش لحظه‌ای پینگ با ۸ منطقه سرور رسمی ولو همراه با نمودار اسپارک‌لاین، محاسبه نوسان (Jitter) و پکت‌لاس.
  * **تست و تغییر ۱ کلیکی DNS:** مقایسه پینگ و تغییر خودکار DNS بین ۸ ارائه‌دهنده مطرح ایرانی و خارجی (الکترو، شکن، ۴۰۳، رادار گیم، کلودفلر، گوگل و...).
  * **سرور بلاکر:** مسدودسازی سرورهای با پینگ بالا از طریق فایروال ویندوز با یک کلیک.

#### 🎨 بهبودهای رابط کاربری و طراحی (UI/UX)
* **نشانگرهای مجزای تاثیر بر فریم‌ریت (FPS Impact Badges):** برچسب‌های اختصاصی نئونی روی هر یک از گزینه‌های HUD:
  * دید راحت‌تر باکس و خفاش‌ها: `0 FPS` (سفید خنثی)
  * روشنایی بیشتر: `-FPS` (کهربایی)
  * کاهش شلوغی بصری: `MAX` (بنفش نئونی)
  * پریست‌های پوتیتو و ذغالی روس: `MAX` (بنفش نئونی)
* **اصلاح کامل متن تولتیپ‌ها:** رفع باگ نمایش نام خام متغیرها در هاور ماوس و نمایش صحیح متن ترجمه‌شده (`تاثیر بر فریم‌ریت: بسیار زیاد` / `FPS Impact: VeryHigh`).
* **بازگردانی آیکون بخش HUD:** بازگشت به آیکون ضربان قلب اورجینال (`fa-heart-pulse`).
* **پشتیبانی کامل از چیدمان فارسی و انگلیسی (RTL / LTR).**

#### 🛠️ بهینه‌سازی هسته و پکیج نصبی
* **ایزوله‌سازی اسلات مادها:** قرارگیری مادهای DLPHub در اسلات‌های بالا (`pak90` تا `pak99`) برای جلوگیری از هرگونه تداخل با مادهای شخصی کاربر (`pak01` تا `pak89`).
* **تست‌های واحد:** قبولی ۱۰۰٪ هر ۷۴ تست واحد در پکیج `dlp-core`.
