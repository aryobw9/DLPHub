"""Run: python src-tauri/test_build_payload.py (temporary files only)."""
import importlib.util
from pathlib import Path
import tempfile
import unittest


class PayloadTests(unittest.TestCase):
    def test_missing_source_preserves_existing_archive(self):
        spec = importlib.util.spec_from_file_location('build_payload', Path(__file__).with_name('build_payload.py'))
        module = importlib.util.module_from_spec(spec)
        # Import must not rebuild the private payload.
        source = Path(spec.origin).read_text(encoding='utf-8')
        self.assertIn('def build_payload(', source, 'builder must be callable without import-time writes')
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            output = root / 'payload.zip'
            output.write_bytes(b'previous-good-archive')
            with self.assertRaises(FileNotFoundError):
                module.build_payload(root / 'missing', output)
            self.assertEqual(output.read_bytes(), b'previous-good-archive')


if __name__ == '__main__':
    unittest.main()
