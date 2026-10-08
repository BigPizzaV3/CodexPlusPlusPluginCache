import type {
  BufferEncoding,
  FilehandleOptions,
  GenericFilehandle,
} from "generic-filehandle2";

/** Cross-runtime immutable file handle for bounded binary decoders. */
export class MemoryFilehandle implements GenericFilehandle {
  readonly #bytes: Uint8Array<ArrayBuffer>;

  constructor(bytes: Uint8Array) {
    this.#bytes = Uint8Array.from(bytes);
  }

  async read(length: number, position = 0): Promise<Uint8Array<ArrayBuffer>> {
    return this.#bytes.slice(position, position + length);
  }

  async readFile(
    options?: Omit<FilehandleOptions, "encoding">,
  ): Promise<Uint8Array<ArrayBuffer>>;
  async readFile(
    options:
      | BufferEncoding
      | (Omit<FilehandleOptions, "encoding"> & { encoding: BufferEncoding }),
  ): Promise<string>;
  async readFile(
    options?: FilehandleOptions | BufferEncoding,
  ): Promise<Uint8Array<ArrayBuffer> | string> {
    const encoding = typeof options === "string" ? options : options?.encoding;
    if (encoding == null) return this.#bytes.slice();
    if (encoding === "utf8" || encoding === "utf-8") {
      return new TextDecoder().decode(this.#bytes);
    }
    throw new Error(`Unsupported in-memory file encoding: ${encoding}.`);
  }

  async stat(): Promise<{ size: number }> {
    return { size: this.#bytes.byteLength };
  }

  async close(): Promise<void> {}
}
