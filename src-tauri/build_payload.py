"""Package private payload; never replace a good archive with a partial one."""
from pathlib import Path
import os
import tempfile
import zipfile

SRC = Path(r"D:\Claude\ddlock")
OUT = Path(__file__).with_name('payload.zip')
FOLDERS = ('gi_tier1', 'gi_tier2', 'gi_tier3', 'potato', 'addons')


def build_payload(source=SRC, output=OUT):
    source, output = Path(source), Path(output)
    required = [source / tier / 'gameinfo.gi' for tier in FOLDERS[:3]]
    required += [source / tier / 'video.txt' for tier in FOLDERS[:4]]
    for path in required:
        if not path.is_file():
            raise FileNotFoundError(f'Required payload file missing: {path}')
    if not any((source / 'addons').glob('*.vpk')):
        raise FileNotFoundError(f'No addon VPK files in {source / "addons"}')
    output.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix='payload-', suffix='.zip', dir=output.parent)
    os.close(fd)
    try:
        with zipfile.ZipFile(temporary, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
            for folder in FOLDERS:
                for path in sorted((source / folder).rglob('*')):
                    if path.is_file():
                        archive.write(path, path.relative_to(source))
        os.replace(temporary, output)
    finally:
        Path(temporary).unlink(missing_ok=True)
    return output


if __name__ == '__main__':
    result = build_payload()
    print('wrote', result, result.stat().st_size, 'bytes')
