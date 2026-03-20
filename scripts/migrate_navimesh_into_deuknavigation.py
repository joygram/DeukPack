#!/usr/bin/env python3
"""
One-shot: import Navimesh scripts from git (HEAD) into DeukNavigation with namespace migration.

Canonical source tree on disk is i/_navimesh/ (often spoken as "_navmesh"). Prefer copying or
diffing from _navimesh/Assets/Navimesh when refreshing; this script uses git HEAD paths for
repeatable extraction when the client folder is absent from the working tree.

Run from repo root: python DeukPack/scripts/migrate_navimesh_into_deuknavigation.py
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
DEUK_NAV = REPO / "DeukNavigation"
PREFIX = "project_i/i_client/Assets/Navimesh/Scripts/"

# Runtime (skip RecastDetourBuilder: package Editor copy is newer)
RUNTIME_SOURCES = [
    p for p in """
navi-ai/AgentGroupSettings.cs
navi-ai/Common/BufferHandler.cs
navi-ai/Common/FreeMove.cs
navi-ai/Common/IState.cs
navi-ai/Common/LabelRegion.cs
navi-ai/Common/MouseLooker.cs
navi-ai/Common/NullState.cs
navi-ai/Common/SimGUIUtil.cs
navi-ai/Common/SimStandard.cs
navi-ai/Common/StdButtons.cs
navi-ai/Common/StringList.cs
navi-ai/CrowdAvoidanceSet.cs
navi-ai/Nav/FollowGoalCrowd.cs
navi-ai/Nav/MoveToCrowd.cs
navi-ai/Nav/MoveToLocal.cs
navi-ai/Nav/MoveToSimple.cs
navi-ai/Nav/NavAgent.cs
navi-ai/Nav/NavAgentData.cs
navi-ai/Nav/NavAgentGroup.cs
navi-ai/Nav/NavController.cs
navi-ai/Nav/NavDebugView.cs
navi-ai/Nav/NavEvents.cs
navi-ai/Nav/NavFlag.cs
navi-ai/Nav/NavMode.cs
navi-ai/Nav/NavPath.cs
navi-ai/Nav/NavPlanner.cs
navi-ai/Nav/RangeType.cs
navi-ai/Nav/SimpleMover.cs
navi-ai/Nav/SuspendInCrowd.cs
navi-ai/NavManager.cs
navi-ai/NavManagerProvider.cs
nmbuild-extras-u3d/BoxAreaMarker.cs
nmbuild-extras-u3d/CylinderAreaMarker.cs
nmbuild-extras-u3d/NMGenAreaMarker.cs
nmbuild-extras-u3d/NMGenComponent.cs
nmbuild-extras-u3d/OFMConnection.cs
""".strip().splitlines()
]

EDITOR_SOURCES = [
    p for p in """
navi-ai/Editor/AgentGroupNames.cs
navi-ai/Editor/AgentGroupNamesEditor.cs
navi-ai/Editor/AgentGroupSettingsEditor.cs
navi-ai/Editor/CrowdAvoidanceSetEditor.cs
navi-ai/Editor/NavManagerProviderEditor.cs
navi-ai/Common/Editor/MaterialsPostProcessor_NotUse.cs
nmbuild-extras-u3d/Editor/AreaMarkerCompiler.cs
nmbuild-extras-u3d/Editor/AreaMarkerCompilerEditor.cs
nmbuild-extras-u3d/Editor/AreaMarkerEditor.cs
nmbuild-extras-u3d/Editor/BoxAreaMarkerEditor.cs
nmbuild-extras-u3d/Editor/CylinderAreaMarkerEditor.cs
nmbuild-extras-u3d/Editor/NMGenComponentEditor.cs
nmbuild-extras-u3d/Editor/OFMConnectionCompiler.cs
nmbuild-extras-u3d/Editor/OFMConnectionCompilerEditor.cs
nmbuild-extras-u3d/Editor/OFMConnectionEditor.cs
""".strip().splitlines()
]


def git_show(git_path: str) -> bytes:
    r = subprocess.run(
        ["git", "show", f"HEAD:{git_path}"],
        cwd=REPO,
        capture_output=True,
    )
    if r.returncode != 0:
        print(f"FAIL git show HEAD:{git_path}\n{r.stderr.decode(errors='replace')}", file=sys.stderr)
        sys.exit(1)
    return r.stdout


def transform_cs(text: str) -> str:
    if text.startswith("\ufeff"):
        text = text[1:]
    pairs = [
        ("using navi.interop;", "using DeukNavigation.Native;"),
        ("using navi.recast;", "using DeukNavigation.Native;"),
        ("using navi.geom;", "using DeukNavigation.Geometry;"),
        ("using navi.nmgen.rcn;", "using DeukNavigation.Build.Rcn;"),
        ("using navi.nmgen;", "using DeukNavigation.Build;"),
        ("using navi.nmbuild;", "using DeukNavigation.Build;"),
        ("using navi.samples;", "using DeukNavigation;"),
        ("using navi;", "using DeukNavigation;"),
        ("namespace navi.nmgen.rcn", "namespace DeukNavigation.Build.Rcn"),
        ("namespace navi.nmgen", "namespace DeukNavigation.Build"),
        ("namespace navi.nmbuild", "namespace DeukNavigation.Build"),
        ("namespace navi.samples", "namespace DeukNavigation.Samples"),
        ("namespace navi", "namespace DeukNavigation"),
        ("vector3 = navi.vector3", "vector3 = DeukNavigation.vector3"),
    ]
    for a, b in pairs:
        text = text.replace(a, b)
    text = re.sub(r"\bnavi\.vector3\b", "DeukNavigation.vector3", text)
    return text


def main() -> None:
    for rel in RUNTIME_SOURCES:
        src = PREFIX + rel
        # Runtime/Unity/NavAi/... or NMGenExtras for nmbuild-extras
        if rel.startswith("nmbuild-extras-u3d/"):
            out_rel = "Runtime/Unity/NMGenExtras/" + rel.split("/", 1)[1]
        else:
            out_rel = "Runtime/Unity/NavAi/" + rel[len("navi-ai/") :]
        out = DEUK_NAV / out_rel
        out.parent.mkdir(parents=True, exist_ok=True)
        raw = git_show(src).decode("utf-8", errors="replace")
        out.write_text(transform_cs(raw), encoding="utf-8", newline="\n")
        print(f"Wrote {out.relative_to(REPO)}")

    for rel in EDITOR_SOURCES:
        src = PREFIX + rel
        if rel.startswith("nmbuild-extras-u3d/Editor/"):
            out = DEUK_NAV / "Editor" / "NMGenExtras" / Path(rel).name
        elif rel.startswith("navi-ai/Common/Editor/"):
            out = DEUK_NAV / "Editor" / "NavAi" / "Common" / "Editor" / Path(rel).name
        elif rel.startswith("navi-ai/Editor/"):
            out = DEUK_NAV / "Editor" / "NavAi" / rel[len("navi-ai/Editor/") :]
        else:
            raise ValueError(f"Unexpected editor path: {rel}")
        out.parent.mkdir(parents=True, exist_ok=True)
        raw = git_show(src).decode("utf-8", errors="replace")
        out.write_text(transform_cs(raw), encoding="utf-8", newline="\n")
        print(f"Wrote {out.relative_to(REPO)}")

    print("Done.")


if __name__ == "__main__":
    main()
