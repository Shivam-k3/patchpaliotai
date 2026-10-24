from dataclasses import dataclass
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
PROJECTS_ROOT = REPO_ROOT


@dataclass(frozen=True)
class ProjectSpec:
    project_id: str
    label: str
    root: Path
    test_command: tuple[str, ...]
    build_command: tuple[str, ...]
    runtime: str


PROJECT_REGISTRY: dict[str, ProjectSpec] = {
    "northstar-landing-page-bugtest": ProjectSpec(
        project_id="northstar-landing-page-bugtest",
        label="Northstar landing page bug test",
        root=REPO_ROOT / "landing-page-lab-bugtest",
        test_command=("npm.cmd", "test"),
        build_command=("npm.cmd", "run", "build"),
        runtime="node-local",
    ),
}


def _is_within_root(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
    except ValueError:
        return False
    return True


def list_projects() -> list[ProjectSpec]:
    return [PROJECT_REGISTRY[key] for key in sorted(PROJECT_REGISTRY)]


def resolve_project(project_id: str) -> ProjectSpec:
    spec = PROJECT_REGISTRY.get(project_id)
    if spec is None:
        raise ValueError("project not found")
    configured_root = spec.root
    if configured_root.is_symlink():
        raise ValueError("project root may not be a symlink")
    resolved_root = configured_root.resolve()
    resolved_projects_root = PROJECTS_ROOT.resolve()
    if not _is_within_root(resolved_root, resolved_projects_root):
        raise ValueError("project root is outside the approved workspace")
    if not resolved_root.is_dir():
        raise ValueError("project root is not available")
    return ProjectSpec(
        project_id=spec.project_id,
        label=spec.label,
        root=resolved_root,
        test_command=spec.test_command,
        build_command=spec.build_command,
        runtime=spec.runtime,
    )
