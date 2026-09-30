# DLPHub v0.1.3

## What's Changed
- **New Generation Config Presets:** Upgraded all graphics tiers (T1, T2, T3) to the latest Deadlock engine architecture based on OptimizationLock v3.2.1 and modern competitive benchmarks (over 300+ optimized ConVars).
- **Modern Subsystem Optimizations:**
  - **Panorama & V8 Engine:** Doubled V8 JavaScript heap to 1024MB and enabled aggressive UI caching to eliminate in-fight HUD micro-stuttering.
  - **SteamAudio DSP Bypass:** Streamlined audio raycasting passes and enclosure calculations to reduce audio thread CPU bottlenecks.
  - **Multithreaded Spatial Partitioning:** Enabled parallel spatial bounds updates, parallel physics invalidation, and reduced simulation cadence latency.
  - **Dynamic Particle Load-Shedding:** Intelligently drops particle detail during chaotic teamfights to preserve framerate stability.
  - **Mouse Responsiveness:** Disabled camera viewmodel smoothing for raw, snappy input response.
- **Gameplay Integrity Maintained:** Ability ground decals (Lash Ground Slam, Warden Binding Cage, bullet hits), hero outlines, and colored hero shop portraits remain visible and clear.
- **Potato Mode & HUD New Health Bar Temporarily Retired:** The Potato preset and HUD New Health Bar options have been replaced with a "Coming Soon..." placeholder pending community mod and engine compatibility with the latest game patch.
- **Custom Match ID Auto-Sync:** Integrated console log match detection and customizable webhook reporting API.

---

## تغییرات نسخه ۰.۱.۳
- **نسل جدید پریست‌های بهینه‌سازی:** ارتقای تمامی سطوح گرافیکی (T1، T2، T3) بر پایه آخرین تغییرات موتور ددلاک و تنظیمات بهینه‌سازی OptimizationLock v3.2.1 (بیش از ۳۰۰ متغیر ConVar بهینه‌سازی شده).
- **بهینه‌سازی زیرسیستم‌های مدرن سورس ۲:**
  - **موتور V8 و رابط کاربری Panorama:** دو برابر کردن حافظه جاوااسکریپت رابط کاربری (۱۰۲۴ مگابایت) و فعال‌سازی کش لایه‌ها جهت حذف لگ‌های ریز در درگیری‌های سنگین.
  - **بهینه‌سازی پردازش صوتی SteamAudio:** سبک‌سازی محاسبات بازتاب و اکوی صدا برای آزادسازی منابع پردازنده (CPU).
  - **چندرشته‌ای‌سازی محاسبات موتور بازی:** بهینه‌سازی پارتیشن‌بندی فضایی، ابطال فیزیک موازی و بهبود Cadence فریم‌ها.
  - **کاهش پویای بار افکت‌ها و ذرات:** کاهش خودکار کیفیت ذرات و افکت‌ها در شلوغی فایت‌ها به منظور حفظ پایداری فریم‌ریت.
  - **واکنش‌پذیری ماوس:** حذف نرم‌کننده دید و انیمیشن برای ثبت دقیق‌تر و بدون تاخیر حرکت ماوس.
- **حفظ نشانگرهای حیاتی گیم‌پلی:** خطوط روی زمین ابیلیتی‌ها (مانند اسلم Lash و قفس Warden)، کادربندی دور هیروها و رنگ پرتره هیروها در شاپ کاملاً حفظ شده‌اند.
- **حالت ذغالی (Potato) و نوار سلامتی جدید HUD به زودی:** پریست ذغالی و گزینه نوار سلامتی جدید به دلیل تغییرات کلاینت بازی موقتاً با نشانگر «به زودی...» جایگزین شده‌اند تا آپدیت‌های هماهنگ آماده شوند.
- **سینک خودکار Match ID:** شناسایی هوشمند شناسه بازی‌های کاستوم از لاگ و قابلیت ارسال به وب‌هوک و API دلخواه.
