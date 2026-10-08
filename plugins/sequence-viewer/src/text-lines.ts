export type TextLine = { lineNumber: number; text: string };

/** Scan LF, CRLF, or CR text without duplicating the source or allocating all lines. */
export function createTextLineReader(contents: string): () => TextLine | null {
  let offset = 0;
  let lineNumber = 1;
  return () => {
    if (offset >= contents.length) return null;
    const start = offset;
    while (
      offset < contents.length &&
      contents[offset] !== "\n" &&
      contents[offset] !== "\r"
    ) {
      offset += 1;
    }
    const text = contents.slice(start, offset);
    if (contents[offset] === "\r" && contents[offset + 1] === "\n") {
      offset += 2;
    } else if (offset < contents.length) {
      offset += 1;
    }
    const result = { lineNumber, text };
    lineNumber += 1;
    return result;
  };
}
