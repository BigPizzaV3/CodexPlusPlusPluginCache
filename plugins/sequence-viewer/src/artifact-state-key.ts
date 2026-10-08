/** Stable, content-sensitive key used to reset viewer-local interaction state. */
export function createArtifactStateKey(
  contents: string,
  fileName: string | undefined,
): string {
  let hash = 5_381;
  for (let index = 0; index < contents.length; index += 1) {
    hash = (hash * 33 + contents.charCodeAt(index)) % 2_147_483_647;
  }
  return `${fileName ?? ""}:${contents.length}:${hash}`;
}
