#!/usr/bin/env python3
"""Grade F2 runs: which seeded holes each report names. usage: grade_f2.py <out dir>  -> JSON per run + summary."""
import collections, glob, json, os, re, statistics, sys
H = os.path.dirname(os.path.abspath(__file__)); OUT = sys.argv[1]
holes = {k: json.load(open(os.path.join(H, f"{k}-holes.json"))) for k in ("plan", "code")}
runs, agg = [], collections.defaultdict(list)
for p in sorted(glob.glob(os.path.join(OUT, "*-*-*.json"))):
    kind, effort, rep = os.path.basename(p)[:-5].split("-")
    d = json.load(open(p)); text = d.get("result", "")
    found = {h: bool(re.search(rx, text)) for h, rx in holes[kind].items()}
    r = {"kind": kind, "effort": effort, "rep": rep, "found": sum(found.values()), "of": len(found), "holes": found,
         "sec": round(d.get("duration_ms", 0) / 1000), "cost": round(d.get("total_cost_usd", 0), 2), "turns": d.get("num_turns"),
         "out_tok": d.get("usage", {}).get("output_tokens"), "denied": len(d.get("permission_denials", []))}
    runs.append(r); agg[(kind, effort)].append(r)
summary = {f"{k}/{e}": {"n": len(v), "found": [x["found"] for x in v], "median_s": statistics.median(x["sec"] for x in v),
           "cost_sum": round(sum(x["cost"] for x in v), 2)} for (k, e), v in sorted(agg.items())}
print(json.dumps({"runs": runs, "summary": summary}, indent=1))
