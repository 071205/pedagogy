#!/usr/bin/env python3
"""Check mutation isolation against input meaning; real rendering is a separate observation."""
import importlib.util
import json
import os
import tempfile
from pathlib import Path
from zipfile import ZipFile
from lxml import etree

spec = importlib.util.spec_from_file_location('equation_fixtures', Path(__file__).with_name('build-hwp-equation-fixtures.py'))
fixtures = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixtures)
HP = 'http://www.hancom.co.kr/hwpml/2011/paragraph'
EXPECTED_TEX = [r'\frac{x^2+1}{x^2-1}', r'\begin{pmatrix}a&b\\c&d\end{pmatrix}',
                ' + '.join('a_{' + str(i) + '}' for i in range(1, 21))]
# Independent oracle for these three fixed inputs; do not call the converter here.
EXPECTED_SCRIPTS = ['{x^{2}+1} over {x^{2}-1}', 'pmatrix{ a & b # c & d }',
                    ' + '.join('a_{' + str(i) + '}' for i in range(1, 21))]
EXPECTED_PARAGRAPHS = []
for i, script in enumerate(EXPECTED_SCRIPTS, 1):
    EXPECTED_PARAGRAPHS.extend([
        [('text', f'H1 E{i} BEFORE. '), ('equation', script), ('text', f' AFTER E{i}.')],
        [('text', f'H1 E{i} NEXT LINE.')]])

def parts(path):
    with ZipFile(path) as z:
        assert len(z.namelist()) == len(set(z.namelist()))
        assert z.infolist()[0].filename == 'mimetype'
        return {name: z.read(name) for name in z.namelist()}

expected_changes = {'control': {}, 'baseline-zero': {'baseLine': '0'},
    'size-zero': {'width': '0', 'height': '0'},
    'all-zero': {'baseLine': '0', 'width': '0', 'height': '0'},
    'size-double': {'width': '9600', 'height': '4600'},
    'line-spacing-on': {'affectLSpacing': '1'}, 'control-after': {}}

with tempfile.TemporaryDirectory(prefix='h1-equations-') as temp:
    out = Path(temp) / 'cases'
    manifest = fixtures.build(out)
    assert manifest['tex'] == EXPECTED_TEX, 'EQUATION_INPUT_CHANGED'
    assert manifest['scripts'] == EXPECTED_SCRIPTS, 'EQUATION_INPUT_MEANING_LOST'
    assert [c['caseId'] for c in manifest['cases']] == list(expected_changes)
    base = parts(out / 'h1e-control.hwpx')
    base_xml = etree.fromstring(base[fixtures.SECTION])
    canonical_base = etree.tostring(base_xml, method='c14n')
    for case in manifest['cases']:
        path = out / case['file']
        assert fixtures.digest(path.read_bytes()) == case['sha256']
        package = parts(path)
        assert package.keys() == base.keys()
        change = expected_changes[case['caseId']]
        assert case['changes'] == change
        assert sorted(k for k in base if package[k] != base[k]) == case['changedParts'] == (
            [fixtures.SECTION] if change else [])
        section = etree.fromstring(package[fixtures.SECTION])
        equations = section.findall(f'.//{{{HP}}}equation')
        assert len(equations) == 3
        content_red = os.getenv('H1_EQUATION_CONTENT_RED')
        if content_red == 'script':
            equations[0].find(f'{{{HP}}}script').text = 'x'
        if content_red == 'order':
            paragraph = next(p for p in section.findall(f'{{{HP}}}p') if p.find(f'.//{{{HP}}}equation') is not None)
            after = paragraph.findall(f'{{{HP}}}run')[-1]
            paragraph.remove(after)
            paragraph.insert(0, after)
        assert [eq.find(f'{{{HP}}}script').text for eq in equations] == EXPECTED_SCRIPTS, 'EQUATION_INPUT_MEANING_LOST'
        observed = []
        for paragraph in section.findall(f'{{{HP}}}p'):
            tokens = []
            for run in paragraph.findall(f'{{{HP}}}run'):
                for node in run:
                    if node.tag == f'{{{HP}}}t' and node.text:
                        tokens.append(('text', node.text))
                    elif node.tag == f'{{{HP}}}equation':
                        tokens.append(('equation', node.find(f'{{{HP}}}script').text))
            if tokens:
                observed.append(tokens)
        assert observed == EXPECTED_PARAGRAPHS, 'EQUATION_MIXED_ORDER_LOST'
        for equation, original in zip(equations, base_xml.findall(f'.//{{{HP}}}equation')):
            if os.getenv('H1_EQUATION_RED') == '1' and case['caseId'] == 'all-zero':
                equation.set('baseLine', '93')
            for key, value in change.items():
                tag = 'pos' if key == 'affectLSpacing' else 'sz'
                node = equation if key == 'baseLine' else equation.find(f'{{{HP}}}{tag}')
                original_node = original if key == 'baseLine' else original.find(f'{{{HP}}}{tag}')
                assert node.get(key) == value, 'EQUATION_GEOMETRY_MUTATION_LOST'
                assert original_node.get(key) is not None, 'ATTRIBUTE_ABSENT_IN_CONTROL'
                node.set(key, original_node.get(key))
        assert etree.tostring(section, method='c14n') == canonical_base, 'EQUATION_UNRELATED_CHANGE'
        assert all(case[k] == 'unknown' for k in ['observedOpen', 'content', 'save', 'pdf'])
        if case['caseId'] == 'control-after':
            assert path.read_bytes() == (out / 'h1e-control.hwpx').read_bytes()
    assert json.loads((out / 'manifest.json').read_text()) == manifest
    try:
        fixtures.build(out)
        raise AssertionError('EQUATION_OVERWRITE_ALLOWED')
    except FileExistsError:
        pass
print('H1 equation fixtures: 7 geometry/content/isolation/no-overwrite checks PASS')
