#!/usr/bin/env python3
"""H1 package probes. Generated only into a new directory, never shipped as templates."""
import argparse
import hashlib
import json
import platform
import plistlib
import subprocess
import sys
from pathlib import Path
from zipfile import ZipFile
from lxml import etree

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'experiments/hwp-export'))
from pedagogy_hwpx import HwpxDocument  # noqa: E402

OPF = 'http://www.idpf.org/2007/opf/'
HPF = 'Contents/content.hpf'
SECTION = 'Contents/section0.xml'
MARKER = 'H1 패키지 실험: 가나다 ABC 123.'

def digest(data):
    return hashlib.sha256(data).hexdigest()

def build(output):
    output.mkdir(parents=True, exist_ok=False)
    base = output / 'h1-control.hwpx'
    doc = HwpxDocument.blank()
    doc.append_paragraph(MARKER)
    doc.save(base)
    with ZipFile(base) as z:
        infos = z.infolist()
        original = {i.filename: z.read(i.filename) for i in infos}
    cases = []
    definitions = [
        ('control', 'unchanged generated baseline', 'pass'),
        ('metadata-removed', 'remove only opf:metadata', 'unknown'),
        ('section-path-renamed', 'rename section part and manifest href; retain section0 ID', 'unknown'),
        ('section-id-renamed', 'rename manifest section ID and matching spine idref; retain part path', 'unknown'),
        ('section-spine-removed', 'remove only spine section0 itemref', 'unknown'),
        ('section-missing', 'omit section0.xml; keep manifest reference', 'fail'),
        ('package-missing', 'omit content.hpf', 'fail'),
        ('control-after', 'identical baseline after mutations', 'pass'),
    ]
    for case_id, mutation, expected in definitions:
        parts = dict(original)
        renamed = {}
        hpf = etree.fromstring(parts[HPF])
        if case_id == 'metadata-removed':
            hpf.remove(hpf.find(f'{{{OPF}}}metadata'))
        elif case_id == 'section-path-renamed':
            renamed[SECTION] = 'Contents/research-body.xml'
            hpf.find(f'.//{{{OPF}}}item[@id="section0"]').set('href', renamed[SECTION])
        elif case_id == 'section-id-renamed':
            hpf.find(f'.//{{{OPF}}}item[@id="section0"]').set('id', 'research-body')
            hpf.find(f'.//{{{OPF}}}itemref[@idref="section0"]').set('idref', 'research-body')
        elif case_id == 'section-spine-removed':
            ref = hpf.find(f'.//{{{OPF}}}itemref[@idref="section0"]')
            ref.getparent().remove(ref)
        elif case_id == 'section-missing':
            del parts[SECTION]
        elif case_id == 'package-missing':
            del parts[HPF]
        if case_id in {'metadata-removed', 'section-path-renamed', 'section-id-renamed', 'section-spine-removed'}:
            parts[HPF] = etree.tostring(hpf, encoding='UTF-8', xml_declaration=True, standalone=True)
        path = output / f'h1-{case_id}.hwpx'
        if case_id != 'control':
            # Preserve entry order, compression, timestamps and unchanged part bytes.
            import copy
            with ZipFile(path, 'w') as z:
                for info in infos:
                    if info.filename not in parts:
                        continue
                    entry = copy.copy(info)
                    entry.filename = renamed.get(info.filename, info.filename)
                    z.writestr(entry, parts[info.filename])
        changed = sorted(k for k in original if k not in parts or original[k] != parts[k] or k in renamed)
        cases.append({
            'caseId': case_id, 'file': path.name, 'sha256': digest(path.read_bytes()),
            'parent': None if case_id == 'control' else 'control', 'mutation': mutation,
            'changedParts': changed, 'renamedParts': renamed, 'expectedOpen': expected,
            'expectationBasis': 'control/negative control' if expected != 'unknown' else 'unverified hypothesis',
            'observedOpen': 'unknown', 'save': 'unknown', 'pdf': 'unknown',
        })
    app = Path('/Applications/Hancom Office HWP.app/Contents/Info.plist')
    info = plistlib.loads(app.read_bytes()) if app.exists() else {}
    manifest = {
        'schemaVersion': 1, 'suite': 'H1-package-01', 'sourceCommit': subprocess.check_output(
            ['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
        'generatorSha256': digest(Path(__file__).read_bytes()),
        'templateSha256': digest((ROOT / 'experiments/hwp-export/templates/blank.hwpx').read_bytes()),
        'engineSha256': digest((ROOT / 'experiments/hwp-export/pedagogy_hwpx.py').read_bytes()),
        'environment': {'os': platform.platform(), 'architecture': platform.machine(),
                        'python': platform.python_version(), 'lxml': list(etree.LXML_VERSION),
                        'hancomVersion': info.get('CFBundleShortVersionString'), 'hancomBuild': info.get('CFBundleVersion')},
        'fonts': {'status': 'unmeasured', 'visualComparisonAllowed': False},
        'source': 'repository blank template + self-authored marker; original historical failing skeleton not recovered',
        'marker': MARKER, 'cases': cases,
    }
    (output / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    return manifest

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    result = build(args.output.resolve())
    print(f"{len(result['cases'])} fixtures: {args.output / 'manifest.json'}")
