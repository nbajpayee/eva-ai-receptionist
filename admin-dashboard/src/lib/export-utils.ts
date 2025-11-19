/**
 * Utility functions for exporting data to CSV and PNG formats
 */

// Type definitions
type CSVRow = Record<string, string | number | boolean | null | undefined>;

type FunnelStage = {
  name: string;
  value: number;
  color: string;
};

type HeatmapCell = {
  day: number;
  hour: number;
  value: number;
};

type TimeSeriesDataPoint = {
  timestamp: string;
  total_calls?: number;
  appointments_booked?: number;
  avg_satisfaction_score?: number;
};

/**
 * Convert array of objects to CSV string
 */
export function convertToCSV(data: CSVRow[]): string {
  if (data.length === 0) return "";

  // Get headers from first object
  const headers = Object.keys(data[0]);
  const headerRow = headers.join(",");

  // Convert each row to CSV
  const rows = data.map((row) => {
    return headers
      .map((header) => {
        const value = row[header];
        // Handle values that contain commas or quotes
        if (
          typeof value === "string" &&
          (value.includes(",") || value.includes('"'))
        ) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value ?? "";
      })
      .join(",");
  });

  return [headerRow, ...rows].join("\n");
}

/**
 * Download data as CSV file
 */
export function downloadCSV(data: CSVRow[], filename: string): void {
  const csv = convertToCSV(data);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");

  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up the URL object
  URL.revokeObjectURL(url);
}

/**
 * Export chart as PNG image
 * @param elementId - ID of the chart container element
 * @param filename - Name for the downloaded file (without extension)
 */
export async function exportChartAsPNG(
  elementId: string,
  filename: string
): Promise<void> {
  // This requires html2canvas library
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Element with id "${elementId}" not found`);
  }

  try {
    // Dynamically import html2canvas to reduce bundle size
    const html2canvas = (await import("html2canvas")).default;

    const canvas = await html2canvas(element, {
      backgroundColor: "#ffffff",
      scale: 2, // Higher quality
      logging: false,
    });

    // Convert canvas to blob
    canvas.toBlob((blob) => {
      if (!blob) {
        throw new Error("Failed to create image blob");
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${filename}.png`;
      link.click();

      // Clean up
      URL.revokeObjectURL(url);
    });
  } catch (error) {
    console.error("Error exporting chart:", error);
    throw error;
  }
}

/**
 * Format funnel data for CSV export
 */
export function formatFunnelDataForCSV(stages: FunnelStage[]): CSVRow[] {
  return stages.map((stage, index) => ({
    stage: index + 1,
    name: stage.name,
    count: stage.value,
    conversion_rate:
      index === 0
        ? "100%"
        : `${((stage.value / stages[0].value) * 100).toFixed(1)}%`,
  }));
}

/**
 * Format heatmap data for CSV export
 */
export function formatHeatmapDataForCSV(data: HeatmapCell[]): CSVRow[] {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  return data.map((cell) => ({
    day: days[cell.day],
    hour: `${cell.hour}:00`,
    call_count: cell.value,
  }));
}

/**
 * Format time series data for CSV export
 */
export function formatTimeSeriesDataForCSV(data: TimeSeriesDataPoint[]): CSVRow[] {
  return data.map((item) => ({
    timestamp: item.timestamp,
    total_calls: item.total_calls ?? 0,
    appointments_booked: item.appointments_booked ?? 0,
    avg_satisfaction: item.avg_satisfaction_score
      ? item.avg_satisfaction_score.toFixed(2)
      : "N/A",
  }));
}

/**
 * Helper to export data to CSV (alias for downloadCSV for compatibility)
 */
export const exportToCSV = downloadCSV;

/**
 * Generate export filename with timestamp
 */
export function generateExportFilename(prefix: string): string {
  const timestamp = new Date().toISOString().split('T')[0];
  return `${prefix}-${timestamp}`;
}
