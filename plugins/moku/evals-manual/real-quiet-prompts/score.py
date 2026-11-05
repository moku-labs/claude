#!/usr/bin/env python3
"""Score one run of the real case. usage: score.py <memory_missing repo> <run dir>
- hidden: the test file of the real fix (2a74eacb) run against the agent's code
- regression: the board feature's unit + integration tests on the agent's tree
- typecheck: tsc --noEmit on the agent's tree
- kill: the agent's changed/new test files run against the real fix with each mutant
- scope: lines changed outside tests"""
import json, os, re, shutil, subprocess, sys, tempfile
HERE = os.path.dirname(os.path.abspath(__file__)); SRC, RUN = sys.argv[1], os.path.abspath(sys.argv[2])
RULES = "features/board/rules/prompts.ts"; HIDDEN = "features/board/__tests__/unit/prompts.test.ts"
def sh(cmd, cwd, t=900):
    r = subprocess.run(cmd, cwd=cwd, shell=True, capture_output=True, text=True, timeout=t); return r.returncode, r.stdout + r.stderr
def vit(cwd, paths):
    code, out = sh(f"bunx vitest run {' '.join(paths)}", cwd)
    p = re.search(r"Tests\s+(?:\x1b\[[0-9;]*m)*\s*(?:(\d+) failed[^|]*\|\s*)?(?:\x1b\[[0-9;]*m)*(\d+) passed", re.sub(r"\x1b\[[0-9;]*m", "", out))
    return code == 0, out
res = {"run": os.path.basename(RUN)}
_, st = sh("git status --porcelain --untracked-files=all", RUN)
changed = [l[3:] for l in st.splitlines() if l[3:] and not l[3:].startswith(".planning")]
tests = [f for f in changed if "__tests__" in f and f.endswith(".ts")]
res["changed_files"] = changed
_, num = sh("git diff --numstat -- . ':(exclude)**/__tests__/**'", RUN)
res["src_lines_changed"] = sum(int(a) + int(b) for a, b, *_ in (l.split("\t") for l in num.splitlines() if l and l[0].isdigit()))
res["own_tests_green"], _ = vit(RUN, tests or [HIDDEN])
res["board_suite_green"], _ = vit(RUN, ["features/board"])
_, out = sh("bunx tsc --noEmit", RUN)  # the snapshot already has 1 error in plugins/perf-hud (newer node_modules)
res["tsc_new_errors"] = sum(1 for l in out.splitlines() if "error TS" in l and "plugins/perf-hud/" not in l)
tmp = tempfile.mkdtemp(); W = os.path.join(tmp, "w")
shutil.copytree(RUN, W, symlinks=True, ignore=shutil.ignore_patterns(".git"))
fix_test = subprocess.run(["git", "-C", SRC, "show", f"2a74eacb:{HIDDEN}"], capture_output=True, text=True).stdout
own_hidden = open(os.path.join(W, HIDDEN)).read()
open(os.path.join(W, HIDDEN), "w").write(fix_test)
res["hidden_green"], _ = vit(W, [HIDDEN])
open(os.path.join(W, HIDDEN), "w").write(own_hidden)
ref = subprocess.run(["git", "-C", SRC, "show", f"2a74eacb:{RULES}"], capture_output=True, text=True).stdout
open(os.path.join(W, RULES), "w").write(ref)
ok_ref, _ = vit(W, tests or [HIDDEN]); res["own_tests_green_on_real_fix"] = ok_ref
killed, total = 0, 0
for a, b in json.load(open(os.path.join(HERE, "mutants.json"))):
    total += 1; open(os.path.join(W, RULES), "w").write(ref.replace(a, b, 1))
    ok, _ = vit(W, tests or [HIDDEN]); killed += not ok
res["killed"] = f"{killed}/{total}"; res["kill_rate"] = round(killed / total, 2) if ok_ref else None
shutil.rmtree(tmp); print(json.dumps(res))
