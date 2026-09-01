"""
SAR format registry.
Maps sar_format string to the corresponding tree module.

Adding a new format:
  1. Create sar_tree/<new_format>.py with NODES and ROOT_ORDER.
  2. Register it here.
  3. Do NOT copy thresholds from an existing format — every format's
     banding and caps must be independently verified.
"""

from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sar_tree.ug_tier_ii_gapc_v4 import SARNode

_REGISTRY: dict[str, str] = {
    "ug_tier_ii_gapc_v4": "sar_tree.ug_tier_ii_gapc_v4",
}

SUPPORTED_FORMATS = list(_REGISTRY.keys())


def get_tree(sar_format: str) -> tuple[dict, list[str]]:
    """
    Returns (nodes_dict, root_order) for the given sar_format.
    nodes_dict: {node_id: SARNode}
    root_order: top-level criterion ids in display order.
    Raises ValueError for unknown formats.
    """
    if sar_format not in _REGISTRY:
        raise ValueError(
            f"Unknown SAR format '{sar_format}'. "
            f"Supported: {SUPPORTED_FORMATS}"
        )
    import importlib
    mod = importlib.import_module(_REGISTRY[sar_format])
    return mod.NODES, mod.ROOT_ORDER


def resolve_scope(
    sar_format: str,
    scope: str,
) -> list[str]:
    """
    Resolve a scope string to an ordered list of node IDs to include.

    Scope forms:
      "full"                → all root criteria in ROOT_ORDER + annexures
      "criterion:N"         → all nodes whose id starts with "N" or "N."
      "subcriterion:N.M"    → node N.M and all children (N.M.*)
      "subcriterion:N.M.P"  → exact node N.M.P only
    """
    nodes, root_order = get_tree(sar_format)

    if scope == "full":
        return _ordered_node_ids(nodes, root_order)

    if scope.startswith("criterion:"):
        criterion = scope.split(":", 1)[1].strip()
        prefix    = criterion + "."
        return [nid for nid in _ordered_node_ids(nodes, root_order)
                if nid == criterion or nid.startswith(prefix)]

    if scope.startswith("subcriterion:"):
        sub    = scope.split(":", 1)[1].strip()
        prefix = sub + "."
        return [nid for nid in _ordered_node_ids(nodes, root_order)
                if nid == sub or nid.startswith(prefix)]

    raise ValueError(
        f"Invalid scope '{scope}'. "
        "Expected 'full', 'criterion:N', or 'subcriterion:N.M[.P]'"
    )


def _ordered_node_ids(nodes: dict, root_order: list[str]) -> list[str]:
    """
    Return all node IDs in a stable depth-first order derived from ROOT_ORDER.
    Criteria come first; their children follow immediately, recursively.
    """
    result: list[str] = []

    def _walk(parent_prefix: str):
        for nid, node in sorted(nodes.items(),
                                 key=lambda kv: _sort_key(kv[0])):
            if _is_direct_child(nid, parent_prefix):
                result.append(nid)
                _walk(nid)

    for root_id in root_order:
        if root_id in nodes:
            result.append(root_id)
        _walk(root_id)

    return result


def _is_direct_child(node_id: str, parent_id: str) -> bool:
    if parent_id == "":
        return False
    prefix = parent_id + "."
    if not node_id.startswith(prefix):
        return False
    # Direct child: no additional dots after parent prefix
    remainder = node_id[len(prefix):]
    return "." not in remainder


def _sort_key(node_id: str) -> tuple:
    """Sort node IDs numerically: '1' < '1.1' < '1.1.1' < '1.2' < '2'."""
    parts = node_id.replace("part_c", "10").replace("ann_i", "11") \
                   .replace("ann_ii", "12").replace("ann_iii", "13").split(".")
    result = []
    for p in parts:
        try:
            result.append((0, int(p)))
        except ValueError:
            result.append((1, p))
    return tuple(result)
