#!/usr/bin/env python3
"""
Compare C# (and summarize C++) paths under _navimesh vs DeukNavigation using Git history only.
Uses: git log -1 --format=%%ct %%h -- <path>  (newer = larger commit timestamp)

Run from workspace root i/:
  python DeukPack/scripts/navimesh_csharp_sync_report.py
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path
from typing import Iterable


def repo_root() -> Path:
    p = Path(__file__).resolve()
    return p.parents[2]


def to_git_path(root: Path, path: Path) -> str:
    try:
        return path.resolve().relative_to(root.resolve()).as_posix()
    except ValueError:
        return path.as_posix()


def git_last_log(root: Path, path: Path) -> tuple[str, str, str]:
    """
    Returns (commit_unix_ts, short_hash, iso_date) or ("-", "-", "-") if unknown/untracked.
    """
    rel = to_git_path(root, path)
    r = subprocess.run(
        ["git", "log", "-1", "--format=%ct %h %cI", "--", rel],
        cwd=root,
        capture_output=True,
        text=True,
    )
    if r.returncode != 0 or not r.stdout.strip():
        return "-", "-", "-"
    parts = r.stdout.strip().split(None, 2)
    if len(parts) < 2:
        return "-", "-", "-"
    ts, h = parts[0], parts[1]
    iso = parts[2] if len(parts) > 2 else ""
    return ts, h, iso


def newer_by_git(ts_a: str, ts_b: str) -> str:
    if ts_a == "-" and ts_b == "-":
        return "-"
    if ts_a == "-":
        return "core_only_tracked"
    if ts_b == "-":
        return "legacy_only_tracked"
    try:
        ia, ib = int(ts_a), int(ts_b)
    except ValueError:
        return "?"
    if ia > ib:
        return "legacy_newer"
    if ib > ia:
        return "core_newer"
    return "same_commit_time"


def iter_cs(root: Path) -> Iterable[Path]:
    if not root.is_dir():
        return
    for dirpath, _, files in os.walk(root):
        for name in files:
            if name.endswith(".cs"):
                yield Path(dirpath) / name


def main() -> int:
    root = repo_root()
    nav_root = root / "_navimesh"
    rc = nav_root / "recastnavigation"
    nc_navi = nav_root / "navimesh_csharp" / "navi"
    nc_util = nav_root / "navimesh_csharp" / "util"
    nm_scripts = nav_root / "Assets" / "Navimesh" / "Scripts"
    dn = root / "DeukNavigation"
    dn_core = dn / "Runtime" / "Core"
    dn_core_geo = dn_core / "Geometry"
    dn_core_native = dn_core / "Native"

    chk = subprocess.run(["git", "rev-parse", "--git-dir"], cwd=root, capture_output=True)
    if chk.returncode != 0:
        print("Not a git repository at workspace root.", file=sys.stderr)
        return 1

    if not nav_root.is_dir():
        print(f"Missing {nav_root}", file=sys.stderr)
        return 1
    if not dn.is_dir():
        print(f"Missing {dn}", file=sys.stderr)
        return 1

    # --- C++ tree summary ---
    print("# C++ canonical: `_navimesh/recastnavigation` (git)\n")
    if rc.is_dir():
        rel_rc = to_git_path(root, rc)
        r = subprocess.run(
            ["git", "log", "-1", "--format=last_commit %cI %h %s", "--", rel_rc],
            cwd=root,
            capture_output=True,
            text=True,
        )
        print((r.stdout or r.stderr or "(no log)").strip() or "(empty)")
        r2 = subprocess.run(
            ["git", "log", "-5", "--oneline", "--", rel_rc],
            cwd=root,
            capture_output=True,
            text=True,
        )
        print("\nRecent commits touching tree:\n", r2.stdout.strip() or "(none)", sep="")
    else:
        print("(missing recastnavigation/)")

    # --- C# core pairs ---
    legacy_navi = list(iter_cs(nc_navi)) if nc_navi.is_dir() else []
    legacy_util = list(iter_cs(nc_util)) if nc_util.is_dir() else []
    legacy_paths = sorted(
        {p.resolve() for p in legacy_navi + legacy_util},
        key=lambda p: (p.name.lower(), str(p)),
    )

    core_flat: list[Path] = []
    for d in (dn_core, dn_core_geo, dn_core_native):
        if d.is_dir():
            core_flat.extend(iter_cs(d))

    by_name_core: dict[str, list[Path]] = {}
    for p in core_flat:
        by_name_core.setdefault(p.name, []).append(p)
    for k in by_name_core:
        by_name_core[k] = sorted({x.resolve() for x in by_name_core[k]}, key=str)

    print("\n# C#: navimesh_csharp <-> DeukNavigation Runtime/Core (by basename, git log)\n")
    print(
        "| basename | legacy | core | git legacy (ts h) | git core (ts h) | newer (git) |"
    )
    print("|----------|--------|------|-------------------|-----------------|-------------|")
    for leg in legacy_paths:
        name = leg.name
        matches = by_name_core.get(name, [])
        tl, hl, _ = git_last_log(root, leg)
        leg_cell = f"`{to_git_path(root, leg)}`"
        if not matches:
            print(f"| {name} | {leg_cell} | — | {tl} {hl} | — | — |")
            continue
        for core in matches:
            tc, hc, _ = git_last_log(root, core)
            w = newer_by_git(tl, tc)
            core_cell = f"`{to_git_path(root, core)}`"
            print(f"| {name} | {leg_cell} | {core_cell} | {tl} {hl} | {tc} {hc} | {w} |")

    # navi-ai
    nav_ai_pkg = dn / "Runtime" / "Unity" / "NavAi"
    nav_ai_tree = nm_scripts / "navi-ai"
    if nav_ai_pkg.is_dir() and nav_ai_tree.is_dir():
        pkg_files = list(iter_cs(nav_ai_pkg))
        tree_files = list(iter_cs(nav_ai_tree))
        by_pkg: dict[str, list[Path]] = {}
        for p in pkg_files:
            by_pkg.setdefault(p.name, []).append(p)
        for k in by_pkg:
            by_pkg[k] = sorted({x.resolve() for x in by_pkg[k]}, key=str)

        print("\n# C#: navi-ai <-> DeukNavigation Runtime/Unity/NavAi (by basename, git)\n")
        print(
            "| basename | _navimesh | DeukNavigation | git nm | git pkg | newer (git) |"
        )
        print("|----------|-----------|----------------|--------|---------|-------------|")
        for tree in sorted(tree_files, key=lambda p: p.name):
            name = tree.name
            pk = by_pkg.get(name, [])
            if not pk:
                continue
            tt, ht, _ = git_last_log(root, tree)
            for p in pk:
                tp, hp, _ = git_last_log(root, p)
                w = newer_by_git(tt, tp)
                print(
                    f"| {name} | `{to_git_path(root, tree)}` | `{to_git_path(root, p)}` | {tt} {ht} | {tp} {hp} | {w} |"
                )

    print(
        "\nInterpretation: `newer (git)` uses last commit timestamp on each path; refresh the older side from the newer side per DEUKPACK_NAVIMESH_CANONICAL_TREE_AND_CSHARP_SYNC.md."
    )
    print("C++ sources live only under `_navimesh/recastnavigation`; ship binaries via Plugins into DeukNavigation.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
