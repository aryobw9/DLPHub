import os
import shutil

ADDONS_DIR = r"D:\Claude\DeadlockConfigs\addons"
NEW_MODS = r"D:\Claude\new mods"

# Clear old addons in DeadlockConfigs\addons
for f in os.listdir(ADDONS_DIR):
    fp = os.path.join(ADDONS_DIR, f)
    if os.path.isfile(fp):
        os.remove(fp)

# Copy new addons
shutil.copy(os.path.join(NEW_MODS, "pak01_dir.vpk"), os.path.join(ADDONS_DIR, "pak01_dir.vpk"))
shutil.copy(os.path.join(NEW_MODS, "pak02_dir.vpk"), os.path.join(ADDONS_DIR, "pak02_dir.vpk"))
shutil.copy(os.path.join(NEW_MODS, "pak03_dir.vpk"), os.path.join(ADDONS_DIR, "pak03_dir.vpk"))
shutil.copy(os.path.join(NEW_MODS, "pak31_dir.vpk"), os.path.join(ADDONS_DIR, "pak31_dir.vpk"))
shutil.copy(os.path.join(NEW_MODS, "russian potato", "pak01_dir.vpk"), os.path.join(ADDONS_DIR, "pak30_dir.vpk"))

print("Addons updated successfully:")
for f in sorted(os.listdir(ADDONS_DIR)):
    sz = os.path.getsize(os.path.join(ADDONS_DIR, f))
    print(f"  {f} ({sz / 1024 / 1024:.2f} MB)")
