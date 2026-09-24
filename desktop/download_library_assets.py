#!/usr/bin/env python3
"""Download all scratch-gui library assets into desktop/library-assets/.

The editor's sprite/backdrop/costume/sound libraries reference assets by md5 on
assets.scratch.mit.edu, which is unreachable from mainland China networks. This
script fetches every referenced asset once (needs a working proxy) so the desktop
app can serve them locally afterwards.

Usage:
    python download_library_assets.py                 # direct connection
    python download_library_assets.py --proxy http://127.0.0.1:7890

Existing files that already match their md5 are skipped, so the script is safe
to re-run after interruptions.
"""
import argparse
import concurrent.futures
import glob
import hashlib
import json
import os
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # repo root
LIB_DIR = os.path.join(ROOT, 'packages', 'scratch-gui', 'src', 'lib', 'libraries')
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'library-assets')
CDN = 'https://cdn.assets.scratch.mit.edu/internalapi/asset/{name}/get/'


def collect_md5s():
    md5s = set()

    def walk(obj):
        if isinstance(obj, dict):
            for key, value in obj.items():
                if key in ('md5', 'md5ext', 'baseLayerMD5') and isinstance(value, str):
                    md5s.add(value)
                walk(value)
        elif isinstance(obj, list):
            for item in obj:
                walk(item)

    for path in glob.glob(os.path.join(LIB_DIR, '*.json')):
        with open(path, encoding='utf-8') as f:
            walk(json.load(f))
    return sorted(md5s)


def download_one(name, opener):
    out_path = os.path.join(OUT_DIR, name)
    expected_md5, _ext = name.split('.', 1)
    if os.path.exists(out_path):
        with open(out_path, 'rb') as f:
            if hashlib.md5(f.read()).hexdigest() == expected_md5:
                return ('skipped', name, 0)
    url = CDN.format(name=name)
    last_err = None
    for attempt in range(3):
        try:
            with opener.open(url, timeout=60) as resp:
                data = resp.read()
            actual = hashlib.md5(data).hexdigest()
            if actual != expected_md5:
                raise ValueError('md5 mismatch: got %s' % actual)
            with open(out_path, 'wb') as f:
                f.write(data)
            return ('ok', name, len(data))
        except Exception as e:  # noqa: BLE001 - report and retry
            last_err = e
    return ('failed', name, str(last_err))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--proxy', default=None, help='e.g. http://127.0.0.1:7890')
    parser.add_argument('--workers', type=int, default=6)
    args = parser.parse_args()

    handlers = []
    if args.proxy:
        handlers.append(urllib.request.ProxyHandler({
            'http': args.proxy,
            'https': args.proxy,
        }))
        opener = urllib.request.build_opener(*handlers)
    else:
        opener = urllib.request.build_opener()

    names = collect_md5s()
    print('assets referenced by libraries: %d' % len(names))
    os.makedirs(OUT_DIR, exist_ok=True)

    ok = skipped = failed = 0
    total_bytes = 0
    failures = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(download_one, n, opener): n for n in names}
        for i, fut in enumerate(concurrent.futures.as_completed(futures), 1):
            status, name, info = fut.result()
            if status == 'ok':
                ok += 1
                total_bytes += info
            elif status == 'skipped':
                skipped += 1
            else:
                failed += 1
                failures.append((name, info))
            if i % 50 == 0 or i == len(names):
                print('  [%d/%d] ok=%d skipped=%d failed=%d' % (i, len(names), ok, skipped, failed))

    print('done. downloaded=%d skipped=%d failed=%d, %.1f MB new data' % (
        ok, skipped, failed, total_bytes / 1048576))
    if failures:
        print('\nfailed assets (first 20):')
        for name, err in failures[:20]:
            print('  %s: %s' % (name, err))
        sys.exit(1)


if __name__ == '__main__':
    main()
