"use client";

import { useState } from "react";
import Link from "next/link";
import { SellerNav } from "@/components/SellerNav";
import { notify } from "@/store/notify";
import type { ParsedProductRow } from "@/lib/types";

type ParseResult = {
  type: string;
  fileName: string;
  totalRows: number;
  validCount: number;
  rows: ParsedProductRow[];
};

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [rows, setRows] = useState<ParsedProductRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState<{ imported: number; skipped: number } | null>(null);

  async function handleParse() {
    if (!file) return;
    setParsing(true);
    setDone(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload/parse", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
      setRows(data.rows);
    } catch (e) {
      notify.error((e as Error).message);
    } finally {
      setParsing(false);
    }
  }

  function editRow(i: number, field: keyof ParsedProductRow, value: string) {
    setRows((prev) => {
      const next = [...prev];
      const row = { ...next[i] };
      if (field === "price" || field === "mrp" || field === "stock") {
        (row[field] as number | null) = value === "" ? null : Number(value);
      } else {
        (row[field] as unknown as string) = value;
      }
      // Re-validate the essentials on edit.
      const errs: string[] = [];
      if (!row.name) errs.push("Missing product name");
      if (row.price === null || Number.isNaN(row.price)) errs.push("Missing/invalid price");
      row._errors = errs;
      next[i] = row;
      return next;
    });
  }

  async function handleImport() {
    if (!result) return;
    setImporting(true);
    try {
      const res = await fetch("/api/upload/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, fileName: result.fileName, fileType: result.type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDone({ imported: data.imported, skipped: data.skipped });
      setResult(null);
      setRows([]);
      setFile(null);
    } catch (e) {
      notify.error((e as Error).message);
    } finally {
      setImporting(false);
    }
  }

  const validRows = rows.filter((r) => r._errors.length === 0).length;

  return (
    <div>
      <SellerNav />
      <h1 className="text-xl font-extrabold">Bulk product upload</h1>
      <p className="mt-1 text-sm text-gray-500">
        Upload a <b>CSV</b>, <b>Excel (.xlsx)</b>, or <b>PDF</b>. We auto-map columns; review &amp; edit before importing.
        {" "}
        <a href="/sample-products.csv" download className="text-brand-700 underline">
          Download CSV template
        </a>
      </p>

      {done && (
        <div className="mt-4 rounded-lg bg-brand-50 p-4 text-brand-700">
          ✅ Imported <b>{done.imported}</b> products. {done.skipped > 0 && `Skipped ${done.skipped} row(s) with errors.`}{" "}
          <Link href="/seller/products" className="underline">View products</Link>
        </div>
      )}

      {/* Upload box */}
      {!result && (
        <div className="mt-4 card p-6">
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 p-8 text-center hover:border-brand-400">
            <span className="text-4xl">📄</span>
            <span className="text-sm font-medium">
              {file ? file.name : "Click to choose a file"}
            </span>
            <span className="text-xs text-gray-400">CSV · XLSX · PDF</span>
            <input
              type="file"
              accept=".csv,.xlsx,.xls,.pdf"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <button className="btn-primary mt-4 w-full" disabled={!file || parsing} onClick={handleParse}>
            {parsing ? "Parsing…" : "Parse file"}
          </button>
        </div>
      )}

      {/* Preview + edit */}
      {result && (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm">
              <b>{result.fileName}</b> · {result.totalRows} rows ·{" "}
              <span className="text-brand-700">{validRows} ready</span> ·{" "}
              <span className="text-red-600">{rows.length - validRows} need fixing</span>
            </p>
            <button className="text-sm text-gray-500 underline" onClick={() => { setResult(null); setRows([]); }}>
              Cancel
            </button>
          </div>

          <div className="card overflow-x-auto">
            <table className="min-w-[720px] text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="p-2">#</th>
                  <th className="p-2">Name*</th>
                  <th className="p-2">Category</th>
                  <th className="p-2">Price*</th>
                  <th className="p-2">MRP</th>
                  <th className="p-2">Stock</th>
                  <th className="p-2">Unit</th>
                  <th className="p-2">Brand</th>
                  <th className="p-2">Issues</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={r._errors.length ? "bg-red-50/50" : ""}>
                    <td className="p-2 text-gray-400">{i + 1}</td>
                    <Cell v={r.name} onChange={(v) => editRow(i, "name", v)} w="w-40" />
                    <Cell v={r.category ?? ""} onChange={(v) => editRow(i, "category", v)} w="w-28" />
                    <Cell v={r.price ?? ""} onChange={(v) => editRow(i, "price", v)} w="w-20" type="number" />
                    <Cell v={r.mrp ?? ""} onChange={(v) => editRow(i, "mrp", v)} w="w-20" type="number" />
                    <Cell v={r.stock ?? ""} onChange={(v) => editRow(i, "stock", v)} w="w-16" type="number" />
                    <Cell v={r.unit ?? ""} onChange={(v) => editRow(i, "unit", v)} w="w-20" />
                    <Cell v={r.brand ?? ""} onChange={(v) => editRow(i, "brand", v)} w="w-24" />
                    <td className="p-2 text-xs text-red-600">{r._errors.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button className="btn-primary mt-4 w-full" disabled={importing || validRows === 0} onClick={handleImport}>
            {importing ? "Importing…" : `Import ${validRows} product${validRows === 1 ? "" : "s"}`}
          </button>
        </div>
      )}
    </div>
  );
}

function Cell({
  v,
  onChange,
  w,
  type = "text",
}: {
  v: string | number;
  onChange: (v: string) => void;
  w: string;
  type?: string;
}) {
  return (
    <td className="p-1">
      <input
        type={type}
        value={v}
        onChange={(e) => onChange(e.target.value)}
        className={`${w} rounded border border-gray-200 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none`}
      />
    </td>
  );
}
