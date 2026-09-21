# DLPHub v0.1.0 — Official Initial Release

Welcome to the initial public open-source release of **DLPHub**, the high-performance graphics optimizer and utility suite for Valve's **Deadlock**!

---

## 🚀 Key Features & Highlights

### 🎮 4 Performance Presets
* **Tier 1 (High Graphics):** Optimal visual fidelity with maximum frametime stability for modern gaming PCs.
* **Tier 2 (Medium Graphics):** Balanced configuration delivering clear visibility with noticeable framerate gains.
* **Tier 3 (Low Graphics / Max FPS):** Aggressively tuned for competitive players seeking the lowest possible frametimes and maximum FPS in chaotic teamfights.
* **POTATO Mode:** Custom-packaged VPK optimization presets tailored for low-spec laptops and older GPUs.

### ⚡ 3-Way Rendering API Switch
* Seamlessly toggle between **DirectX 11**, **Default**, and **Vulkan**.
* Solves driver-specific crashes, eliminates micro-stuttering, and optimizes frametimes across NVIDIA, AMD, and Intel GPUs.

### 👁️ Precision FOV Control
* Adjust camera Field of View from **70° to 120°** in 5° increments.
* Supports **mouse-wheel scrolling** directly over the FOV card.
* Click **`DEFAULT · 90°`** to instantly snap back to the vanilla view angle.

### 🌐 Live Valve Relay Network Diagnostics
* Real-time ICMP ping measurement across **8 official Valve relay regions**:
  * Frankfurt, Vienna, Dubai, Stockholm, Warsaw, Amsterdam, London, and US East (Virginia).
* Comprehensive telemetry including average ping, jitter (mean deviation), packet loss %, stability rating, and live SVG sparkline history.

### ⏱️ Engine & Framerate Tuning
* **10-Step FPS Limiter:** Choose between **DEFAULT**, **45**, **60**, **75**, **90**, **144**, **165**, **245**, **320**, or **Unlimited (∞ / 0)**.
* **Launch Options Helper:** One-click copy buttons for `-dx11`, `-vulkan`, and `-high` with interactive tooltip guides.
* **HUD Unit Status Switch:** Quick toggle for the updated Citadel health bar visual style (`citadel_unit_status_use_new`).

### 🛡️ Smart Backup & Safe Revert
* **15-Backup Retention:** Automatically archives up to 15 backups with disk space usage calculations.
* **Permanent Baseline Protection:** Original game files (`.dlp.bak`) are preserved on the first run; the initial vanilla baseline cannot be deleted.
* **1-Click Revert:** Completely uninstall all presets and mods, cleanly restoring your game files to pure vanilla state.
* **Process Guard:** Automatically blocks modifications while Deadlock is running to prevent file corruption.

### 🔍 System Diagnostics & Rotating Logger
* Built-in rotating logs in `%APPDATA%\DLPHub\logs\app.log`.
* **Copy Diagnostics:** Single-click copy of system hardware info, Deadlock path, active tier, backup inventory, and recent log traces.

### 📜 Open Source & Free
* Licensed under the **GNU General Public License v3.0 (GPLv3)**.
* Completely free, open-source, and 100% VAC-safe (modifies only official Source 2 text configs and CVars).

### 🛡️ Security & VirusTotal Transparency Report
* **VirusTotal Result:** [68/70 Vendors Clean (Verified Safe)](https://www.virustotal.com/gui/file/c519c55ecdff5cedac66611f44b182c0cc216df327fab6dca2a7faf2c3e7f925?nocache=1)
* **Verified Clean:** Microsoft Defender, Kaspersky, Bitdefender, ESET, Sophos, Malwarebytes, Avast, and Symantec confirm 0 threats.
* The 2 heuristic flags are routine false positives caused by the single-binary self-extractor (`%TEMP%\DLPHubPkg`) and Win32 border subclassing APIs on an un-signed open-source release.
* **100% VAC-Safe:** Modifies only official Valve configuration files; zero memory injection or process hooking.
* Built directly and transparently via [GitHub Actions CI/CD](https://github.com/aryobw9/DLPHub/actions).

---

## 💾 Installation & Usage
1. Download **`DLPHub.exe`** below.
2. Run `DLPHub.exe` (no installation required; portable standalone executable).
3. Select your desired graphics tier, rendering engine, and options.
4. Click **"APPLY TO DEADLOCK"** and launch the game!

---

## 🇮🇷 فارسی

نسخه رسمی **DLPHub v0.1.0** منتشر شد!  
ابزار بهینه‌ساز تخصصی، سبک و کاملاً رایگان بازی **Deadlock** با هدف افزایش نرخ فریم و حذف لگ‌های استاتیک.

### ویژگی‌های کلیدی:
* **۴ پروفایل گرافیکی اختصاصی** (تییر ۱، ۲، ۳ و حالت اختصاصی ذغالی/POTATO).
* **سوییچ سریع میان موتورهای گرافیکی** (DirectX 11 / پیش‌فرض / Vulkan).
* **اسلایدر دقیق زاویه دید (FOV)** از ۷۰ تا ۱۲۰ درجه همراه با پشتیبانی از چرخ ماوس و بازنشانی سریع با کلیک روی DEFAULT.
* **پینگ‌چکر زنده سرورهای ولو** با اندازه‌گیری تاخیر ۸ ریجن رسمی ولو همراه با نوسان (Jitter) و پکت‌لاس.
* **۱۰ حالت محدودیت فریم‌ریت (FPS Limit)** از ۴۵ تا نامحدود (∞).
* **دکمه‌های کپی سریع Launch Options** برای `-dx11`، `-vulkan` و `-high`.
* **سیستم بکاپ هوشمند و بازگردانی سریع (Revert Vanilla)** به حالت اولیه بازی بدون نگرانی از دست رفتن فایل‌ها.
* **تک‌فایل پرتابل و سبک (`DLPHub.exe`)** بر پایه Rust و Tauri؛ بدون نیاز به نصب و ۱۰۰٪ ایمن (VAC-Safe).
* **گزارش شفافیت و بررسی VirusTotal:** [۶۸ از ۷۰ آنتی‌ویروس کاملاً پاک](https://www.virustotal.com/gui/file/c519c55ecdff5cedac66611f44b182c0cc216df327fab6dca2a7faf2c3e7f925?nocache=1) (تأیید سلامت توسط Defender، Kaspersky، Bitdefender، ESET و...). ۲ مورد هشدار مربوط به اکسترکت فایل موقت پرتابل و عدم وجود امضای تجاری است.
* **تحت مجوز آزاد GNU GPLv3**.
