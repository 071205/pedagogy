#!/usr/bin/env python3
"""H1-section-02: two-section probes derived from the repository blank template."""
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
from pedagogy_hwpx import HwpxDocument  # noqa: E402

OPF = 'http://www.idpf.org/2007/opf/'
HPF, HEADER, RDF = 'Contents/content.hpf', 'Contents/header.xml', 'META-INF/container.rdf'
SECTION0, SECTION1 = 'Contents/section0.xml', 'Contents/section1.xml'
MARKERS = ['H1 구역 A 111.', 'H1 구역 B 222.']

def serialize(node):
    return etree.tostring(node, encoding='UTF-8', xml_declaration=True, standalone=True)

def digest(data):
    return hashlib.sha256(data).hexdigest()

def write_package(path, infos, parts):
    with ZipFile(path, 'w') as z:
        for original in infos:
            if original.filename not in parts:
                continue
            z.writestr(copy.copy(original), parts[original.filename])
            if original.filename == SECTION0:
                info = copy.copy(original)
                info.filename = SECTION1
                z.writestr(info, parts[SECTION1])

def build(output):
    output.mkdir(parents=True, exist_ok=False)
    seed = output / 'seed.hwpx'
    doc = HwpxDocument.blank()
    doc.append_paragraph(MARKERS[0])
    doc.save(seed)
    with ZipFile(seed) as z:
        infos = z.infolist()
        base = {i.filename: z.read(i.filename) for i in infos}
    seed.unlink()
    base[SECTION1] = base[SECTION0].replace(MARKERS[0].encode(), MARKERS[1].encode())
    head = etree.fromstring(base[HEADER])
    head.set('secCnt', '2')
    base[HEADER] = serialize(head)
    hpf = etree.fromstring(base[HPF])
    item = copy.deepcopy(hpf.find(f'.//{{{OPF}}}item[@id="section0"]'))
    item.set('id', 'section1')
    item.set('href', SECTION1)
    hpf.find(f'{{{OPF}}}manifest').append(item)
    ref = copy.deepcopy(hpf.find(f'.//{{{OPF}}}itemref[@idref="section0"]'))
    ref.set('idref', 'section1')
    hpf.find(f'{{{OPF}}}spine').append(ref)
    base[HPF] = serialize(hpf)
    rdf = etree.fromstring(base[RDF])
    for node in list(rdf):
        if any(v == SECTION0 for e in node.iter() for v in e.attrib.values()):
            new = copy.deepcopy(node)
            for e in new.iter():
                for key, value in list(e.attrib.items()):
                    if value == SECTION0:
                        e.set(key, SECTION1)
            rdf.append(new)
    base[RDF] = serialize(rdf)
    definitions = [
        ('control', 'derived two-section baseline'),
        ('manifest-order-reversed', 'reverse section item positions; retain IDs and hrefs'),
        ('spine-order-reversed', 'reverse section itemref positions; retain manifest'),
        ('spine-sections-removed', 'remove only section itemrefs'),
        ('header-count-one', 'change only header secCnt 2 to 1'),
        ('header-count-zero', 'change only header secCnt 2 to 0'),
        ('header-count-three', 'change only header secCnt 2 to 3'),
        ('section1-id-renamed', 'change section1 manifest ID and matching spine idref'),
        ('section1-id-gap', 'change section1 manifest ID and spine idref to section2'),
        ('id-assignment-swapped', 'swap section manifest IDs; retain physical paths and spine'),
        ('control-after', 'byte-identical baseline after mutations'),
    ]
    cases = []
    for case_id, mutation in definitions:
        parts = dict(base)
        package = etree.fromstring(parts[HPF])
        if case_id in {'manifest-order-reversed', 'spine-order-reversed'}:
            tag, attr = ('manifest', 'id') if case_id.startswith('manifest') else ('spine', 'idref')
            parent = package.find(f'{{{OPF}}}{tag}')
            selected = [e for e in parent if e.get(attr) in {'section0', 'section1'}]
            indexes = [list(parent).index(e) for e in selected]
            for e in selected:
                parent.remove(e)
            for index, e in zip(indexes, reversed(selected)):
                parent.insert(index, e)
        elif case_id == 'spine-sections-removed':
            parent = package.find(f'{{{OPF}}}spine')
            for e in list(parent):
                if e.get('idref') in {'section0', 'section1'}:
                    parent.remove(e)
        elif case_id.startswith('header-count-'):
            counts = {'one': '1', 'zero': '0', 'three': '3'}
            head = etree.fromstring(parts[HEADER])
            head.set('secCnt', counts[case_id.removeprefix('header-count-')])
            parts[HEADER] = serialize(head)
        elif case_id in {'section1-id-renamed', 'section1-id-gap'}:
            new_id = 'research-body' if case_id.endswith('renamed') else 'section2'
            package.find(f'.//{{{OPF}}}item[@id="section1"]').set('id', new_id)
            package.find(f'.//{{{OPF}}}itemref[@idref="section1"]').set('idref', new_id)
        elif case_id == 'id-assignment-swapped':
            first = package.find(f'.//{{{OPF}}}item[@id="section0"]')
            second = package.find(f'.//{{{OPF}}}item[@id="section1"]')
            first.set('id', 'section1')
            second.set('id', 'section0')
        if not case_id.startswith('header-count-') and case_id not in {'control', 'control-after'}:
            parts[HPF] = serialize(package)
        path = output / f'h1s-{case_id}.hwpx'
        write_package(path, infos, parts)
        cases.append({'caseId': case_id, 'file': path.name, 'sha256': digest(path.read_bytes()),
                      'parent': None if case_id == 'control' else 'control', 'mutation': mutation,
                      'changedParts': sorted(k for k in base if parts[k] != base[k]),
                      'expectedOpen': 'pass' if case_id in {'control', 'control-after'} else 'unknown',
                      'observedOpen': 'unknown', 'content': 'unknown', 'save': 'unknown', 'pdf': 'unknown'})
    info_path = Path('/Applications/Hancom Office HWP.app/Contents/Info.plist')
    info = plistlib.loads(info_path.read_bytes()) if info_path.exists() else {}
    manifest = {'schemaVersion': 1, 'suite': 'H1-section-02', 'sourceCommit': subprocess.check_output(
        ['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
        'generatorSha256': digest(Path(__file__).read_bytes()),
        'templateSha256': digest((ROOT / 'experiments/hwp-export/templates/blank.hwpx').read_bytes()),
        'engineSha256': digest((ROOT / 'experiments/hwp-export/pedagogy_hwpx.py').read_bytes()),
        'source': 'repository blank template + self-authored two-section derivation; control requires real-app validation',
        'markers': MARKERS, 'fonts': {'status': 'unmeasured'},
        'environment': {'os': platform.platform(), 'architecture': platform.machine(),
                        'python': platform.python_version(), 'lxml': list(etree.LXML_VERSION),
                        'hancomVersion': info.get('CFBundleShortVersionString'), 'hancomBuild': info.get('CFBundleVersion')},
        'cases': cases}
    (output / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    return manifest

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    result = build(args.output.resolve())
    print(f"{len(result['cases'])} section fixtures: {args.output / 'manifest.json'}")
