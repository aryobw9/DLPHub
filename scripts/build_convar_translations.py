import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('ui/assets/catalog.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

presets = data.get('presets', [])
all_cvars = set()
for p in presets:
    for e in p.get('entries', []):
        if e.get('path') and len(e['path']) >= 2:
            all_cvars.add(e['path'][1].lower())

convars_map = {c['name'].lower(): c for c in data.get('convars', []) if 'name' in c}

BESPOKE_FA = {
    # Aspect Ratio & Camera
    'r_aspectratio': 'نسبت تصویر بازی ددلاک (gameinfo.gi)',
    'citadel_camera_hero_fov': 'زاویه دید پیش‌فرض دوربین هنگام کنترل هیرو (FOV)',
    'cl_camera_fov_scale': 'مقیاس تغییر زاویه دید هنگام استفاده از ابیلیتی‌ها',
    'citadel_camera_height': 'ارتفاع دید عمودی دوربین هیرو',
    'citadel_camera_height_ceiling_distance': 'فاصله سقف و مانع برای جلوگیری از گیر کردن دوربین',
    'citadel_camera_wobble_disable': 'حذف لرزش و تکان دوربین هنگام دویدن و اسپرینت',
    'citadel_melee_shake_duration': 'مدت زمان لرزش صفحه در ضربات مشت میلی',
    'citadel_melee_shake_amplitude': 'شدت لرزش صفحه در اثر اصابت ضربات میلی سنگین',
    'citadel_camera_soft_collision': 'نرم‌سازی برخورد دوربین با دیوارها و گوشه‌ها',
    'citadel_camera_soft_collision_angle': 'زاویه مخروط تشخیص برخورد نرم دوربین با دیوار',
    'citadel_camera_use_vmdl_flatten_horizontal': 'کاهش حرکات افقی دوربین برای جلوگیری از سرگیجه و Motion Sickness',
    'citadel_camera_use_vmdl_flatten_vertical': 'تثبیت محور عمودی دوربین هیرو برای حرکت نرم‌تر',
    'citadel_tightcamera_alternative': 'حالت جایگزین دوربین فشرده هنگام نبرد در فضاهای بسته',

    # Troopers & Bosses & Combat
    'citadel_trooper_glow_disabled': 'غیرفعال‌سازی هاله نوری دور تروپرها (افزایش فریم در درگیری لین)',
    'citadel_trooper_friendly_glow_disabled': 'غیرفعال‌سازی هاله دور تروپرهای خودی در لین',
    'citadel_trooper_outline_enabled': 'نمایش خطوط دور تروپرها (Outline) برای تشخیص بهتر در لین',
    'citadel_minimap_trooper_size': 'اندازه نمایش آیکون تروپرها روی مینی‌مپ',
    'citadel_boss_glow_disabled': 'غیرفعال‌سازی هاله نوری دور میدباس و واکرها',
    'citadel_hud_objective_health_debug_show_midboss': 'نمایش دائمی نوار سلامت میدباس روی صفحه',
    'citadel_hud_objective_health_enabled': 'نمایش نوار سلامت پایگاه‌ها (شراین، پترون، میدباس و واکرها)',
    'citadel_hud_objective_health_idle_timeout': 'مدت زمان پنهان شدن نوار سلامت آبجکتیوها پس از اتمام درگیری',
    'citadel_damage_offscreen_indicator_disabled': 'مخفی کردن نشانگر آسیب دشمنانی که خارج از دید هستند',
    'citadel_damage_text_batching_window_ability': 'تجمیع ارقام دمیج ابیلیتی‌ها در بازه زمانی کوتاه',
    'citadel_damage_text_lifetime': 'مدت زمان باقی‌ماندن اعداد دمیج روی صفحه',
    'citadel_damage_text_lifetime_new': 'مدت زمان نمایش مجموع دمیج‌های وارد شده',
    'citadel_player_outline_enemies': 'خطوط متمایز دور هیروهای دشمن (Enemy Outline)',
    'citadel_unit_status_allies_see_thru_walls': 'نمایش نوار سلامت هم‌تیمی‌ها از پشت موانع و دیوارها',
    'citadel_unit_status_delta_decay_delay': 'تأخیر محو شدن انیمیشن آسیب روی نوار سلامت هیرو',
    'citadel_unit_status_delta_decay_rate': 'سرعت محو شدن اثر دمیج دریافتی روی نوار سلامت',
    'citadel_unit_status_single_bar_mode': 'حالت تک‌خطی نوار سلامت بدون چندلایه‌شدن',
    'citadel_death_ragdoll_duration': 'مدت زمان باقی‌ماندن جسد هیروها پس از کشته شدن (فیزیک رگ‌دال)',
    'citadel_npc_disable_cockroaches': 'غیرفعال‌سازی سوسک‌ها و موجودات تزیینی مپ برای افزایش فریم',
    'citadel_zipline_render_mode': 'حالت رندر و جلوه‌های بصری خطوط زیپ‌لاین (مدل/ذرات)',
    'citadel_portrait_world_renderer_off': 'غیرفعال‌سازی رندر ۳بعدی مدل هیروها در شاپ و صفحه پایان بازی',
    'citadel_per_weapon_per_surface_impact_effects': 'افکت اصابت گلوله‌های هر اسلحه متناسب با نوع سطح',
    'citadel_player_model_force_highest_lod': 'اجبار بالاترین سطح جزئیات برای مدل هیروی خود بازیکن',
    'citadel_use_pvs_for_players': 'پردازش انتخابی هیروها بر اساس دید مستقیم برای کاهش بار CPU',

    # Shadows & Lighting
    'r_shadows': 'پردازش و نمایش سایه‌ها در صحنه',
    'r_csm_enable': 'سیستم سایه‌های متوالی آبشاری (CSM)',
    'r_csm_resolution': 'رزولوشن بافت سایه‌های تابشی خورشید',
    'r_csm_max_distance': 'حداکثر فاصله رسم و محاسبه سایه‌های داینامیک',
    'r_csm_viewmodel_shadows': 'نمایش سایه اسلحه و دست هیرو روی محیط',
    'r_csm_atlas_size': 'اندازه بافت اطلس سایه‌ها در حافظه ویدیویی',
    'r_citadel_gpu_culling_shadows': 'حذف سایه‌های خارج از کادر توسط کارت گرافیک (GPU Cull)',
    'r_citadel_distancefield_ao_quality': 'کیفیت سایه‌زنی عمق محیطی میدان فاصله (Distance Field AO)',
    'r_citadel_ssao_denoise_passes': 'تعداد مراحل فیلتر و حذف نویز از سایه‌زنی محیطی (SSAO)',
    'r_citadel_ssao_thin_occluder_compensation': 'بهبود سایه‌زنی اجسام باریک مانند کابل‌ها و نرده‌ها',
    'lb_cull_offscreen_bounce_light_shadows': 'حذف سایه‌های بازتابی خارج از صفحه برای افزایش فریم',
    'lb_barnlight_shadowmap_scale': 'مقیاس کیفیت سایه چراغ‌ها و نورهای متمرکز محیط',
    'lb_csm_override_staticgeo_cascades_animated_verts': 'بهینه‌سازی سایه‌های استاتیک آبشاری برای هندسه متحرک',
    'r_light_flickering_enabled': 'افکت چشمک‌زدن و نوسان نور لامپ‌ها و چراغ‌های مپ',
    'r_lightmap_bicubic_filtering': 'فیلترینگ دو‌مکعبی نرم روی بافت‌های نوری مپ',
    'r_ssao': 'سایه‌زنی انسداد محیطی فضای صفحه (SSAO)',
    'r_volumetric_fog': 'پردازش و رندر مه و اتمسفر حجمی در آسمان و مپ',
    'r_subsurface_scattering': 'پراکندگی زیرسطحی نور روی پوست و لباس هیروها (SSS)',

    # Particles & Effects
    'r_particles': 'کیفیت و تعداد ذرات و جلوه‌های ویژه جادوها (Particles)',
    'r_drawparticles': 'رندر و رسم کلیه ذرات و جلوه‌های بصری صحنه',
    'cl_particle_fallback_base': 'کاهش جزئیات افکت ذرات در درگیری‌های سنگین برای حفظ فریم',
    'r_particle_gpu_implicit_lds_cache': 'کش کردن ذرات پردازش شونده روی حافظه فوق سریع GPU',
    'citadel_enable_new_ping_particle': 'افکت ذرات جدید برای پینگ‌های ارتباطی روی مپ',
    'citadel_fibonnaci_sphere_trace_los_max': 'حداکثر شعاع بررسی دید برای انفجارها و افکت‌های بزرگ',

    # Textures & Materials & Decals
    'mat_picmip': 'کیفیت و وضوح بافت‌ها و تکسچرهای بازی',
    'r_texture_filtering_quality': 'کیفیت فیلترینگ بافت‌ها (Anisotropic Filtering)',
    'r_decals': 'حداکثر تعداد لکه‌ها و آثار تیر و نبرد روی سطوح',
    'r_drawdecals': 'رسم و رندر آثار تیر، خون و اثرات گلوله',
    'mat_motion_blur_enabled': 'فعال‌سازی تاری تصویر هنگام حرکات سریع دوربین (Motion Blur)',
    'mat_ambient_light_r': 'تنظیم شدت نور قرمز در نورپردازی محیطی',
    'rope_smooth_minwidth': 'حداقل ضخامت رندر و هموارسازی خطوط طناب و کابل‌ها',

    # Physics, Ragdoll & Cloth
    'cl_ragdoll_fade_time': 'مدت زمان ناپدید شدن اجساد هیروها و تروپرها',
    'ai_use_async_ragdoll_fixup': 'محاسبه ناهمگام فیزیک رگ‌دال اجساد روی نخ‌های جداگانه CPU',
    'pred_cloth_rot_low': 'آستانه پایین تصحیح چرخش و تکان پارچه‌ها و شنل هیروها',
    'rtx_dynamic_blas': 'ساخت داینامیک ساختار شتاب‌دهی برای انیمیشن پوست و لباس هیروها',
    'ik_enable': 'فعال‌سازی سینماتیک معکوس (IK) برای قرارگیری دقیق پاها روی زمین',
    'ik_planetilt_enable': 'تطبیق زاویه پاهای هیرو با شیب و پستی‌بلندی زمین',
    'ik_fabrik_forwards_enabled': 'مرحله مستقیم حل‌کننده انیمیشن حرکات مفاصل (FABRIK IK)',
    'anim_resource_validate_on_load': 'اعتبارسنجی کانال‌های انیمیشن هنگام بارگذاری مپ',

    # Engine, CPU, GPU & Performance
    'fps_max': 'حداکثر سقف نرخ فریم بازی (FPS Cap)',
    'cpu_level': 'تنظیم سطح بهینه‌سازی بار پردازشی روی CPU',
    'r_low_latency': 'کاهش تأخیر ورودی و اینپوت لگ (NVIDIA Reflex / Low Latency)',
    'r_fastpath_mode': 'مسیر مستقیم و سریع رندر کارت گرافیک (FastPath)',
    'engine_no_focus_sleep': 'جلوگیری از افت فریم بازی هنگام سوییچ به پنجره‌های دیگر (Alt-Tab)',
    'engine_allow_multiple_simulates_per_frame': 'اجازه چندین شبیه‌سازی در هر فریم هنگام افت فریم برای جبران لگ',
    'panorama_temp_comp_layer_min_dimension': 'حداقل اندازه لایه‌های موقت ترکیب رابط کاربری منوها',
    'sc_aggregate_gpu_vis_culling': 'تجمیع حذف اجسام پنهان در کارت گرافیک (GPU Culling)',
    'sc_instanced_mesh_size_cull_bias': 'حذف زودهنگام اشیاء و مش‌های کوچک در فاصله دور برای حفظ فریم',
    'cl_input_enable_raw_keyboard': 'ورودی مستقیم کیبورد بدون تأخیر سیستم‌عامل',

    # Network & Audio
    'cl_interp': 'میزان تأخیر درون‌یابی موقعیت هیروها و پکت‌های شبکه',
    'cl_interp_ratio': 'ضریب هموارسازی شبکه بین تیک‌های سرور ددلاک',
    'cl_updaterate': 'نرخ ارسال داده‌های گیم‌پلی از کلاینت به سرور',
    'cl_cmdrate': 'نرخ دریافت پکت‌های سرور بازی در ثانیه',
    'rate': 'حداکثر پهنای باند اختصاص‌یافته به ارتباط با سرور ددلاک',
    'snd_mixahead': 'اندازه بافر صوتی برای به حداقل رساندن تأخیر شنیدن صداها',
    'snd_boxverb_simd': 'بهینه‌سازی پردازش چنددستوری (SIMD) برای افکت پژواک محیطی صدا',
    'volume': 'میزان بلندی صدای کلی بازی',
    'm_rawinput': 'خواندن ورودی خام ماوس بدون پردازش ویندوز (Raw Input)',
    'sensitivity': 'حساسیت چرخش نشانگر ماوس در بازی',
}

def make_gamer_fa(k, meta):
    if k in BESPOKE_FA:
        return BESPOKE_FA[k]

    # Troopers
    if 'trooper' in k:
        if 'glow' in k: return 'تنظیم هاله و درخشش دور تروپرها در درگیری لین'
        if 'outline' in k: return 'خطوط دور (Outline) تروپرها برای تشخیص بهتر در لین'
        if 'size' in k: return 'اندازه نمایش آیکون تروپرها روی مینی‌مپ'
        if 'health' in k or 'status' in k: return 'وضعیت و نوار سلامت تروپرها'
        return 'تنظیمات و بهینه‌سازی پردازش تروپرها در لین'

    if 'creep' in k:
        return 'بهینه‌سازی نمایش و رندر کریپ‌ها در مسیرها'

    # Boss & Walkers
    if 'boss' in k or 'walker' in k or 'midboss' in k:
        if 'glow' in k: return 'تنظیم هاله نوری پیرامون میدباس و واکرها'
        if 'health' in k: return 'نوار سلامت و وضعیت میدباس روی صفحه'
        return 'تنظیمات و بهینه‌سازی گرافیکی میدباس و واکرها'

    # Melee & Shake
    if 'melee' in k:
        if 'shake' in k: return 'میزان و مدت لرزش صفحه هنگام زدن ضربات میلی'
        return 'تنظیمات ضربات نزدیک و مشت سنگین میلی'

    if 'shake' in k or 'wobble' in k:
        return 'کنترل تکان و لرزش دوربین هنگام دویدن و اسپرینت'

    # Camera & FOV
    if 'camera' in k or 'fov' in k:
        if 'fov' in k: return 'زاویه دید و میدان دید دوربین (FOV)'
        if 'collision' in k: return 'سیستم تشخیص برخورد دوربین با موانع و دیوارها'
        if 'height' in k: return 'تنظیم ارتفاع و زاویه عمودی دوربین هیرو'
        return 'تنظیمات موقعیت دوربین و میدان دید (FOV)'

    # Damage & Indicators
    if 'damage' in k:
        if 'indicator' in k: return 'نشانگر جهت و شدت آسیب وارده روی صفحه'
        if 'text' in k or 'batch' in k: return 'نحوه نمایش و تجمیع ارقام دمیج ابیلیتی‌ها'
        return 'تنظیمات سیستم محاسبه و نمایش دمیج'

    # Ragdoll & Deaths
    if 'ragdoll' in k:
        if 'fade' in k or 'time' in k or 'duration' in k: return 'مدت زمان محو شدن اجساد هیروها (فیزیک رگ‌دال)'
        if 'async' in k: return 'پردازش ناهمگام فیزیک اجساد روی چند هسته CPU'
        return 'تنظیمات فیزیک اجساد و مرگ کاراکترها (رگ‌دال)'

    # Cloth
    if 'cloth' in k:
        return 'شبیه‌سازی فیزیک حرکت پارچه‌ها و شنل لباس هیروها'

    # Shadows & CSM
    if 'shadow' in k or 'csm' in k:
        if 'cull' in k: return 'حذف سایه‌های خارج از کادر دید برای افزایش فریم'
        if 'res' in k or 'resolution' in k or 'size' in k: return 'رزولوشن و کیفیت محاسبه سایه‌ها'
        if 'distance' in k or 'dist' in k: return 'حداکثر فاصله محاسبه و رسم سایه‌ها'
        if 'atlas' in k: return 'اندازه بافت اطلس سایه‌ها در حافظه گرافیکی'
        return 'بهینه‌سازی پردازش سایه‌های داینامیک و نور خورشید (CSM)'

    # Light & Lighting
    if 'light' in k or 'lb_' in k:
        if 'cull' in k: return 'حذف نورها و بازتاب‌های خارج از دید برای افزایش فریم'
        if 'flicker' in k: return 'جلوه چشمک‌زدن نور چراغ‌ها در مپ'
        if 'map' in k: return 'کیفیت و فیلترینگ بافت‌های روشنایی مپ (Lightmaps)'
        return 'تنظیمات سیستم نورپردازی و روشنایی محیطی بازی'

    # Particles
    if 'particle' in k:
        if 'gpu' in k: return 'پردازش جلوه ذرات روی حافظه و کش کارت گرافیک'
        if 'fallback' in k or 'cull' in k: return 'کاهش کیفیت ذرات در صحنه‌های شلوغ برای جلوگیری از افت فریم'
        return 'کیفیت و تعداد ذرات، دود و جلوه‌های ویژه جادوها (Particles)'

    # Fog
    if 'fog' in k:
        return 'پردازش و رندر مه و غلظت جوی محیط (Volumetric Fog)'

    # SSAO & AO
    if 'ssao' in k or '_ao' in k or 'ao_' in k:
        return 'کیفیت سایه‌زنی گوشه‌ها و عمق اجسام (SSAO)'

    # Decals
    if 'decal' in k:
        return 'رندر و تعداد لکه‌ها و رد تیرها روی سطوح (Decals)'

    # Textures & Anisotropic
    if 'texture' in k or 'picmip' in k or 'aniso' in k:
        return 'کیفیت، وضوح و فیلترینگ بافت‌ها و متریال‌ها (Textures)'

    # Culling
    if 'cull' in k or 'occlusion' in k or 'vis' in k:
        return 'حذف بار پردازشی اشیاء پنهان و خارج از کادر (GPU Culling)'

    # Animation & IK
    if 'anim' in k or 'animgraph' in k or 'ik' in k or 'bone' in k:
        if 'ik' in k: return 'سیستم سینماتیک معکوس (IK) برای تطبیق پای هیرو با پستی‌بلندی زمین'
        return 'محاسبات انیمیشن، اسکلت و حرکات هیروها'

    # Audio
    if 'snd' in k or 'audio' in k or 'voice' in k or 'verb' in k or 'sound' in k:
        if 'mixahead' in k or 'buffer' in k: return 'اندازه بافر صوتی برای کاهش تأخیر شنیداری'
        if 'verb' in k: return 'محاسبه بازتاب و اکوی صوتی محیط (Reverb)'
        return 'تنظیمات و بهینه‌سازی سیستم صدای بازی'

    # Network
    if 'cl_interp' in k or 'cmdrate' in k or 'updaterate' in k or 'rate' == k or 'net_' in k or 'tick' in k:
        return 'تنظیمات نرخ تبادل پکت‌ها و کاهش لگ شبکه ددلاک'

    # CPU
    if 'cpu' in k or 'thread' in k or 'simulat' in k or 'job' in k or 'async' in k:
        return 'تخصیص و بهینه‌سازی بار پردازشی روی هسته‌های CPU'

    # GPU
    if 'gpu' in k or 'fastpath' in k or 'shader' in k or 'vulkan' in k or 'd3d' in k or 'blas' in k:
        return 'بهینه‌سازی خط لوله رندر و محاسبات کارت گرافیک (GPU)'

    # Rope
    if 'rope' in k or 'cable' in k:
        return 'فیزیک و رندر کابل‌ها، خطوط طناب و زیپ‌لاین'

    # Water
    if 'water' in k or 'reflect' in k:
        return 'کیفیت رندر و بازتاب‌های سطح آب'

    # UI / Panorama
    if 'panorama' in k or 'hud' in k or 'ui' in k:
        return 'بهینه‌سازی لایه‌ها و رندر رابط کاربری ددلاک (Panorama UI)'

    # Citadel
    if 'citadel' in k:
        return 'تنظیم اختصاصی بهینه‌سازی گیم‌پلی و موتور ددلاک'

    # Source 2 prefixes
    if k.startswith('r_'):
        return 'تنظیم پردازش رندرینگ و جلوه‌های بصری گرافیک'
    if k.startswith('mat_'):
        return 'تنظیمات متریال‌ها، نورپردازی و بافت‌های بازی'
    if k.startswith('cl_'):
        return 'تنظیمات کلاینت و همگام‌سازی ورودی بازیکن'
    if k.startswith('sv_'):
        return 'تنظیمات سرور و فیزیک محیطی'

    return 'پارامتر بهینه‌سازی انجین Source 2 ددلاک'

# Include all preset cvars AND all bespoke keys
combined_cvars = set(all_cvars)
for k in BESPOKE_FA.keys():
    combined_cvars.add(k.lower())

catalog_dict = {}
for c in sorted(combined_cvars):
    meta = convars_map.get(c, {})
    catalog_dict[c] = make_gamer_fa(c, meta)

print(f"Generated gamer translations for all {len(catalog_dict)} convars (presets + bespoke).")

js_code = "// DLPHub - Gamer-Friendly Deadlock ConVar Persian Catalog\n"
js_code += "// Handcrafted and categorized for competitive Deadlock players\n"
js_code += "window.CONVAR_FA_CATALOG = " + json.dumps(catalog_dict, ensure_ascii=False, indent=2) + ";\n"

with open('ui/i18n/convar_fa_catalog.js', 'w', encoding='utf-8') as f:
    f.write(js_code)

print("Saved ui/i18n/convar_fa_catalog.js successfully!")
