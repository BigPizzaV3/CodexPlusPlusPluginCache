import type { SequenceWorkbenchPayloadDeclaration } from "./workbench-persistence-protocol";

const mediaTypeByFormat = {
  a3m: "text/x-a3m",
  "aligned-fasta": "text/x-fasta",
  bed: "text/x-bed",
  clustal: "text/x-clustal",
  csv: "text/csv",
  embl: "text/x-embl",
  fasta: "text/x-fasta",
  fastq: "text/x-fastq",
  genbank: "text/x-genbank",
  gff3: "text/x-gff3",
  gtf: "text/x-gtf",
  json: "application/json",
  newick: "text/x-newick",
  pdf: "application/pdf",
  stockholm: "text/x-stockholm",
  svg: "image/svg+xml",
  tsv: "text/tab-separated-values",
  vcf: "text/x-vcf",
} as const;

type ExportFormat = keyof typeof mediaTypeByFormat;
type JsonContext =
  | { state: "comma-or-end" | "value" | "value-or-end"; type: "array" }
  | {
      state: "colon" | "comma-or-end" | "key" | "key-or-end" | "value";
      type: "object";
    };

/**
 * Validates canonical UTF-8 and the format invariants used by workspace
 * publication without retaining the complete artifact. The retained prefix,
 * suffix and JSON nesting stack are deliberately bounded.
 */
export class IncrementalSequenceExportValidator {
  private readonly decoder = new TextDecoder("utf-8", { fatal: true });
  private readonly binaryDecoder = new TextDecoder("iso-8859-1");
  private firstNonWhitespace = "";
  private fastaAlignedLength?: number;
  private fastaCurrentSequenceLength = 0;
  private fastaRecordCount = 0;
  private fastqPhase: 0 | 1 | 3 = 0;
  private fastqQualityLength = 0;
  private fastqSequenceLength = 0;
  private jsonContexts: Array<JsonContext> = [];
  private jsonEscape = false;
  private jsonInString = false;
  private jsonRootState: "done" | "value" = "value";
  private jsonStringRole?: "key" | "value";
  private jsonToken?: { kind: "literal" | "number"; value: string };
  private jsonUnicodeDigits = 0;
  private retainedPeak = 0;
  private seenNonWhitespace = false;
  private suffix = "";
  private lineLength = 0;
  private linePrefix = "";
  private lineTouched = false;

  constructor(
    private readonly format: ExportFormat,
    mediaType: string,
  ) {
    if (mediaType !== mediaTypeByFormat[format]) {
      throw new Error(`The ${format} artifact media type is invalid.`);
    }
  }

  update(bytes: Uint8Array): void {
    this.consume(
      this.format === "pdf"
        ? this.binaryDecoder.decode(bytes, { stream: true })
        : this.decoder.decode(bytes, { stream: true }),
    );
  }

