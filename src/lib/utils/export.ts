import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ============================================
// CSV Export
// ============================================

interface ExportColumn<T> {
  key: keyof T | string;
  header: string;
  format?: (value: unknown, row: T) => string;
}

export function exportToCSV<T extends Record<string, unknown>>(
  data: T[],
  columns: ExportColumn<T>[],
  filename: string
): void {
  // BOM for UTF-8
  const BOM = '\uFEFF';

  // Headers
  const headers = columns.map((col) => `"${col.header}"`).join(';');

  // Rows
  const rows = data.map((row) => {
    return columns.map((col) => {
      const value = getNestedValue(row, col.key as string);
      const formatted = col.format ? col.format(value, row) : String(value ?? '');
      // Escape quotes and wrap in quotes
      return `"${formatted.replace(/"/g, '""')}"`;
    }).join(';');
  });

  const csvContent = BOM + headers + '\n' + rows.join('\n');

  downloadFile(csvContent, `${filename}.csv`, 'text/csv;charset=utf-8');
}

// ============================================
// PDF Export
// ============================================

interface PDFOptions {
  title: string;
  subtitle?: string;
  orientation?: 'portrait' | 'landscape';
}

export function exportToPDF<T extends Record<string, unknown>>(
  data: T[],
  columns: ExportColumn<T>[],
  filename: string,
  options: PDFOptions
): void {
  // Generate HTML table
  const headers = columns.map((col) => `<th style="background:#D4AF37;color:#0A0A0A;padding:12px 8px;text-align:left;font-weight:600;">${col.header}</th>`).join('');

  const rows = data.map((row, index) => {
    const cells = columns.map((col) => {
      const value = getNestedValue(row, col.key as string);
      const formatted = col.format ? col.format(value, row) : String(value ?? '');
      return `<td style="padding:10px 8px;border-bottom:1px solid #333;">${formatted}</td>`;
    }).join('');
    return `<tr style="background:${index % 2 === 0 ? '#1A1A1A' : '#141414'}">${cells}</tr>`;
  }).join('');

  const now = format(new Date(), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${options.title}</title>
      <style>
        @page {
          size: A4 ${options.orientation || 'portrait'};
          margin: 20mm;
        }
        body {
          font-family: 'Segoe UI', Arial, sans-serif;
          background: #0A0A0A;
          color: #FAFAFA;
          margin: 0;
          padding: 20px;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 2px solid #D4AF37;
        }
        .logo {
          font-size: 24px;
          font-weight: bold;
          color: #D4AF37;
          margin-bottom: 5px;
        }
        .title {
          font-size: 20px;
          font-weight: 600;
          margin: 10px 0 5px;
        }
        .subtitle {
          font-size: 14px;
          color: #888;
        }
        .date {
          font-size: 12px;
          color: #666;
          margin-top: 10px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }
        th {
          white-space: nowrap;
        }
        td {
          color: #FAFAFA;
        }
        .footer {
          margin-top: 30px;
          text-align: center;
          font-size: 11px;
          color: #666;
        }
        .stats {
          display: flex;
          justify-content: space-between;
          margin-bottom: 20px;
          padding: 15px;
          background: #141414;
          border-radius: 8px;
        }
        .stat {
          text-align: center;
        }
        .stat-value {
          font-size: 24px;
          font-weight: bold;
          color: #D4AF37;
        }
        .stat-label {
          font-size: 11px;
          color: #888;
          margin-top: 4px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">NeuroAI Analytics</div>
        <div class="title">${options.title}</div>
        ${options.subtitle ? `<div class="subtitle">${options.subtitle}</div>` : ''}
        <div class="date">Gerado em ${now}</div>
      </div>
      
      <div class="stats">
        <div class="stat">
          <div class="stat-value">${data.length}</div>
          <div class="stat-label">Total de Registros</div>
        </div>
      </div>
      
      <table>
        <thead>
          <tr>${headers}</tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
      
      <div class="footer">
        NeuroAI Analytics - Sistema de Inteligência para Agentes de IA<br>
        © ${new Date().getFullYear()} Todos os direitos reservados
      </div>
    </body>
    </html>
  `;

  // Open print dialog
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();

    // Wait for content to load then trigger print
    printWindow.onload = () => {
      printWindow.print();
    };
  }
}

// ============================================
// Leads Export Helpers
// ============================================

export interface LeadExportData {
  nome: string;
  telefone?: string;
  origem_cliente_taj?: string | null;
  status_atendimento: string;
  timestamp: string;
  chatid: string;
  [key: string]: string | null | undefined; // Index signature for export compatibility
}

export const leadsExportColumns: ExportColumn<LeadExportData>[] = [
  { key: 'nome', header: 'Nome' },
  {
    key: 'telefone',
    header: 'Telefone',
    format: (v) => v ? String(v) : 'N/A'
  },
  {
    key: 'origem_cliente_taj',
    header: 'Origem',
    format: (v) => v ? String(v) : 'Não Identificado'
  },
  {
    key: 'status_atendimento',
    header: 'Status',
    format: (v) => String(v || 'ativo').charAt(0).toUpperCase() + String(v || 'ativo').slice(1)
  },
  {
    key: 'timestamp',
    header: 'Data',
    format: (v) => v ? format(new Date(String(v)), 'dd/MM/yyyy HH:mm') : ''
  },
  { key: 'chatid', header: 'Chat ID' },
];

export function exportLeadsCSV(leads: LeadExportData[], dateLabel?: string) {
  const filename = `leads_${dateLabel?.replace(/\s+/g, '_') || format(new Date(), 'yyyy-MM-dd')}`;
  exportToCSV(leads, leadsExportColumns, filename);
}

export function exportLeadsPDF(leads: LeadExportData[], dateLabel?: string) {
  const filename = `leads_${dateLabel?.replace(/\s+/g, '_') || format(new Date(), 'yyyy-MM-dd')}`;
  exportToPDF(leads, leadsExportColumns, filename, {
    title: 'Relatório de Leads',
    subtitle: dateLabel || `Gerado em ${format(new Date(), 'dd/MM/yyyy')}`,
    orientation: 'landscape',
  });
}

// ============================================
// Analytics Export Helpers
// ============================================

export interface AnalyticsExportData {
  etapa: string;
  quantidade: number;
  percentual: number;
}

export const analyticsExportColumns: ExportColumn<AnalyticsExportData>[] = [
  { key: 'etapa', header: 'Etapa de Abandono' },
  { key: 'quantidade', header: 'Quantidade' },
  {
    key: 'percentual',
    header: 'Percentual',
    format: (v) => `${Number(v).toFixed(1)}%`
  },
];

// ============================================
// Utilities
// ============================================

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((acc: unknown, part) => {
    if (acc && typeof acc === 'object' && part in acc) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
