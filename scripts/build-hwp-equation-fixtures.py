#!/usr/bin/env python3
"""H1-equation-03: isolate equation geometry using self-authored payloads."""
import argparse
import copy
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
from pedagogy_hwpx import HwpxDocument, qn  # noqa: E402
from tex_to_hwp import convert  # noqa: E402

SECTION = 'Contents/section0.xml'
TEX = [r'\frac{x^2+1}{x^2-1}', r'\begin{pmatrix}a&b\\c&d\end{pmatrix}',
       ' + '.join('a_{' + str(i) + '}' for i in range(1, 21))]
SOURCE = 'https://forum.developer.hancom.com/t/hp-sz-width/1783/2'

def digest(data):
    return hashlib.sha256(data).hexdigest()

def build(output):
    output.mkdir(parents=True, exist_ok=False)
    seed = output / 'h1e-control.hwpx'
    doc = HwpxDocument.blank()
    scripts = [convert(tex) for tex in TEX]
    markers = []
    for i, script in enumerate(scripts, 1):
        before, after, next_line = f'H1 E{i} BEFORE. ', f' AFTER E{i}.', f'H1 E{i} NEXT LINE.'
        markers.extend([before, after, next_line])
        doc.append_paragraph(before)
        index = doc.paragraph_count() - 1
        doc.append_inline_equation(script, paragraph_index=index)
        node = etree.Element(qn('hp', 't'))
        node.text = after
        doc.append_run_xml(etree.tostring(node), paragraph_index=index)
        doc.append_paragraph(next_line)
    doc.save(seed)
    with ZipFile(seed) as z:
        infos = z.infolist()
        original = {i.filename: z.read(i.filename) for i in infos}
    definitions = [
        ('control', {}),
        ('baseline-zero', {'baseLine': '0'}),
        ('size-zero', {'width': '0', 'height': '0'}),
        ('all-zero', {'baseLine': '0', 'width': '0', 'height': '0'}),
        ('size-double', {'width': '9600', 'height': '4600'}),
        ('line-spacing-on', {'affectLSpacing': '1'}),
        ('control-after', {}),
    ]
    cases = []
    for case_id, change in definitions:
        parts = dict(original)
        if change:
            section = etree.fromstring(parts[SECTION])
            for equation in section.iter(qn('hp', 'equation')):
                for key, value in change.items():
                    target = equation if key == 'baseLine' else equation.find(
                        qn('hp', 'pos' if key == 'affectLSpacing' else 'sz'))
                    target.set(key, value)
            parts[SECTION] = etree.tostring(section, encoding='UTF-8', xml_declaration=True, standalone=True)
        path = output / f'h1e-{case_id}.hwpx'
        if case_id != 'control':
            with ZipFile(path, 'w') as z:
                for info in infos:
                    z.writestr(copy.copy(info), parts[info.filename])
        cases.append({'caseId': case_id, 'file': path.name, 'sha256': digest(path.read_bytes()),
                      'changes': change, 'changedParts': sorted(k for k in original if parts[k] != original[k]),
                      'expectedOpen': 'pass' if not change else 'unknown',
                      'observedOpen': 'unknown', 'content': 'unknown', 'save': 'unknown', 'pdf': 'unknown'})
    app = Path('/Applications/Hancom Office HWP.app/Contents/Info.plist')
    info = plistlib.loads(app.read_bytes()) if app.exists() else {}
    manifest = {'schemaVersion': 1, 'suite': 'H1-equation-03',
        'question': 'Does zero geometry trigger recalculation, and how does fixed geometry affect inline layout?',
        'hypothesisSource': SOURCE, 'sourceCommit': subprocess.check_output(
            ['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
        'generatorSha256': digest(Path(__file__).read_bytes()),
        'engineSha256': digest((ROOT / 'experiments/hwp-export/pedagogy_hwpx.py').read_bytes()),
        'converterSha256': digest((ROOT / 'experiments/hwp-export/tex_to_hwp.py').read_bytes()),
        'templateSha256': digest((ROOT / 'experiments/hwp-export/templates/blank.hwpx').read_bytes()),
        'environment': {'os': platform.platform(), 'architecture': platform.machine(),
            'python': platform.python_version(), 'lxml': list(etree.LXML_VERSION),
            'hancomVersion': info.get('CFBundleShortVersionString'), 'hancomBuild': info.get('CFBundleVersion')},
        'source': 'repository blank template + self-authored fraction, matrix and long inline sum',
        'tex': TEX, 'scripts': scripts, 'markers': markers, 'fonts': {'status': 'unmeasured'}, 'cases': cases}
    (output / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    return manifest

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    result = build(args.output.resolve())
    print(f"{len(result['cases'])} equation fixtures: {args.output / 'manifest.json'}")
