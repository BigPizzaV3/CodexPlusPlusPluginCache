#!/usr/bin/env python3
"""Render a non-mutating Blender audit view and emit basic scene evidence."""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def parse():
    parser = argparse.ArgumentParser()
    parser.add_argument("--room-id", required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    values = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    return parser.parse_args(values)


def world_bounds(objects):
    points = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
    return Vector(tuple(min(point[i] for point in points) for i in range(3))), Vector(tuple(max(point[i] for point in points) for i in range(3)))


def point_camera(camera, target):
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat("-Z", "Y").to_euler()


def main():
    args = parse()
    scene = bpy.context.scene
    meshes = [obj for obj in scene.objects if obj.type == "MESH" and not obj.hide_render]
    if not meshes:
        raise RuntimeError("room has no visible meshes")
    low, high = world_bounds(meshes)
    center = (low + high) * 0.5
    size = high - low
    camera = scene.camera
    camera_source = "saved"
    if camera is None:
        data = bpy.data.cameras.new("AuditCamera")
        camera = bpy.data.objects.new("AuditCamera", data)
        scene.collection.objects.link(camera)
        scene.camera = camera
        camera_source = "fallback"
    distance = max(size.x, size.y, size.z) * 1.35
    candidates = [
        ("south", Vector((center.x, low.y - distance, center.z + size.z * 0.1)), max(size.x, size.z)),
        ("north", Vector((center.x, high.y + distance, center.z + size.z * 0.1)), max(size.x, size.z)),
        ("west", Vector((low.x - distance, center.y, center.z + size.z * 0.1)), max(size.y, size.z)),
        ("east", Vector((high.x + distance, center.y, center.z + size.z * 0.1)), max(size.y, size.z)),
    ]
    axis, location, _ = min(candidates, key=lambda item: item[2])
    camera.location = location
    camera.data.type = "ORTHO"
    projected_width = size.x if axis in {"south", "north"} else size.y
    camera.data.ortho_scale = max(1.0, size.z, projected_width / (16 / 9)) * 1.15
    point_camera(camera, center)
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light = "STUDIO"
    scene.display.shading.show_shadows = True
    scene.display.shading.show_cavity = True
    scene.display.shading.cavity_type = "WORLD"
    scene.render.resolution_x = 640
    scene.render.resolution_y = 360
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    args.output.parent.mkdir(parents=True, exist_ok=True)
    scene.render.filepath = str(args.output.resolve())
    bpy.ops.render.render(write_still=True)
    triangles = 0
    for obj in meshes:
        evaluated = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
        mesh = evaluated.to_mesh()
        try:
            mesh.calc_loop_triangles()
            triangles += len(mesh.loop_triangles)
        finally:
            evaluated.to_mesh_clear()
    report = {
        "schema": "game-room.room-blender-audit.v1", "roomId": args.room_id,
        "blend": bpy.data.filepath, "render": str(args.output), "cameraSource": camera_source, "auditAxis": axis,
        "visibleMeshes": len(meshes), "triangles": triangles,
        "boundsMeters": [round(float(value), 5) for value in size],
        "proceduralNamedObjects": [obj.name for obj in meshes if any(token in obj.name.lower() for token in ("cube", "cylinder", "plane", "wall", "floor", "ceiling"))]
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print("ROOM_AUDIT " + json.dumps(report, separators=(",", ":")))


if __name__ == "__main__":
    main()
