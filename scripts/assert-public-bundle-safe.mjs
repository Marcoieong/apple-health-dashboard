#!/usr/bin/env node

import { readFile, readdir, stat } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import process from 'node:process';

export const FORBIDDEN_PUBLIC_MARKERS = Object.freeze([
  {
    id: 'chatgpt-download-url',
    pattern: /\bdownload[_-]?url\b/i
  },
  {
    id: 'chatgpt-file-id',
    pattern: /\bfile[_-]?id\b/i
  },
  {
    id: 'storage-object-key',
    pattern: /\b(?:object|storage)[_-]?key\b/i
  },
  {
    id: 'storage-bucket-identifier',
    pattern: /\bbucket[_-]?(?:name|key|id)\b/i
  },
  {
    id: 'uploaded-content-hash',
    pattern: /\b(?:content[_-]?hash|sha[-_]?256)\b/i
  },
  {
    id: 'embedded-exif-metadata',
    pattern: /\b(?:exif|xmp|iptc)\b/i
  },
  {
    id: 'embedded-gps-metadata',
    pattern:
      /\bgps[_-]?(?:latitude|longitude|altitude|timestamp|datestamp|info(?:ifdpointer)?)?\b/i
  },
  {
    id: 'embedded-device-metadata',
    pattern:
      /(?:\bdevice[_-]?(?:make|model|serial|identifier|id)\b|(?:["'`]device["'`]|\bdevice)\s*:)/i
  },
  {
    id: 'chat-thread-identifier',
    pattern: /\b(?:conversation|thread)[_-]?id\b/i
  },
  {
    id: 'chat-message-identifier',
    pattern: /\b(?:source[_-]?)?message[_-]?id\b/i
  },
  {
    id: 'private-owner-identifier',
    pattern: /\bowner[_-]?id\b/i
  }
]);

export class PublicBundlePrivacyError extends Error {
  constructor(message, report) {
    super(message);
    this.name = 'PublicBundlePrivacyError';
    this.report = report;
  }
}

function toPortablePath(path) {
  return path.split('\\').join('/');
}

function positionAt(text, offset) {
  const preceding = text.slice(0, offset);
  const lines = preceding.split('\n');

  return {
    line: lines.length,
    column: lines.at(-1).length + 1
  };
}

function inspectText(text, file, source, markers, seen) {
  const findings = [];

  for (const marker of markers) {
    marker.pattern.lastIndex = 0;
    const match = marker.pattern.exec(text);

    if (!match) {
      continue;
    }

    const findingKey = `${file}\0${marker.id}`;
    if (seen.has(findingKey)) {
      continue;
    }

    seen.add(findingKey);
    const position =
      source === 'contents' ? positionAt(text, match.index) : undefined;

    findings.push({
      marker: marker.id,
      file,
      source,
      ...(position ?? {})
    });
  }

  return findings;
}

async function collectFiles(directory, root) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  entries.sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    const absolutePath = resolve(directory, entry.name);

    if (entry.isSymbolicLink()) {
      const publicPath = toPortablePath(relative(root, absolutePath));
      throw new PublicBundlePrivacyError(
        `Refusing to scan a symbolic link in the public bundle: ${publicPath}`
      );
    }

    if (entry.isDirectory()) {
      files.push(...(await collectFiles(absolutePath, root)));
    } else if (entry.isFile()) {
      files.push(absolutePath);
    }
  }

  return files;
}

export async function scanPublicBundle(
  directory,
  { markers = FORBIDDEN_PUBLIC_MARKERS } = {}
) {
  const root = resolve(directory);
  let rootStats;

  try {
    rootStats = await stat(root);
  } catch {
    throw new PublicBundlePrivacyError(
      `Public bundle directory does not exist: ${root}`
    );
  }

  if (!rootStats.isDirectory()) {
    throw new PublicBundlePrivacyError(
      `Public bundle path is not a directory: ${root}`
    );
  }

  const files = await collectFiles(root, root);
  const findings = [];
  const seen = new Set();
  let bytesScanned = 0;

  for (const absolutePath of files) {
    const publicPath = toPortablePath(relative(root, absolutePath));
    const contents = await readFile(absolutePath);
    const text = contents.toString('utf8');

    bytesScanned += contents.byteLength;
    findings.push(
      ...inspectText(publicPath, publicPath, 'path', markers, seen),
      ...inspectText(text, publicPath, 'contents', markers, seen)
    );
  }

  return {
    root,
    filesScanned: files.length,
    bytesScanned,
    findings
  };
}

function formatFinding(finding) {
  const location =
    finding.source === 'contents'
      ? `${finding.file}:${finding.line}:${finding.column}`
      : finding.file;

  return `- ${location} [${finding.marker}; ${finding.source}]`;
}

export async function assertPublicBundleSafe(directory, options) {
  const report = await scanPublicBundle(directory, options);

  if (report.findings.length > 0) {
    const details = report.findings.map(formatFinding).join('\n');

    throw new PublicBundlePrivacyError(
      `Public bundle privacy scan failed with ${report.findings.length} finding(s):\n${details}`,
      report
    );
  }

  return report;
}

async function runCli() {
  const directory = process.argv[2] ?? 'dist';

  try {
    const report = await assertPublicBundleSafe(directory);
    process.stdout.write(
      `[privacy:scan] PASS — ${report.filesScanned} file(s), ${report.bytesScanned} byte(s) scanned.\n`
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown privacy scan failure.';
    process.stderr.write(`[privacy:scan] FAIL — ${message}\n`);
    process.exitCode = 1;
  }
}

const entryPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';

if (import.meta.url === entryPath) {
  await runCli();
}
