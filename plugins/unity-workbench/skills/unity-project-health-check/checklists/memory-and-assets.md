# Memory and Asset Loading Checklist

Inspect:

- Resources usage
- Addressables or asset bundles
- synchronous loads
- unload strategy
- duplicate large assets
- texture and audio import settings
- render textures
- persistent object lifetime
- scene unload cleanup
- object pooling
- asset references preventing unload
- native plugin memory
- large ScriptableObjects
- runtime-created materials and meshes

Prioritize target-platform memory constraints.
