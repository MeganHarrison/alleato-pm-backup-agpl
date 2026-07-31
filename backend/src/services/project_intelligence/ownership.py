"""Executable ownership contract for backend Project Intelligence projections."""

from pathlib import Path
from typing import Iterable

CANONICAL_RUNNER_MODULE = "src.services.project_intelligence.runner"
FORMER_PROJECTION_PATHS = (
    "backend/src/scripts/run_domain_packet_compiler.py",
    "backend/src/services/intelligence/domain_compiler.py",
    "backend/src/services/intelligence/project_synthesizer.py",
    "backend/src/services/intelligence/project_intelligence.py",
    "backend/src/services/intelligence/product_intelligence_packets.py",
)
FORMER_IMPORT_MARKERS = (
    "services.intelligence.domain_compiler",
    "services.intelligence.project_synthesizer",
    "services.intelligence.project_intelligence",
    "from src.services.intelligence import domain_compiler",
    "from src.services.intelligence import project_synthesizer",
    "from src.services.intelligence import project_intelligence",
    "services.intelligence.product_intelligence_packets",
    "from src.services.intelligence.product_intelligence_packets",
)


def assert_former_projection_paths_absent(
    repo_root: Path,
    *,
    former_paths: Iterable[str] = FORMER_PROJECTION_PATHS,
) -> None:
    present = [path for path in former_paths if (repo_root / path).exists()]
    if present:
        rendered = ", ".join(present)
        raise RuntimeError(
            "Project Intelligence backend ownership violation: former functional "
            f"path(s) exist: {rendered}. Move functionality into "
            "backend/src/services/project_intelligence and delete the former path."
        )
