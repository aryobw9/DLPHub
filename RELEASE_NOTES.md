# DLPHub v0.1.4

## What's Changed
- **New Preset: Russian Potato ("ذغالی روس"):**
  - Added a dedicated ultra-low-end performance preset featuring custom asset-reduction VPKs and aggressive engine LOD optimizations.
  - **Trooper Health Bar Fix:** Raised Panorama UI update framerate to 120 FPS (`panorama_max_fps "120"`), resolving the issue where minion/trooper health bars failed to render.
  - **Particle & Ability FX Fixes:** Configured `r_particle_skip_postsim "0"`, `particle_cluster_nodraw "0"`, `r_particle_max_size_cull "0"`, and `r_directlighting "1"` so hero ability particles, weapon tracers, and beams (Bebop laser, Celeste gun, projectile trails) remain fully visible during combat.
- **New Visual & HUD Mods:**
  - **Better Breakables ("دید راحت‌تر باکس و خفاش‌ها"):** Enhances visibility of breakable wooden loot crates and flying golden bats across the map without performance cost (`0 FPS` impact).
  - **Higher Brightness ("روشنایی بیشتر"):** Amplifies ambient lighting in darker corridors, alleys, and underground tunnels (`-FPS` low downgrade impact).
  - **Reduce Clutter ("کاهش شلوغی بصری"):** Strips away distracting debris, trash props, and non-essential ambient clutter for maximum frame pacing (`MAX` impact).
- **FOV & True Aspect Ratio Overhaul:**
  - Separated in-game FOV control (`video.txt`, up to 90°) from the true aspect ratio override (`gameinfo.gi`).
  - Added fine-tuned Aspect Ratio slider (1.33 to 3.50) with quick-select presets (1.78, 2.15, 2.33, 2.49, 3.09) and an on/off toggle.
- **Physics & Animation Controls:**
  - Added toggle to stop CPU-heavy cloth simulations (`cloth_update "0"`, `cloth_sim_on_tick "0"`).
  - Added toggle to immediately fade dead hero ragdolls (`cl_ragdoll_limit "0"`).
- **Latency & Server Routing Overhaul:**
  - **Live Valve Relay Ping Tester:** Real-time ICMP ping measurement across 8 official Valve regions with packet loss, jitter analysis, and sparkline latency graphs.
  - **DNS Benchmarker & Switcher:** 1-Click benchmarking and switching between 8 leading global and Iranian DNS providers.
  - **Server Blocker:** Integrated Windows Firewall IP filtering to block high-ping server regions.
- **UI / UX Polish:**
  - Added individual color-coded FPS impact badges to each HUD switch and presets (`None`, `Low`, `Medium`, `High`, `VeryHigh / MAX`, `Downgrade / -FPS`).
  - Fixed tooltip hover text localization (`FPS Impact: VeryHigh` / `تاثیر بر فریم‌ریت: بسیار زیاد`).
  - Reverted HUD box header icon to `fa-heart-pulse`.

---

## تغییرات نسخه ۰.۱.۴
- **پریست جدید: ذغالی روس (Russian Potato):**
  - اضافه شدن پریست گرافیکی فوق‌سبک اختصاصی با VPK فشرده بافت‌ها و بهینه‌سازی‌های سنگین LOD.
  * **رفع مشکل عدم نمایش جان مینیون‌ها:** افزایش سقف فریم‌ریت رابط کاربری Panorama به ۱۲۰ فریم (`panorama_max_fps "120"`) که مشکل ناپدید شدن نوار سلامت مینیون‌ها/تروپرها را به طور کامل برطرف کرد.
  * **اصلاح نمایش پارتیکل‌ها و تیرها:** تنظیم دستورات `r_particle_skip_postsim "0"`، `particle_cluster_nodraw "0"`، `r_particle_max_size_cull "0"` و `r_directlighting "1"` برای رندر کامل پارتیکل‌ها و تیرهای هیروها (مانند لیزر بیباپ، شلیک‌های سلست و اثر پرتابه‌ها).
- **مادهای جدید بصری و رابط کاربری (HUD):**
  - **دید راحت‌تر باکس و خفاش‌ها (Better Breakables):** متمایزسازی جعبه‌های چوبی لوت و خفاش‌های طلایی پرنده در آسمان برای فارم سریع‌تر (بدون افت فریم - `0 FPS`).
  - **روشنایی بیشتر (Higher Brightness):** افزایش نور محیط در راهروها و بخش‌های تاریک نقشه (`-FPS` افت جزئی).
  - **کاهش شلوغی بصری (Reduce Clutter):** حذف آوارها، زباله‌ها و آبجکت‌های تزیینی زمین برای دستیابی به حداکثر فریم‌ریت (`MAX` بیشترین تاثیر).
- **بهینه‌سازی کامل زاویه دید و نسبت تصویر (FOV & Aspect Ratio):**
  - تفکیک کامل زاویه دید بازی (`video.txt` تا ۹۰ درجه) از نسبت تصویر واقعی (`gameinfo.gi`).
  - اسلایدر تنظیم پیوسته نسبت تصویر از `1.33` تا `3.50` همراه با کلیدهای سریع (1.78, 2.15, 2.33, 2.49, 3.09) و کلید روشن/خاموش.
- **تنظیمات فیزیک و انیمیشن:**
  - کلید توقف پردازش فیزیک لباس برای آزادسازی توان پردازنده (`cloth_update "0"`, `cloth_sim_on_tick "0"`).
  - کلید محو سریع اجساد کشته‌شده در فایت‌ها (`cl_ragdoll_limit "0"`).
- **پایش پینگ، DNS و مسیریابی شبکه:**
  - **تست زنده پینگ سرورها:** سنجش لحظه‌ای پینگ با ۸ منطقه سرور رسمی ولو همراه با نمودار اسپارک‌لاین، محاسبه نوسان (Jitter) و پکت‌لاس.
  - **تست و تغییر ۱ کلیکی DNS:** مقایسه پینگ و تغییر خودکار DNS بین ۸ ارائه‌دهنده مطرح ایرانی و خارجی.
  - **سرور بلاکر:** مسدودسازی سرورهای با پینگ بالا از طریق فایروال ویندوز با یک کلیک.
- **بهبودهای طراحی و رابط کاربری (UI/UX):**
  - نشانگرهای مجزای نئونی تاثیر بر فریم‌ریت (FPS Impact Badges) برای گزینه‌های HUD و پریست‌ها.
  - رفع مشکل نمایش متن تولتیپ‌ها هنگام هاور ماوس.
  - بازگردانی آیکون ضربان قلب (`fa-heart-pulse`) در هدر بخش HUD.