  finish(): void {
    this.consume(
      this.format === "pdf"
        ? this.binaryDecoder.decode()
        : this.decoder.decode(),
    );
    const trimmedPrefix = this.firstNonWhitespace;
    const trimmedSuffix = this.suffix.trimEnd();
    if (this.lineTouched) this.finishStructuredLine();
    if (this.format === "aligned-fasta") this.assertAlignedLength();
    if (!this.seenNonWhitespace && this.format !== "bed") {
      throw new Error("The exported artifact is empty.");
    }
    if (this.format === "json") {
      if (this.jsonToken != null) this.finishJsonToken();
      if (
        this.jsonInString ||
        this.jsonEscape ||
        this.jsonUnicodeDigits !== 0 ||
        this.jsonContexts.length !== 0 ||
        this.jsonRootState !== "done" ||
        this.jsonToken != null ||
        (!trimmedPrefix.startsWith("{") && !trimmedPrefix.startsWith("[")) ||
        !/[}\]]$/u.test(trimmedSuffix)
      ) {
        throw new Error("The exported JSON artifact is invalid.");
      }
    } else if (this.format === "fastq" && this.fastqPhase !== 0) {
      throw new Error(
        this.fastqPhase === 3
          ? "The exported FASTQ sequence and quality lengths do not match."
          : "The exported FASTQ artifact is incomplete.",
      );
    } else if (
      (this.format === "a3m" ||
        this.format === "fasta" ||
        this.format === "aligned-fasta") &&
      (this.fastaRecordCount === 0 || this.fastaCurrentSequenceLength === 0)
    ) {
      throw new Error("The exported FASTA artifact is invalid.");
    } else if (this.format === "fastq" && !trimmedPrefix.startsWith("@")) {
      throw new Error("The exported FASTQ artifact is invalid.");
    } else if (
      this.format === "clustal" &&
      !/^(?:CLUSTAL|MUSCLE)\b/u.test(trimmedPrefix)
    ) {
      throw new Error("The exported CLUSTAL alignment artifact is invalid.");
    } else if (
      this.format === "stockholm" &&
      (!trimmedPrefix.startsWith("# STOCKHOLM 1.0") ||
        !trimmedSuffix.endsWith("//"))
    ) {
      throw new Error("The exported Stockholm alignment artifact is invalid.");
    } else if (
      this.format === "gtf" &&
      (!trimmedPrefix.includes("\t") ||
        !/\bgene_id\s+"[^"]+"/u.test(trimmedPrefix))
    ) {
      throw new Error("The exported GTF annotation artifact is invalid.");
    } else if (
      this.format === "pdf" &&
      (!/^%PDF-\d\.\d/u.test(trimmedPrefix) ||
        !/startxref\s+\d+\s+%%EOF\s*$/u.test(trimmedSuffix))
    ) {
      throw new Error("The exported PDF artifact is invalid.");
    } else if (
      this.format === "genbank" &&
      (!trimmedPrefix.startsWith("LOCUS") || !trimmedSuffix.endsWith("//"))
    ) {
      throw new Error("The exported GenBank artifact is invalid.");
    } else if (
      this.format === "embl" &&
      (!trimmedPrefix.startsWith("ID") || !trimmedSuffix.endsWith("//"))
    ) {
      throw new Error("The exported EMBL artifact is invalid.");
    } else if (
      this.format === "gff3" &&
      !trimmedPrefix.startsWith("##gff-version 3")
    ) {
      throw new Error("The exported GFF3 artifact is invalid.");
    } else if (
      this.format === "svg" &&
      (!/^<svg[\s>]/u.test(trimmedPrefix) || !trimmedSuffix.endsWith("</svg>"))
    ) {
      throw new Error("The exported SVG artifact is invalid.");
    } else if (this.format === "newick" && !trimmedSuffix.endsWith(";")) {
      throw new Error("The exported Newick artifact is invalid.");
    } else if (
      this.format === "vcf" &&
      !trimmedPrefix.startsWith("##fileformat=VCF")
    ) {
      throw new Error("The exported VCF artifact is invalid.");
    }
  }

  get peakRetainedBytes(): number {
    return this.retainedPeak;
  }

  private consume(text: string): void {
    if (text.length === 0) return;
    if (this.firstNonWhitespace.length < 256) {
      const candidate = `${this.firstNonWhitespace}${text}`.trimStart();
      this.firstNonWhitespace = candidate.slice(0, 256);
    }
    if (/\S/u.test(text)) this.seenNonWhitespace = true;
    this.suffix = `${this.suffix}${text}`.slice(-256);
    if (this.format === "json") this.consumeJson(text);
    if (
      this.format === "fasta" ||
      this.format === "a3m" ||
      this.format === "aligned-fasta" ||
      this.format === "fastq"
    ) {
      this.consumeStructuredLines(text);
    }
    this.retainedPeak = Math.max(
      this.retainedPeak,
      this.firstNonWhitespace.length * 2 +
        this.suffix.length * 2 +
        this.jsonContexts.length * 8 +
        (this.jsonToken?.value.length ?? 0),
    );
  }

  private consumeStructuredLines(text: string): void {
    for (let offset = 0; offset < text.length;) {
      const newline = text.indexOf("\n", offset);
      const rawEnd = newline === -1 ? text.length : newline;
      const end =
        rawEnd > offset && text[rawEnd - 1] === "\r" ? rawEnd - 1 : rawEnd;
      const length = end - offset;
      if (length > 0) {
        this.lineTouched = true;
        this.lineLength += length;
        if (this.linePrefix.length < 16) {
          this.linePrefix += text.slice(
            offset,
            Math.min(end, offset + 16 - this.linePrefix.length),
          );
        }
      }
      if (newline === -1) break;
      this.finishStructuredLine();
      offset = newline + 1;
    }
  }

  private finishStructuredLine(): void {
    if (this.format === "fastq") this.finishFastqLine();
    else this.finishFastaLine();
    this.lineLength = 0;
    this.linePrefix = "";
    this.lineTouched = false;
  }

  private finishFastqLine(): void {
    if (this.fastqPhase === 0) {
      if (this.lineLength === 0) return;
      if (!this.linePrefix.startsWith("@") || this.lineLength < 2) {
        throw new Error("The exported FASTQ artifact has an invalid header.");
      }
      this.fastqQualityLength = 0;
      this.fastqSequenceLength = 0;
      this.fastqPhase = 1;
    } else if (this.fastqPhase === 1) {
      if (this.linePrefix.startsWith("+")) {
        if (this.fastqSequenceLength === 0) {
          throw new Error("The exported FASTQ artifact has an empty sequence.");
        }
        this.fastqPhase = 3;
      } else if (this.lineLength === 0) {
        throw new Error("The exported FASTQ artifact has an empty sequence.");
      } else {
        this.fastqSequenceLength += this.lineLength;
      }
    } else {
      this.fastqQualityLength += this.lineLength;
      if (this.fastqQualityLength > this.fastqSequenceLength) {
        throw new Error(
          "The exported FASTQ sequence and quality lengths do not match.",
        );
      }
      if (this.fastqQualityLength === this.fastqSequenceLength) {
        this.fastqPhase = 0;
      }
    }
  }

  private finishFastaLine(): void {
    if (this.lineLength === 0 || this.linePrefix.startsWith(";")) return;
    if (this.linePrefix.startsWith(">")) {
      if (this.fastaRecordCount > 0 && this.fastaCurrentSequenceLength === 0) {
        throw new Error("The exported FASTA artifact has an empty record.");
      }
      if (this.lineLength < 2) {
        throw new Error("The exported FASTA artifact has an empty header.");
      }
      if (this.format === "aligned-fasta" && this.fastaRecordCount > 0) {
        this.assertAlignedLength();
      }
      this.fastaRecordCount += 1;
      this.fastaCurrentSequenceLength = 0;
      return;
    }
    if (this.fastaRecordCount === 0) {
      throw new Error("The exported FASTA artifact is invalid.");
    }
    this.fastaCurrentSequenceLength += this.lineLength;
    if (this.format === "aligned-fasta" && this.fastaRecordCount === 1) {
      this.fastaAlignedLength = this.fastaCurrentSequenceLength;
    }
  }

  private assertAlignedLength(): void {
    if (
      this.fastaAlignedLength != null &&
      this.fastaCurrentSequenceLength !== this.fastaAlignedLength
    ) {
      throw new Error("The exported aligned FASTA rows have unequal lengths.");
    }
  }

  private consumeJson(text: string): void {
    for (let index = 0; index < text.length;) {
      const character = text[index]!;
      if (this.jsonUnicodeDigits > 0) {
        if (!/[0-9a-f]/iu.test(character)) {
          throw new Error("The exported JSON artifact is invalid.");
        }
        this.jsonUnicodeDigits -= 1;
        index += 1;
        continue;
      }
      if (this.jsonEscape) {
        if (character === "u") this.jsonUnicodeDigits = 4;
        else if (!/["\\/bfnrt]/u.test(character)) {
          throw new Error("The exported JSON artifact is invalid.");
        }
        this.jsonEscape = false;
        index += 1;
        continue;
      }
      if (this.jsonInString) {
        if (character === "\\") this.jsonEscape = true;
        else if (character === '"') {
          this.jsonInString = false;
          if (this.jsonStringRole === "key") {
            const context = this.jsonContexts.at(-1);
            if (context?.type !== "object") this.invalidJson();
            context.state = "colon";
          }
          this.jsonStringRole = undefined;
        } else if (character.charCodeAt(0) < 0x20) {
          this.invalidJson();
        }
        index += 1;
        continue;
      }
      if (this.jsonToken != null) {
        if (/[A-Za-z0-9+\-.eE]/u.test(character)) {
          if (this.jsonToken.value.length >= 128) this.invalidJson();
          this.jsonToken.value += character;
          index += 1;
          continue;
        }
        this.finishJsonToken();
        continue;
      }
      if (/\s/u.test(character)) {
        index += 1;
        continue;
      }
      if (character === '"') {
        const context = this.jsonContexts.at(-1);
        if (
          context?.type === "object" &&
          (context.state === "key" || context.state === "key-or-end")
        ) {
          this.jsonStringRole = "key";
        } else {
          this.startJsonValue();
          this.jsonStringRole = "value";
        }
        this.jsonInString = true;
      } else if (character === "{" || character === "[") {
        this.startJsonValue();
        if (this.jsonContexts.length >= 4_096) {
          throw new Error("The exported JSON artifact is nested too deeply.");
        }
        this.jsonContexts.push(
          character === "{"
            ? { state: "key-or-end", type: "object" }
            : { state: "value-or-end", type: "array" },
        );
      } else if (character === "}" || character === "]") {
        const context = this.jsonContexts.at(-1);
        if (
          (character === "}" &&
            (context?.type !== "object" ||
              (context.state !== "key-or-end" &&
                context.state !== "comma-or-end"))) ||
          (character === "]" &&
            (context?.type !== "array" ||
              (context.state !== "value-or-end" &&
                context.state !== "comma-or-end")))
        ) {
          this.invalidJson();
        }
        this.jsonContexts.pop();
      } else if (character === ":") {
        const context = this.jsonContexts.at(-1);
        if (context?.type !== "object" || context.state !== "colon") {
          this.invalidJson();
        }
        context.state = "value";
      } else if (character === ",") {
        const context = this.jsonContexts.at(-1);
        if (context?.state !== "comma-or-end") this.invalidJson();
        context.state = context.type === "object" ? "key" : "value";
      } else if (character === "-" || /[0-9]/u.test(character)) {
        this.startJsonValue();
        this.jsonToken = { kind: "number", value: character };
      } else if (character === "t" || character === "f" || character === "n") {
        this.startJsonValue();
        this.jsonToken = { kind: "literal", value: character };
      } else {
        this.invalidJson();
      }
      index += 1;
    }
  }

  private startJsonValue(): void {
    const context = this.jsonContexts.at(-1);
    if (context == null) {
      if (this.jsonRootState !== "value") this.invalidJson();
      this.jsonRootState = "done";
      return;
    }
    if (
      context.state !== "value" &&
      !(context.type === "array" && context.state === "value-or-end")
    ) {
      this.invalidJson();
    }
    context.state = "comma-or-end";
  }

  private finishJsonToken(): void {
    const token = this.jsonToken;
    this.jsonToken = undefined;
    if (
      token == null ||
      (token.kind === "literal" &&
        token.value !== "true" &&
        token.value !== "false" &&
        token.value !== "null") ||
      (token.kind === "number" &&
        !/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$/u.test(
          token.value,
        ))
    ) {
      this.invalidJson();
    }
  }

  private invalidJson(): never {
    throw new Error("The exported JSON artifact is invalid.");
  }
}

export function createIncrementalExportValidator(
  input: SequenceWorkbenchPayloadDeclaration,
): IncrementalSequenceExportValidator | undefined {
  if (
    input.kind !== "artifact" ||
    input.destination.kind !== "workspace" ||
    input.format == null ||
    input.mediaType == null
  ) {
    return undefined;
  }
  return new IncrementalSequenceExportValidator(input.format, input.mediaType);
}
