#!/usr/bin/env python3
"""Input-based section diagnostics checks. --fixtures emits the same cases for real-browser parity."""
import base64
import copy
import json
import os
from pathlib import Path
import subprocess
import struct
import sys
import types
import tempfile
import zlib
from lxml import etree

ROOT = Path(__file__).resolve().parents[1]
ENGINE = ROOT / 'experiments/hwp-export/pedagogy_hwpx.py'
baseline = os.getenv('H1_PACKAGE_BASELINE')
runtime = types.ModuleType('section_package_runtime')
runtime.__file__ = str(ENGINE)
sys.modules[runtime.__name__] = runtime
source = subprocess.check_output(['git', 'show', f'{baseline}:experiments/hwp-export/pedagogy_hwpx.py'], cwd=ROOT, text=True) if baseline else ENGINE.read_text()
exec(compile(source, str(ENGINE), 'exec'), runtime.__dict__)
D, qn = runtime.HwpxDocument, runtime.qn
HEADER, HPF = 'Contents/header.xml', 'Contents/content.hpf'
if os.getenv('H1_PACKAGE_RED') == 'duplicate-missing':
    original_strict = D.strict_validate
    def duplicate_missing(self):
        try:
            return original_strict(self)
        except ValueError as error:
            if '[section-target-missing] Contents/section0.xml' in str(error):
                raise ValueError(str(error) + '; missing Contents/section0.xml') from error
            raise
    D.strict_validate = duplicate_missing
if os.getenv('H1_PACKAGE_RED') == 'resource-classification':
    original_diagnostics = D.section_package_diagnostics
    def resource_classification(self, profile='inspect'):
        diagnostics = original_diagnostics(self, profile)
        if 'BinData/research.bin' in self._parts:
            diagnostics.append({'code':'section-target-invalid', 'severity':'error', 'kind':'integrity',
                                'part':'BinData/research.bin', 'message':'injected resource misclassification'})
        return diagnostics
    D.section_package_diagnostics = resource_classification
if os.getenv('H1_PACKAGE_RED') == 'picture-id':
    original_manifest_id = D._manifest_id
    D._manifest_id = lambda self, preferred: preferred if preferred == 'section1' else original_manifest_id(self, preferred)
if os.getenv('H1_PACKAGE_RED') in ('missing-href', 'namespace-ref'):
    original_references = D.reference_validation_errors
    def inject_reference_error(self):
        errors = original_references(self)
        if os.getenv('H1_PACKAGE_RED') == 'missing-href':
            return [e for e in errors if e != 'manifest references missing part: ']
        head = self._xml_root(HEADER, 'hh', 'head')
        if head is not None and any(ref.nsmap.get('x') == 'urn:h1-review-x' for ref in head.iter(qn('hh','fontRef'))):
            errors.append('injected namespace declaration as font')
        return errors
    D.reference_validation_errors = inject_reference_error

def make(count=2):
    doc = D.blank()
    section_seed = copy.deepcopy(doc.get_part('Contents/section0.xml'))
    for i in range(count):
        path = f'Contents/section{i}.xml'
        if i:
            doc._parts[path] = copy.deepcopy(section_seed)
            doc._parts[path].path = path
            manifest = doc.get_part(HPF).element.find(qn('opf', 'manifest'))
            etree.SubElement(manifest, qn('opf', 'item'), id=f'section{i}', href=path, **{'media-type': 'application/xml'})
        doc.append_paragraph(f'H1 canonical section {i}', section_index=i)
    doc.get_part(HEADER).element.set('secCnt', str(count))
    return doc

def item(doc, id='section0'):
    return doc.get_part(HPF).element.find(f'./opf:manifest/opf:item[@id="{id}"]', runtime.NS)

def rename(doc):
    old, new = 'Contents/section0.xml', 'Contents/body-alias.xml'
    doc._parts[new] = doc._parts.pop(old)
    doc._parts[new].path = new
    item(doc).set('href', new)

def catalog(doc):
    return {path: part.to_bytes() for path, part in doc._parts.items()}

cases = []
def case(name, mutation=None, expected=None, count=2):
    doc = make(count)
    if mutation:
        mutation(doc)
    cases.append((name, doc, expected or {}))

case('one', count=1)
case('two')
case('three', count=3)
for value, label in [('1', 'small'), ('3', 'large'), ('9' * 5000, 'huge')]:
    case(f'count-{label}', lambda d, v=value: d.get_part(HEADER).element.set('secCnt', v),
         {'inspect': ['section-count-mismatch:warning'], 'export': ['section-count-mismatch:error']})
