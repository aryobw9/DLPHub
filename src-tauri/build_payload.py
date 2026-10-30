from pathlib import Path
import os
import sys
import shutil
import tempfile
import zipfile

SRC = Path(os.environ.get("DEADLOCK_CONFIGS_DIR", r"D:\Claude\DeadlockConfigs"))
OUT = Path(__file__).with_name('payload.zip')
FULL_BACKUP = Path(__file__).with_name('payload.zip.full')
TIERS = ('t1', 't2', 't3', 'potato')


def build_payload(source=SRC, output=OUT):
    source, output = Path(source), Path(output)
    include_addons = "--include-addons" in sys.argv or os.environ.get("INCLUDE_ADDONS") == "1"
    folders = TIERS + (('addons',) if include_addons else ())

    # Allow building lightweight binaries without game configs (e.g. for testing networking/LAN)
    if os.environ.get("NO_PAYLOAD") == "1" or "--no-payload" in sys.argv:
        if output.is_file() and output.stat().st_size > 1000 and not FULL_BACKUP.exists():
            shutil.copy2(output, FULL_BACKUP)
            print(f"Backed up full payload to {FULL_BACKUP}")
        with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
            pass
        print(f"NO_PAYLOAD active: wrote empty payload to {output} ({output.stat().st_size} bytes)")
        return output

    if "--restore-payload" in sys.argv:
        if FULL_BACKUP.is_file():
            shutil.copy2(FULL_BACKUP, output)
            print(f"Restored full payload from {FULL_BACKUP} ({output.stat().st_size} bytes)")
            return output
        print("No full payload backup found to restore.")

    if not source.exists():
        if output.is_file() and output.stat().st_size > 0:
            print(f"Configs dir {source} not found; using existing {output} ({output.stat().st_size} bytes)")
            return output
        raise FileNotFoundError(f"Configs dir {source} not found and no existing payload at {output}")
    required = [source / tier / 'gameinfo.gi' for tier in TIERS]
    required += [source / tier / 'video.txt' for tier in TIERS]
    for path in required:
        if not path.is_file():
            raise FileNotFoundError(f'Required payload file missing: {path}')
    if include_addons and not any((source / 'addons').glob('*.vpk')):
        raise FileNotFoundError(f'No addon VPK files in {source / "addons"}')
    output.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix='payload-', suffix='.zip', dir=output.parent)
    os.close(fd)
    try:
        with zipfile.ZipFile(temporary, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
            for folder in folders:
                folder_path = source / folder
                if folder_path.is_dir():
                    for path in sorted(folder_path.rglob('*')):
                        if path.is_file():
                            archive.write(path, path.relative_to(source))
        os.replace(temporary, output)
    finally:
        Path(temporary).unlink(missing_ok=True)
    return output


if __name__ == '__main__':
    result = build_payload()
    print('wrote', result, result.stat().st_size, 'bytes')
