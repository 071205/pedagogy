#!/usr/bin/env python3
"""Independent mutation-shape checks; no claim that Hancom renders these files."""
import importlib.util
import json
import os
import tempfile
from pathlib import Path
from zipfile import ZipFile
from lxml import etree

spec = importlib.util.spec_from_file_location('section_fixtures', Path(__file__).with_name('build-hwp-section-fixtures.py'))
fixtures = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixtures)
OPF = fixtures.OPF
def package_parts(path):
    with ZipFile(path) as z:
        assert len(z.namelist()) == len(set(z.namelist()))
        assert z.infolist()[0].filename == 'mimetype'
        return {n: z.read(n) for n in z.namelist()}

with tempfile.TemporaryDirectory(prefix='h1-sections-') as temp:
    out = Path(temp) / 'cases'
    manifest = fixtures.build(out)
    assert len(manifest['cases']) == 11
    base = package_parts(out / 'h1s-control.hwpx')
    for section, marker in zip([fixtures.SECTION0, fixtures.SECTION1], fixtures.MARKERS):
        assert marker in ''.join(etree.fromstring(base[section]).itertext())
    for case in manifest['cases']:
        path = out / case['file']
        assert fixtures.digest(path.read_bytes()) == case['sha256']
        parts = package_parts(path)
        assert parts.keys() == base.keys()
        changed = sorted(k for k in base if parts[k] != base[k])
        expected = [] if case['caseId'] in {'control', 'control-after'} else [
            fixtures.HEADER if case['caseId'].startswith('header-count-') else fixtures.HPF]
        assert changed == expected == case['changedParts'], 'SECTION_UNRELATED_CHANGE'
        hpf = etree.fromstring(parts[fixtures.HPF])
        items = [(e.get('id'), e.get('href')) for e in hpf.findall(f'.//{{{OPF}}}item') if e.get('href') in {fixtures.SECTION0, fixtures.SECTION1}]
        refs = [e.get('idref') for e in hpf.findall(f'.//{{{OPF}}}itemref') if e.get('idref') != 'header']
        case_id = case['caseId']
        expected_items = [('section0', fixtures.SECTION0), ('section1', fixtures.SECTION1)]
        expected_refs = ['section0', 'section1']
        if case_id == 'manifest-order-reversed':
            expected_items.reverse()
        if case_id == 'spine-order-reversed':
            expected_refs.reverse()
        if case_id == 'spine-sections-removed':
            expected_refs = []
        if case_id in {'section1-id-renamed', 'section1-id-gap'}:
            new_id = 'research-body' if case_id.endswith('renamed') else 'section2'
            expected_items[1] = (new_id, fixtures.SECTION1)
            expected_refs[1] = new_id
        if case_id == 'id-assignment-swapped':
            expected_items = [('section1', fixtures.SECTION0), ('section0', fixtures.SECTION1)]
        if os.getenv('H1_SECTION_RED') == '1' and case_id == 'spine-order-reversed':
            refs.reverse()
        assert items == expected_items and refs == expected_refs, f'SECTION_ORDER_MUTATION_LOST: {case_id}'
        expected_count = {'header-count-one': '1', 'header-count-zero': '0', 'header-count-three': '3'}.get(case_id, '2')
        assert etree.fromstring(parts[fixtures.HEADER]).get('secCnt') == expected_count
        assert all(case[k] == 'unknown' for k in ['observedOpen', 'content', 'save', 'pdf'])
        if case_id == 'control-after':
            assert path.read_bytes() == (out / 'h1s-control.hwpx').read_bytes()
    try:
        fixtures.build(out)
        raise AssertionError('SECTION_OVERWRITE_ALLOWED')
    except FileExistsError:
        pass
    assert json.loads((out / 'manifest.json').read_text()) == manifest
print('H1 section fixtures: 11 mutation/marker/hash/no-overwrite checks PASS')
