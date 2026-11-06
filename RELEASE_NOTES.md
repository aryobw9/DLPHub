# DLPHub v0.1.6

## What's Changed
- **New Graphics Configuration Workflow:** Re-architected graphic and performance configuration presets with streamlined customization and real-time tier detection.
- **User Authentication & Profile System:** Integrated user login, Steam / Deadlock profile sync, MMR stats display, and custom user session states.
- **Full Mod & Preset Compatibility Update:** Updated and aligned all performance presets and internal VPK mods (including Level 2 mods, Potato graphics, and Hero Potato) to ensure full compatibility with the latest Deadlock game patch.
- **Resilient Resumable Mod Downloads:** Added HTTP Range resumption and automatic 5-attempt retry loop to prevent downloads from dropping on slow or unstable connections.
- **Process Detection & Error Screen Polish:** Removed Deadlock Mod Manager from process lock checks to eliminate false-positive "Deadlock is running" errors, and corrected modal titles for network and download failures.
- **UI & Localization Refinements:** Cleaned up Persian localization terms (simplified Hero Potato label to "هیرو ذغالی"), adjusted preset card heights to eliminate text overlapping, and polished UI stability.

---

## تغییرات نسخه ۰.۱.۶
- **شیوه جدید و پیشرفته تنظیم گرافیک:** بازطراحی کامل ساختار انتخاب و اعمال تنظیمات گرافیکی با رابط کاربری روان‌تر و هماهنگی دقیق‌تر با موتور بازی.
- **سیستم ورود و پروفایل کاربری:** اضافه شدن بخش حساب کاربری، همگام‌سازی اطلاعات و استتس‌های ددلاک، وضعیت رنک/MMR و شخصی‌سازی پروفایل.
- **بروزرسانی جامع تمامی مادها و پریست‌های گرافیکی:** هماهنگ‌سازی و آپدیت کامل تمام پکیج‌های VPK، پریست‌های بهینه‌سازی و حالت‌های ذغالی (Potato Mode و هیرو ذغالی) متناسب با آخرین آپدیت بازی ددلاک.
- **دانلود پایدار و ادامه‌دار (Resumable):** رفع مشکل قطعی دانلود در اینترنت‌های با سرعت پایین با قابلیت ادامه دانلود (Range) و سیستم تلاش مجدد خودکار.
- **اصلاح تشخیص اجرای بازی و عناوین خطا:** حذف برنامه Deadlock Mod Manager از لیست بررسی بستن بازی برای جلوگیری از ارورهای اشتباه و تفکیک دقیق پیام‌ها و عناوین پنجره‌های خطا.
- **بهبودهای ظاهری و ترجمه:** اصلاح و ساده‌سازی عبارات در نسخه فارسی (تغییر عنوان به «هیرو ذغالی»)، افزایش ارتفاع کارت‌های گرافیک برای جلوگیری از تداخل متن‌ها، رفع باگ‌های جزئی ظاهری و بهبود پایداری برنامه.
