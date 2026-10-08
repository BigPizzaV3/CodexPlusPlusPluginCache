#!/usr/bin/env python3
"""Compose a manifest-driven room in Blender and save a proxy-free source."""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

try:
    import bpy
    from mathutils import Vector
except ImportError as error:  # pragma: no cover - Blender-only entrypoint
    raise SystemExit("run blender_compose_room.py through Blender") from error


def arguments():
    values = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--package", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    return parser.parse_args(values)


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def reset_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for block in list(datablocks):
            if block.users == 0:
                datablocks.remove(block)


def material_for(surface):
    spec = surface["material"]
    material = bpy.data.materials.new(f"MAT_{surface['id']}")
    material.diffuse_color = tuple(spec["baseColor"])
    material.use_nodes = True
    principled = material.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = tuple(spec["baseColor"])
    principled.inputs["Metallic"].default_value = spec["metallic"]
    principled.inputs["Roughness"].default_value = spec["roughness"]
    return material


def create_surface(surface):
    bpy.ops.mesh.primitive_cube_add(size=1, location=surface["location"])
    obj = bpy.context.object
    obj.name = f"SHELL_{surface['id']}"
    obj.dimensions = surface["dimensionsMeters"]
    obj.rotation_euler = [math.radians(value) for value in surface["rotationDegrees"]]
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material_for(surface))
    obj["room_surface_id"] = surface["id"]
    obj["room_surface_kind"] = surface["kind"]
    return obj


def world_bounds(objects):
    points = [obj.matrix_world @ Vector(corner) for obj in objects if obj.type in {"MESH", "CURVE"} for corner in obj.bound_box]
    if not points:
        raise ValueError("imported GLB contains no renderable bounds")
    low = Vector((min(point.x for point in points), min(point.y for point in points), min(point.z for point in points)))
    high = Vector((max(point.x for point in points), max(point.y for point in points), max(point.z for point in points)))
    return low, high


def import_instance(package: Path, asset, instance):
    mesh = asset.get("acceptedMesh") or {}
    mesh_path = package / mesh.get("path", "")
    if not mesh_path.is_file() or mesh_path.suffix.lower() != ".glb":
        raise ValueError(f"asset {asset['id']} has no accepted GLB")
    existing = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(mesh_path))
    imported = [obj for obj in bpy.data.objects if obj not in existing]
    low, high = world_bounds(imported)
    dimensions = high - low
    target = Vector(asset["dimensionsMeters"])
    if min(dimensions) <= 0:
        raise ValueError(f"asset {asset['id']} has a zero-sized axis")
    root = bpy.data.objects.new(f"PROP_{instance['id']}", None)
    bpy.context.scene.collection.objects.link(root)
    for obj in imported:
        if obj.parent is None or obj.parent not in imported:
            obj.parent = root
            obj.matrix_parent_inverse = root.matrix_world.inverted()
        obj.name = f"{instance['id']}__{obj.name}"
    requested_scale = Vector(instance["scale"])
    root.scale = Vector((target.x / dimensions.x, target.y / dimensions.y, target.z / dimensions.z))
    root.scale.x *= requested_scale.x
    root.scale.y *= requested_scale.y
    root.scale.z *= requested_scale.z
    root.rotation_euler = [math.radians(value) for value in instance["rotationDegrees"]]
    root.location = instance["location"]
    root["room_instance_id"] = instance["id"]
    root["room_asset_id"] = asset["id"]
    root["attachment_face"] = asset["attachmentFace"]
    root["semantic_front"] = asset["semanticFront"]
    root["meshy_task_id"] = mesh.get("taskId", "")
    return root


def create_camera(spec):
    data = bpy.data.cameras.new("ProductionCamera")
    camera = bpy.data.objects.new("ProductionCamera", data)
    bpy.context.scene.collection.objects.link(camera)
    camera.location = spec["location"]
    direction = Vector(spec["target"]) - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    data.angle_y = math.radians(spec["verticalFovDegrees"])
    bpy.context.scene.camera = camera


def main():
    args = arguments()
    package = args.package.resolve()
    layout = load(package / "room-layout.json")
    manifest = load(package / "props.json")
    if layout.get("roomId") != manifest.get("roomId"):
        raise SystemExit("room-layout.json and props.json roomId values differ")
    assets = {asset["id"]: asset for asset in manifest.get("assets", [])}
    reset_scene()
    for surface in layout.get("surfaces", []):
        create_surface(surface)
    for instance in layout.get("instances", []):
        asset = assets.get(instance["assetId"])
        if not asset:
            raise ValueError(f"unknown asset {instance['assetId']}")
        import_instance(package, asset, instance)
    create_camera(layout["productionCamera"])
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene["room_id"] = layout["roomId"]
    scene["room_manifest"] = str((package / "room-layout.json").resolve())
    args.output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(args.output.resolve()))
    print(args.output.resolve())


if __name__ == "__main__":
    main()
