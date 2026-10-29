/* Real DOM section diagnostics parity; no localhost server or external requests. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../', import.meta.url));
const python = process.env.HWPX_PYTHON || 'python3';
const checker = 'scripts/check-hwpx-section-package.py';
const py = (args) => JSON.parse(execFileSync(python, [checker, ...args], {
  cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
  env: { ...process.env, H1_PACKAGE_BASELINE: '', H1_PACKAGE_RED: '' },
}));
const fixtures = py(['--fixtures']);
const baseline = process.env.H1_PACKAGE_JS_BASELINE;
const engine = baseline ? execFileSync('git', ['show', `${baseline}:hwpx-engine.js`], { cwd: root, encoding: 'utf8' })
  : readFileSync(new URL('../hwpx-engine.js', import.meta.url), 'utf8');
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.addScriptTag({ content: engine });
  const result = await page.evaluate(async ({ cases, red }) => {
    const make = (test) => {
      if (test.expected.pictureBytes) {
        const doc = make(cases.find((c) => c.name === 'one'));
        doc.appendPicture('section1.png', Uint8Array.from(atob(test.expected.pictureBytes), (c) => c.charCodeAt(0)));
        const items = doc.part('Contents/content.hpf').xml.getElementsByTagNameNS(window.PedagogyHwpx.NS.opf, 'item');
        if ([...items].some((i) => i.getAttribute('id') === 'section1')) throw new Error('PICTURE_RESERVED_ID');
        const imageId = doc.part('Contents/section0.xml').xml.getElementsByTagNameNS(window.PedagogyHwpx.NS.hc, 'img')[0].getAttribute('binaryItemIDRef');
        if (![...items].some((i) => i.getAttribute('id') === imageId && i.getAttribute('href') === 'BinData/section1.png')) throw new Error('PICTURE_REFERENCE_LOST');
        if (btoa(String.fromCharCode(...doc.part('BinData/section1.png').bytes)) !== test.expected.pictureBytes) throw new Error('PICTURE_BYTES_LOST');
        return doc;
      }
      return new window.PedagogyHwpx.HwpxDocument(new Map(Object.entries(test.parts).map(([path, part]) =>
        [path, part.xml ? { xml: new DOMParser().parseFromString(part.xml, 'application/xml') }
          : { bytes: Uint8Array.from(atob(part.base64), (c) => c.charCodeAt(0)) }])));
    };
    if (red === 'picture-id') {
      const original = window.PedagogyHwpx.HwpxDocument.prototype._manifestId;
      window.PedagogyHwpx.HwpxDocument.prototype._manifestId = function (preferred) {
        return preferred === 'section1' ? preferred : original.call(this, preferred);
      };
    }
    if (red === 'picture-id-parity') {
      const original = window.PedagogyHwpx.HwpxDocument.prototype._manifestId;
      window.PedagogyHwpx.HwpxDocument.prototype._manifestId = function (preferred) {
        const id = original.call(this, preferred);
        return preferred === 'section1' ? id.replace('_', '-') : id;
      };
    }
    if (['missing-href', 'namespace-ref'].includes(red)) {
      const original = window.PedagogyHwpx.HwpxDocument.prototype.referenceValidationErrors;
      window.PedagogyHwpx.HwpxDocument.prototype.referenceValidationErrors = function () {
        const errors = original.call(this);
        if (red === 'missing-href') return errors.filter((e) => e !== 'manifest references missing part: ');
        const refs = this.parts.get('Contents/header.xml')?.xml?.getElementsByTagNameNS(window.PedagogyHwpx.NS.hh, 'fontRef') || [];
        if ([...refs].some((r) => r.getAttributeNS('http://www.w3.org/2000/xmlns/', 'x') === 'urn:h1-review-x')) errors.push('injected namespace declaration as font');
        return errors;
      };
    }
    if (red === 'duplicate-missing') {
      const original = window.PedagogyHwpx.HwpxDocument.prototype.strictValidate;
      window.PedagogyHwpx.HwpxDocument.prototype.strictValidate = function () {
        try { return original.call(this); } catch (error) {
          if (error.message.includes('[section-target-missing] Contents/section0.xml')) throw new Error(error.message + '; missing Contents/section0.xml');
          throw error;
        }
      };
    }
    if (red === 'resource-classification') {
      const original = window.PedagogyHwpx.HwpxDocument.prototype.sectionPackageDiagnostics;
      window.PedagogyHwpx.HwpxDocument.prototype.sectionPackageDiagnostics = function (options) {
        const diagnostics = original.call(this, options);
        if (this.parts.has('BinData/research.bin')) diagnostics.push({ code: 'section-target-invalid', severity: 'error', kind: 'integrity',
          part: 'BinData/research.bin', message: 'injected resource misclassification' });
        return diagnostics;
      };
    }
    const loss = make(cases.find((c) => c.name === 'count-small'));
    let blocked = false;
    try { loss.strictValidate(); } catch (e) { blocked = e.message.includes('[section-count-mismatch]'); }
    if (!blocked) throw new Error('SECTION_COUNT_LOSS_UNBLOCKED');
    const results = [];
    for (const test of cases) {
      const doc = make(test);
      let picture = null;
      if (test.expected.pictureBytes) {
        const id = doc.part('Contents/section0.xml').xml.getElementsByTagNameNS(window.PedagogyHwpx.NS.hc, 'img')[0].getAttribute('binaryItemIDRef');
        const items = doc.part('Contents/content.hpf').xml.getElementsByTagNameNS(window.PedagogyHwpx.NS.opf, 'item');
        picture = { id, href: [...items].find((i) => i.getAttribute('id') === id).getAttribute('href') };
      }
      const contents = () => JSON.stringify([...doc.parts].map(([path, part]) =>
        [path, part.xml ? new XMLSerializer().serializeToString(part.xml) : [...part.bytes]]));
      const before = contents();
      const inspect = doc.sectionPackageDiagnostics();
      const output = doc.sectionPackageDiagnostics({ profile: 'pedagogy-export' });
      for (const [diags, exact] of [[inspect, test.expected.exactInspect], [output, test.expected.exactExport]]) {
        if (exact && JSON.stringify([...new Set(diags.map((d) => `${d.code}:${d.severity}:${d.kind}`))].sort()) !== JSON.stringify([...exact].sort())) {
          throw new Error('UNEXPECTED_SECTION_DIAGNOSTIC');
        }
      }
      let rejected = false, error = '';
      try { doc.strictValidate(); } catch (e) { rejected = true; error = e.message; }
      if (test.expected.uniqueMissing && error.split(test.expected.uniqueMissing).length !== 2) throw new Error('SECTION_DUPLICATE_MISSING_MESSAGE');
      for (const diag of output) {
        if (diag.severity === 'error' && diag.code !== 'section-required-part-missing' && !error.includes(`[${diag.code}]`)) {
          throw new Error(`Missing strict code: ${test.name} ${diag.code}`);
        }
      }
      const references = doc.referenceValidationErrors();
      if (test.name === 'resource-without-href' && JSON.stringify(references) !== JSON.stringify(['manifest references missing part: '])) throw new Error('MANIFEST_HREF_MISSING_UNCHECKED');
      if (test.name === 'fontref-local-namespace' && references.length) throw new Error('NAMESPACE_DECLARATION_AS_FONT');
      if (test.expected.reference && !references.some((s) => s.includes(test.expected.reference))) {
        throw new Error(`Independent reference guard skipped: ${test.name}`);
      }
      let blob;
      try { blob = await doc.toBlob(); } catch (e) {
        if (!rejected) throw e;
      }
      if (Boolean(blob) === rejected) throw new Error('SECTION_BLOB_GATE_BYPASSED');
      if (blob) {
        const reopened = await window.PedagogyHwpx.HwpxDocument.open(await blob.arrayBuffer());
        if (reopened.sectionPackageDiagnostics({ profile: 'pedagogy-export' }).length) throw new Error('Roundtrip diagnostic changed');
        for (const path of doc._sectionCatalogPaths()) {
          if (doc.part(path).xml.documentElement.textContent !== reopened.part(path).xml.documentElement.textContent) throw new Error('Roundtrip section content changed');
        }
        for (const [path,part] of doc.parts) {
          if (part.bytes && JSON.stringify([...part.bytes]) !== JSON.stringify([...reopened.part(path).bytes])) throw new Error('BINARY_ROUNDTRIP_CHANGED');
        }
      }
      if (contents() !== before) throw new Error('SECTION_DIAGNOSTIC_MUTATED_INPUT');
      if (JSON.stringify(inspect) !== JSON.stringify(doc.sectionPackageDiagnostics())) throw new Error('Profile order changed result');
      results.push({ name: test.name, inspect, export: output, picture, references, rejected });
    }
    let badProfile = false;
    try { make(cases[0]).sectionPackageDiagnostics({ profile: 'typo' }); } catch { badProfile = true; }
    if (!badProfile) throw new Error('SECTION_UNKNOWN_PROFILE_ACCEPTED');
    return results;
  }, { cases: fixtures, red: process.env.H1_PACKAGE_JS_RED });
  const expected = py(['--json']);
  assert.deepEqual(result, expected, 'SECTION_PACKAGE_PARITY');
  console.log(`H1 section package: ${result.length} real DOM/Python profile/strict/roundtrip cases PASS`);
} finally {
  await browser.close();
}