for value, label in [('0','zero'),('0000','zeros'),('1 2','inner-space'),('+ 2','plus-space'),('2.0','decimal'),('2e0','exponent'),('0x2','hex'),('Infinity','infinity'),('-2','negative'),('\u00a02','nbsp'),('２','wide-digit'),('٢','arabic-digit')]:
    case('invalid-'+label, lambda d, v=value: d.get_part(HEADER).element.set('secCnt', v),
         {'both': ['section-count-invalid:error']})
case('missing-count', lambda d: d.get_part(HEADER).element.attrib.pop('secCnt'), {'both': ['section-count-invalid:error']})
for value, label in [('+0002','plus-zero'),(' \t2\r\n','xml-space'),('+'+'0'*5000+'2','long-zero')]:
    case('valid-'+label, lambda d, v=value: d.get_part(HEADER).element.set('secCnt', v))
case('alias', rename, {'inspect': ['section-mapping-unsupported:warning'], 'export': ['section-mapping-unsupported:error']})
def broken_alias(doc):
    rename(doc)
    doc.get_part('Contents/body-alias.xml').element.find('.//hp:run', runtime.NS).set('charPrIDRef', '999999')
case('alias-broken-style', broken_alias, {'inspect': ['section-mapping-unsupported:warning'], 'export': ['section-mapping-unsupported:error'], 'reference': '999999'})
def swap(doc):
    first, second = item(doc), item(doc, 'section1')
    first.set('href', 'Contents/section1.xml')
    second.set('href', 'Contents/section0.xml')
case('swapped', swap, {'inspect': ['section-mapping-unsupported:warning'], 'export': ['section-mapping-unsupported:error']})
case('id-gap', lambda d: item(d, 'section1').set('id', 'section2'), {'inspect': ['section-id-unsupported:warning'], 'export': ['section-id-unsupported:error']})
case('duplicate-id', lambda d: item(d, 'section1').set('id', 'section0'), {'both': ['section-id-duplicate:error']})
case('duplicate-target', lambda d: item(d, 'section1').set('href', 'Contents/section0.xml'), {'both': ['section-target-duplicate:error']})
case('target-missing', lambda d: item(d).set('href', 'Contents/not-there.xml'), {'both': ['section-target-missing:error']})
case('missing-section-part', lambda d: d.remove_part('Contents/section0.xml'), {'both': ['section-target-missing:error'], 'uniqueMissing':'Contents/section0.xml'})
case('target-wrong-root', lambda d: setattr(d.get_part('Contents/section0.xml'), 'element', etree.Element(qn('hp', 'p'))), {'both': ['section-target-invalid:error']})
case('unreferenced', lambda d: item(d, 'section1').getparent().remove(item(d, 'section1')), {'inspect': ['section-unreferenced:warning'], 'export': ['section-unreferenced:error']})
def fake_name(doc):
    doc._parts['Contents/sectionFake.xml'] = copy.deepcopy(doc.get_part(HEADER))
case('filename-is-not-root', fake_name)
def fake_broken(doc):
    fake_name(doc)
    etree.SubElement(doc.get_part('Contents/sectionFake.xml').element, qn('hp','run'), charPrIDRef='999999')
case('filename-broken-style', fake_broken, {'reference': '999999'})
def reverse_manifest(doc):
    node = doc.get_part(HPF).element.find(qn('opf', 'manifest'))
    node[:] = list(reversed(node))
case('manifest-order', reverse_manifest)
def no_spine(doc):
    node = doc.get_part(HPF).element.find(qn('opf', 'spine'))
    node[:] = []
case('no-spine', no_spine)
def nested_manifest(doc):
    root = doc.get_part(HPF).element
    manifest = root.find(qn('opf', 'manifest'))
    root.remove(manifest)
    root.find(qn('opf', 'metadata')).append(manifest)
case('nested-manifest', nested_manifest, {'both': ['section-manifest-missing:error']})
case('two-manifests', lambda d: d.get_part(HPF).element.append(etree.Element(qn('opf','manifest'))), {'both': ['section-manifest-ambiguous:error']})
for path in [HEADER, HPF]:
    case('missing-'+Path(path).stem, lambda d,p=path: d.remove_part(p), {'both': ['section-required-part-missing:error']})
    case('wrong-root-'+Path(path).stem, lambda d,p=path: setattr(d.get_part(p), 'element', etree.Element('wrong')), {'both': ['section-root-invalid:error']})
    case('wrong-namespace-'+Path(path).stem, lambda d,p=path: setattr(d.get_part(p), 'element', etree.Element('{urn:wrong}'+('head' if p==HEADER else 'package'))), {'both': ['section-root-invalid:error']})
