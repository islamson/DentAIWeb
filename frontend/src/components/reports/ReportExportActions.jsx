import { useState } from "react";
import * as XLSX from "xlsx";
import { Download, FileSpreadsheet } from "lucide-react";
import { Button } from "../ui/button";
import { formatCellValue } from "../../features/reports/reportUtils";

export function ReportExportActions({ reportTitle, columns = [], rows = [], disabled = false }) {
  const [exporting, setExporting] = useState(false);

  const exportToExcel = async () => {
    try {
      setExporting(true);

      const data = rows.map((row) =>
        columns.reduce((acc, column) => {
          acc[column.label] = formatCellValue(row[column.key], column);
          return acc;
        }, {})
      );

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
      XLSX.writeFile(
        workbook,
        `${(reportTitle || "report").toLowerCase().replace(/\s+/g, "_")}_${new Date()
          .toISOString()
          .slice(0, 10)}.xlsx`
      );
    } catch (error) {
      console.error("Report export failed:", error);
      alert("Excel dışa aktarımı sırasında bir hata oluştu.");
    } finally {
      setExporting(false);
    }
  };

  const exportToPdfPlaceholder = () => {
    alert("PDF dışa aktarma yapısı hazır. Şablon eşlemesi MedicaSimple ekranları geldikten sonra tamamlanacak.");
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        className="h-9 rounded-xl"
        onClick={exportToPdfPlaceholder}
        disabled={disabled}
      >
        <Download className="mr-1.5 h-3.5 w-3.5" />
        PDF
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-9 rounded-xl"
        onClick={exportToExcel}
        disabled={disabled || exporting}
      >
        <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />
        {exporting ? "Excel hazırlanıyor..." : "Excel"}
      </Button>
    </div>
  );
}
