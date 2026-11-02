'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { packageExtension } = require('../scripts/package-extension.cjs');

const ROOT = path.resolve(__dirname, '..');

test('release packaging is deterministic across invocations and writes a matching SHA-256 sidecar', (t) => {
  const outputDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'bilibili-focus-package-test-'));
  t.after(() => fs.rmSync(outputDirectory, { recursive: true, force: true }));

  const first = packageExtension({ root: ROOT, outputDirectory });
  const firstArchive = fs.readFileSync(first.archivePath);
  const second = packageExtension({ root: ROOT, outputDirectory });
  const secondArchive = fs.readFileSync(second.archivePath);
  const digest = crypto.createHash('sha256').update(secondArchive).digest('hex');

  assert.deepEqual(secondArchive, firstArchive);
  assert.equal(second.sha256, digest);
  assert.equal(
    fs.readFileSync(second.digestPath, 'utf8'),
    `${digest}  ${path.basename(second.archivePath)}\n`
  );
});