case('both-parts-missing', lambda d: (d.remove_part(HEADER),d.remove_part(HPF)), {'both': ['section-required-part-missing:error']})
def missing_header_extra(doc):
    doc.remove_part(HEADER)
    etree.SubElement(doc.get_part(HPF).element.find(qn('opf','manifest')), qn('opf','item'), id='other', href='Contents/absent.xml')
    item(doc, 'section1').set('id','section0')
case('missing-header-extra', missing_header_extra, {'both': ['section-required-part-missing:error','section-id-duplicate:error'], 'reference': 'Contents/absent.xml'})
def missing_hpf_extra(doc):
    doc.remove_part(HPF)
    doc.get_part(HEADER).element.find('.//hh:styles', runtime.NS).set('itemCnt', '999')
    doc.get_part(HEADER).element.set('secCnt','1')
case('missing-hpf-extra', missing_hpf_extra, {'both': ['section-required-part-missing:error'], 'inspect':['section-count-mismatch:warning'], 'export':['section-count-mismatch:error'], 'reference': 'itemCnt'})
def resource(doc, id='section3'):
    path = 'BinData/research.bin'
    doc._parts[path] = runtime._Part(path, raw=b'self-authored resource')
    etree.SubElement(doc.get_part(HPF).element.find(qn('opf','manifest')), qn('opf','item'), id=id, href=path, **{'media-type':'application/octet-stream'})
resource_expected = {'exactInspect':['section-id-unsupported:warning:unsupported','section-target-unsupported:warning:unsupported'],
                     'exactExport':['section-id-unsupported:error:unsupported','section-target-unsupported:error:unsupported']}
case('numeric-resource-id', resource, resource_expected)
case('numeric-resource-aliases', lambda d: (resource(d,'section3'),resource(d,'section4')), resource_expected)
def shared_resource_id(doc):
    item(doc).set('id','body')
    resource(doc,'body')
case('resource-shares-section-id', shared_resource_id,
     {'exactInspect':['section-id-duplicate:error:integrity','section-id-unsupported:warning:unsupported','section-mapping-unsupported:warning:unsupported'],
      'exactExport':['section-id-duplicate:error:integrity','section-id-unsupported:error:unsupported','section-mapping-unsupported:error:unsupported']})
case('ordinary-resource', lambda d: resource(d,'research'))
case('numeric-id-missing-resource', lambda d: etree.SubElement(d.get_part(HPF).element.find(qn('opf','manifest')), qn('opf','item'), id='section3', href='BinData/absent.bin'),
     {'both':['section-target-missing:error'], 'uniqueMissing':'BinData/absent.bin'})
def png_chunk(kind, data):
    return struct.pack('>I',len(data)) + kind + data + struct.pack('>I',zlib.crc32(kind+data) & 0xffffffff)
PNG = (b'\x89PNG\r\n\x1a\n' + png_chunk(b'IHDR',struct.pack('>IIBBBBB',1,1,8,2,0,0,0))
       + png_chunk(b'IDAT',zlib.compress(b'\x00\x00\x00\x00')) + png_chunk(b'IEND',b''))
case('picture-section-name', lambda d: d.append_picture('section1.png', PNG),
     {'pictureBytes':base64.b64encode(PNG).decode()}, count=1)
case('resource-without-href', lambda d: etree.SubElement(d.get_part(HPF).element.find(qn('opf','manifest')), qn('opf','item'), id='plain-resource'),
     {'reference':'manifest references missing part: '})
def font_namespace(doc, bad=False):
    old = doc.get_part(HEADER).element.find('.//hh:fontRef', runtime.NS)
    new = etree.Element(old.tag, attrib=dict(old.attrib), nsmap={**old.nsmap, 'x':'urn:h1-review-x'})
    old.getparent().replace(old,new)
    if bad:
        new.set('hangul','999999')
case('fontref-local-namespace', font_namespace)
case('fontref-local-namespace-bad-id', lambda d: font_namespace(d,True), {'reference':'999999'})

