#!/usr/bin/env python3
"""After `claude plugin eval --keep-temp`: run the hidden acceptance tests in every kept run
and sum the tokens of the sandbox transcripts (main thread and subagents).

Usage: score_kept_runs.py <aggregate-result.json> <acceptance.test.ts> <out.json>
"""
import json, os, re, shutil, subprocess, sys, glob
agg, acc, out = sys.argv[1:4]
PR = {'opus': (4, 20, .20), 'fable': (10, 50, .25), 'sonnet': (2, 10, .20), 'haiku': (.1, .5, .01)}
def tokens(home):
    t = {'calls': 0, 'out': 0, 'cr': 0, 'cw': 0, 'usd': 0.0, 'peak_sub_ctx': 0, 'compactions': 0, 'subagents': 0}
    for f in glob.glob(home + '/projects/*/**/*.jsonl', recursive=True):
        sub = '/subagents/' in f; t['subagents'] += sub; seen = set()
        for line in open(f, errors='ignore'):
            if '"compact_boundary"' in line: t['compactions'] += 1
            if '"type":"assistant"' not in line: continue
            try: m = json.loads(line)['message']
            except Exception: continue
            u = m.get('usage')
            if not u or m.get('id') in seen: continue
            seen.add(m.get('id')); p = PR[next((k for k in PR if k in m.get('model', '')), 'opus')]
            cw, cr = u.get('cache_creation_input_tokens', 0), u.get('cache_read_input_tokens', 0)
            t['calls'] += 1; t['out'] += u.get('output_tokens', 0); t['cr'] += cr; t['cw'] += cw
            t['usd'] += (u.get('input_tokens', 0) * p[0] + u.get('output_tokens', 0) * p[1] + cw * p[0] * (1.25 if sub else 2) + cr * p[2]) / 1e6
            if sub: t['peak_sub_ctx'] = max(t['peak_sub_ctx'], u.get('input_tokens', 0) + cw + cr)
    t['usd'] = round(t['usd'], 2); return t
rows = []
for c in json.load(open(agg))['cases']:
    for r in c['arms'].get('with', []):
        root = os.path.dirname(os.path.dirname(r['tracePath']))      # .../e-XXXX
        home = root + '/sealed/home' if os.path.isdir(root + '/sealed/home') else root + '/home'; cwd = home + '/cwd'
        row = {'case': c['name'], 'score': r['score'], 'turns': r['turns'], 'runner_usd': round(r['costUsd'], 2), 'seconds': r['durationSeconds'], 'error': r['error']}
        if os.path.isdir(cwd):
            shutil.copy(acc, cwd + '/acceptance.test.ts')
            p = subprocess.run(['bun', 'test', './acceptance.test.ts'], cwd=cwd, capture_output=True, text=True, timeout=120)
            txt = p.stdout + p.stderr
            row['acc_pass'] = int((re.findall(r'(\d+) pass', txt) or ['0'])[-1]); row['acc_fail'] = int((re.findall(r'(\d+) fail', txt) or ['0'])[-1])
            q = subprocess.run(['bun', 'test', 'src'], cwd=cwd, capture_output=True, text=True, timeout=120); qt = q.stdout + q.stderr
            row['own_tests_pass'] = int((re.findall(r'(\d+) pass', qt) or ['0'])[-1]); row['own_tests_fail'] = int((re.findall(r'(\d+) fail', qt) or ['0'])[-1])
            row.update(tokens(root + '/config'))
            row['agent_types'] = sorted({json.load(open(m)).get('agentType', '?') for m in glob.glob(root + '/config/projects/*/*/subagents/*.meta.json')})
        rows.append(row); print(row)
json.dump(rows, open(out, 'w'), indent=1)
