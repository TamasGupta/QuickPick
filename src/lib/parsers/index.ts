import Papa from "papaparse";
import * as XLSX from "xlsx";
import { normalizeRows, parsePdfLines } from "./normalize";
import type { ParsedProductRow } from "@/lib/types";

export type SupportedType = "csv" | "xlsx" | "pdf";

export function detectType(fileName: string, mime?: string): SupportedType | null {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "csv" || mime === "text/csv") return "csv";
  if (ext === "xlsx" || ext === "xls") return "xlsx";
  if (ext === "pdf" || mime === "application/pdf") return "pdf";
  return null;
}

function parseCsv(buffer: Buffer): Record<string, unknown>[] {
  const text = buffer.toString("utf-8");
  const result = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  return result.data;
}

function parseXlsx(buffer: Buffer): Record<string, unknown>[] {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });
}

async function parsePdf(buffer: Buffer): Promise<Record<string, unknown>[]> {
  // pdf-parse is CommonJS and node-only; import lazily so it never bundles client-side.
  const pdfParse = (await import("pdf-parse")).default;
  const data = await pdfParse(buffer);
  return parsePdfLines(data.text);
}

/**
 * Parse an uploaded file buffer into normalized, validated product rows.
 * Server-side only.
 */
export async function parseProductFile(
  buffer: Buffer,
  type: SupportedType
): Promise<ParsedProductRow[]> {
  let raw: Record<string, unknown>[] = [];
  if (type === "csv") raw = parseCsv(buffer);
  else if (type === "xlsx") raw = parseXlsx(buffer);
  else if (type === "pdf") raw = await parsePdf(buffer);
  return normalizeRows(raw);
}