if '--fixtures' in sys.argv:
    print(json.dumps([{'name':name, 'expected':expected, 'parts':{path: {'xml': etree.tostring(part.element, encoding='unicode')} if part.element is not None else {'base64':base64.b64encode(part.raw).decode()} for path,part in doc._parts.items()}} for name,doc,expected in cases]))
    raise SystemExit(0)

# Against the old engine fail for the actual content-loss hole, not just a missing new API.
loss = next(d for name,d,_ in cases if name == 'count-small')
try:
    loss.strict_validate()
except ValueError as error:
    assert '[section-count-mismatch]' in str(error), str(error)
else:
    raise AssertionError('SECTION_COUNT_LOSS_UNBLOCKED')

results = []
for name, doc, expected in cases:
    before = catalog(doc)
    picture = None
    if expected.get('pictureBytes'):
        assert item(doc, 'section1') is None, 'PICTURE_RESERVED_ID'
        image_id = doc.get_part('Contents/section0.xml').element.find('.//hc:img', runtime.NS).get('binaryItemIDRef')
        assert item(doc,image_id).get('href') == 'BinData/section1.png', 'PICTURE_REFERENCE_LOST'
        assert doc.get_part('BinData/section1.png').raw == PNG, 'PICTURE_BYTES_LOST'
        picture = {'id':image_id, 'href':item(doc,image_id).get('href')}
    pair = {}
    for key, profile in [('inspect','inspect'), ('export','pedagogy-export')]:
        diags = doc.section_package_diagnostics(profile=profile)
        pairs = {d['code']+':'+d['severity'] for d in diags}
        wanted = set(expected.get('both', []) + expected.get(key, []))
        assert wanted <= pairs, (name, profile, wanted, pairs)
        exact = expected.get('exactInspect' if key=='inspect' else 'exactExport')
        if exact is not None:
            assert {d['code']+':'+d['severity']+':'+d['kind'] for d in diags} == set(exact), 'UNEXPECTED_SECTION_DIAGNOSTIC'
        elif not wanted:
            assert not diags, (name, profile, diags)
        pair[key] = diags
    references = doc.reference_validation_errors()
    if name == 'resource-without-href':
        assert references == ['manifest references missing part: '], 'MANIFEST_HREF_MISSING_UNCHECKED'
    if name == 'fontref-local-namespace':
        assert not references, 'NAMESPACE_DECLARATION_AS_FONT'
    if expected.get('reference'):
        assert any(expected['reference'] in e for e in references), (name, references)
    try:
        doc.strict_validate()
        rejected = False
    except ValueError as error:
        rejected = True
        if expected.get('uniqueMissing'):
            assert str(error).count(expected['uniqueMissing']) == 1, 'SECTION_DUPLICATE_MISSING_MESSAGE'
        for diag in pair['export']:
            if diag['severity'] == 'error' and diag['code'] != 'section-required-part-missing':
                assert '['+diag['code']+']' in str(error), (name, str(error), diag)
    assert rejected == (any(d['severity']=='error' for d in pair['export']) or bool(references)), name
    with tempfile.TemporaryDirectory(prefix='h1-section-save-') as temp:
        out = Path(temp) / 'output.hwpx'
        saved = False
        try:
            doc.save(out)
            saved = True
        except ValueError:
            assert not out.exists(), 'SECTION_REJECTED_OUTPUT_WRITTEN'
        assert saved != rejected, 'SECTION_SAVE_GATE_BYPASSED'
        if saved:
            reopened = D.open(out)
            assert not reopened.section_package_diagnostics('pedagogy-export')
            for path in doc._section_paths():
                assert ''.join(doc.get_part(path).element.itertext()) == ''.join(reopened.get_part(path).element.itertext())
            for path,part in doc._parts.items():
                if part.element is None:
                    assert reopened.get_part(path).raw == part.raw, 'BINARY_ROUNDTRIP_CHANGED'
    assert pair['inspect'] == doc.section_package_diagnostics(), name
    assert before == catalog(doc), 'SECTION_DIAGNOSTIC_MUTATED_INPUT'
    results.append({'name':name, **pair, 'picture':picture, 'references':references, 'rejected':rejected})
try:
    D.blank().section_package_diagnostics(profile='typo')
    raise AssertionError('SECTION_UNKNOWN_PROFILE_ACCEPTED')
except ValueError:
    pass
print(json.dumps(results, ensure_ascii=False) if '--json' in sys.argv else f'H1 section package: {len(results)} profile/strict/alias/guard/input-preservation checks PASS')
