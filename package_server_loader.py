import os
import zipfile
from pathlib import Path

def package():
    base_dir = Path(__file__).resolve().parent
    loader_dir = base_dir / "DLPHubStorage" / "server_loader"
    out_zip = base_dir / "server_loader.zip"

    print(f"Packaging {loader_dir} -> {out_zip}")
    with zipfile.ZipFile(out_zip, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as zipf:
        # Include bin (skip plugins_src, skip *.disabled, skip *.bak)
        for root, dirs, files in os.walk(loader_dir):
            rel_root = Path(root).relative_to(loader_dir)
            
            # Skip plugins_src or lan_matches
            if "plugins_src" in rel_root.parts or "lan_matches" in rel_root.parts:
                continue

            for file in files:
                if file.endswith(".disabled") or file.endswith(".bak"):
                    continue
                file_path = Path(root) / file
                archive_path = rel_root / file
                zipf.write(file_path, str(archive_path).replace("\\", "/"))
                print(f"  + {archive_path}")

    print(f"Successfully packaged {out_zip} ({out_zip.stat().st_size} bytes)")

if __name__ == "__main__":
    package()
