#!/usr/bin/env python3
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import tempfile
from zipfile import ZipFile
from lxml import etree

spec = importlib.util.spec_from_file_location('fixtures', Path(__file__).with_name('build-hwp-research-fixtures.py'))
fixtures = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixtures)
expected_changes = {
    'control': [], 'control-after': [],
    'metadata-removed': [fixtures.HPF],
    'section-path-renamed': [fixtures.HPF, fixtures.SECTION],
    'section-id-renamed': [fixtures.HPF], 'section-spine-removed': [fixtures.HPF],
    'section-missing': [fixtures.SECTION], 'package-missing': [fixtures.HPF],
}
with tempfile.TemporaryDirectory(prefix='h1-fixture-test-') as temp:
    output = Path(temp) / 'cases'
    manifest = fixtures.build(output)
    assert len(manifest['cases']) == 8
    try:
        fixtures.build(output)
        raise AssertionError('OVERWRITE_NOT_BLOCKED')
    except FileExistsError:
        pass
    with ZipFile(output / 'h1-control.hwpx') as z:
        baseline = {n: z.read(n) for n in z.namelist()}
    assert fixtures.MARKER in baseline[fixtures.SECTION].decode()
    for case in manifest['cases']:
        data = (output / case['file']).read_bytes()
        assert hashlib.sha256(data).hexdigest() == case['sha256']
        with ZipFile(output / case['file']) as z:
            assert len(z.namelist()) == len(set(z.namelist()))
            assert z.infolist()[0].filename == 'mimetype'
            parts = {n: z.read(n) for n in z.namelist()}
        if os.getenv('H1_FIXTURE_RED') == '1' and case['caseId'] == 'metadata-removed':
            parts['Contents/header.xml'] += b'\n'
        changed = sorted(n for n in baseline if n not in parts or parts[n] != baseline[n])
        assert changed == expected_changes[case['caseId']], f"UNRELATED_PART_CHANGED: {case['caseId']}: {changed}"
        assert case['observedOpen'] == case['save'] == case['pdf'] == 'unknown'
        if case['caseId'] == 'metadata-removed':
            root = etree.fromstring(parts[fixtures.HPF])
            assert root.find(f'{{{fixtures.OPF}}}metadata') is None
        if case['caseId'] == 'section-path-renamed':
            assert parts['Contents/research-body.xml'] == baseline[fixtures.SECTION]
        if case['caseId'] == 'control-after':
            assert data == (output / 'h1-control.hwpx').read_bytes()
    assert json.loads((output / 'manifest.json').read_text()) == manifest
print('H1 fixture isolation/hash/no-overwrite/unknown-outcome: 8 cases PASS')
