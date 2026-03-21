/**
 * CSV Export Service — client-side generation via Blob + URL.createObjectURL.
 */
export const exportService = {
  /**
   * Generates a CSV string from an array of objects with the given column definitions.
   */
  generateCsv(
    rows: Record<string, unknown>[],
    columns: { key: string; header: string; formatter?: (val: unknown) => string }[]
  ): string {
    const header = columns.map((c) => `"${c.header}"`).join(";");
    const body = rows.map((row) =>
      columns
        .map((c) => {
          const raw = row[c.key];
          const val = c.formatter ? c.formatter(raw) : String(raw ?? "");
          return `"${val.replace(/"/g, '""')}"`;
        })
        .join(";")
    );
    return [header, ...body].join("\r\n");
  },

  /**
   * Triggers a browser download of the given CSV content.
   */
  downloadCsv(csv: string, filename: string) {
    const bom = "\uFEFF"; // UTF-8 BOM for Excel compatibility
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
};
