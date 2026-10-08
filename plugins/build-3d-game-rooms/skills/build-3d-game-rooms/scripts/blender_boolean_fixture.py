#!/usr/bin/env python3
"""Blender fixture: cut one wall from cutter JSON and validate semantic geometry."""

from __future__ import annotations

import argparse
import json
import os
import sys
import traceback
from pathlib import Path

import bpy
import bmesh
from mathutils import Vector


def args():
    parser = argparse.ArgumentParser()
    parser.add_argument("cutter", type=Path)
    parser.add_argument("--wall-thickness", type=float, default=0.24)
    parser.add_argument("--output", type=Path)
    values = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    return parser.parse_args(values)


def cube(name, dims, location):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return obj


def cutter_mesh(payload, thickness):
    outer = next(item for item in payload["contours"] if item["role"] == "outer")
    if any(item["role"] == "hole" for item in payload["contours"]):
        raise RuntimeError("fixture currently rejects cutter islands; split the opening design")
    width, height = payload["widthMeters"], payload["heightMeters"]
    normalized_y = [point[1] for point in outer["points"]]
    if payload["kind"] == "door" and min(normalized_y) > 1e-6:
        raise RuntimeError("semantic failure: a door cutter must reach the threshold")
    if payload["kind"] != "door" and min(normalized_y) <= 0:
        raise RuntimeError("semantic failure: windows and alcoves must remain above the wall base")
    if payload["kind"] == "deep_alcove" and (payload.get("depthMeters") or 0) < max(0.35, 0.15 * height):
        raise RuntimeError("semantic failure: alcove cutter is too shallow")
    sill = payload.get("sillMeters") or 0.0
    verts2d = [((x - 0.5) * width, sill + y * height - (0.1 if payload["kind"] == "door" and y <= 1e-6 else 0.0)) for x, y in outer["points"]]
    depth = thickness + 0.2
    verts = [(x, -depth / 2, z) for x, z in verts2d] + [(x, depth / 2, z) for x, z in verts2d]
    count = len(verts2d)
    faces = [tuple(range(count - 1, -1, -1)), tuple(range(count, count * 2))]
    for index in range(count):
        nxt = (index + 1) % count
        faces.append((index, nxt, count + nxt, count + index))
    mesh = bpy.data.meshes.new("OpeningCutterMesh")
    mesh.from_pydata(verts, [], faces)
    mesh.validate(verbose=True)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    obj = bpy.data.objects.new("OpeningCutter", mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def main():
    options = args()
    payload = json.loads(options.cutter.read_text(encoding="utf-8"))
    if payload.get("schema") != "game-room.opening-cutter.v1":
        raise RuntimeError("invalid cutter schema")
    wall_width = max(payload["widthMeters"] + 1.0, 2.0)
    wall_height = max(payload["heightMeters"] + (payload.get("sillMeters") or 0) + 0.6, 2.4)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    wall = cube("Wall", (wall_width, options.wall_thickness, wall_height), (0, 0, wall_height / 2))
    cutter = cutter_mesh(payload, options.wall_thickness)
    before = sum(poly.area for poly in wall.data.polygons)
    modifier = wall.modifiers.new("OpeningBoolean", "BOOLEAN")
    modifier.operation = "DIFFERENCE"
    modifier.solver = "EXACT"
    modifier.object = cutter
    bpy.context.view_layer.objects.active = wall
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    bpy.data.objects.remove(cutter, do_unlink=True)
    wall.data.validate(verbose=True)
    wall.data.update()
    bm = bmesh.new()
    bm.from_mesh(wall.data)
    boundary_edges = sum(1 for edge in bm.edges if not edge.is_manifold)
    bm.free()
    after = sum(poly.area for poly in wall.data.polygons)
    if not wall.data.polygons or after <= 0 or before <= 0 or after == before:
        raise RuntimeError("Boolean did not alter the wall")
    if boundary_edges:
        raise RuntimeError(f"Boolean result has {boundary_edges} non-manifold edges")
    if payload["kind"] == "door":
        origin = Vector((0, 0, 0.05))
        direction = Vector((0, 1, 0))
        hit_forward, forward_location, _, _ = wall.ray_cast(origin, direction, distance=options.wall_thickness)
        hit_backward, backward_location, _, _ = wall.ray_cast(origin, -direction, distance=options.wall_thickness)
        if hit_forward or hit_backward:
            raise RuntimeError(f"door cut left geometry across the threshold: forward={hit_forward}@{tuple(forward_location)}, backward={hit_backward}@{tuple(backward_location)}")
    report = {"schema": "game-room.boolean-fixture-report.v1", "passed": True, "kind": payload["kind"], "vertices": len(wall.data.vertices), "faces": len(wall.data.polygons), "nonManifoldEdges": boundary_edges, "solver": "EXACT"}
    print("BOOLEAN_FIXTURE " + json.dumps(report, separators=(",", ":")))
    if options.output:
        options.output.parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(options.output.resolve()))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc()
        sys.stdout.flush()
        sys.stderr.flush()
        os._exit(1)
