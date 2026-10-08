const gzipCompressionSuffix = /\.(?:bgz|bgzf|bgzip|gz)$/iu;

export function isGzipCompressedBiologicalFileName(fileName: string): boolean {
  return gzipCompressionSuffix.test(fileName);
}

export function stripBiologicalCompressionSuffix(fileName: string): string {
  return fileName.replace(gzipCompressionSuffix, "");
}

export function biologicalFileBasename(filePath: string): string {
  const lastSeparator = Math.max(
    filePath.lastIndexOf("/"),
    filePath.lastIndexOf("\\"),
  );
  return lastSeparator < 0 ? filePath : filePath.slice(lastSeparator + 1);
}
