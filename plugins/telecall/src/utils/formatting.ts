import { TeleCallProduct } from '../types/product';
import { PriceBreakdown } from '../types/pricing';
import { ComparisonResult } from '../types/recommendation';

export function formatCurrency(amount: number): string {
  return `${amount} €/mes`;
}

export function formatFiberSpeed(speedMbps?: number): string {
  if (!speedMbps) return 'Sin fibra';
  if (speedMbps >= 1000) return `${speedMbps / 1000} Gbps`;
  return `${speedMbps} Mbps`;
}

export function formatMobileData(dataGB?: number): string {
  if (dataGB === undefined || dataGB === null) return 'Sin datos móviles';
  return `${dataGB} GB`;
}

export function formatTelevisionSummary(p: TeleCallProduct): string {
  if (!p.television) return 'No incluida';
  const list: string[] = [];
  if (p.television.movistarPlus) list.push('Movistar Plus+');
  if (p.television.netflix) list.push('Netflix');
  if (p.television.disneyPlus) list.push('Disney+');
  return list.length > 0 ? list.join(' + ') : 'No incluida';
}

export function formatPriceBreakdownText(breakdown: PriceBreakdown): string {
  const lines: string[] = [];
  lines.push(`• Tarifa base (${breakdown.baseProduct.name}): ${breakdown.basePrice} €/mes`);

  if (breakdown.additionalLines.length > 0) {
    for (const item of breakdown.additionalLines) {
      lines.push(`• ${item.quantity}x ${item.product.name}: ${item.total} €/mes (${item.priceEach} €/ud)`);
    }
  }

  if (breakdown.secondResidence) {
    lines.push(`• ${breakdown.secondResidence.product.name}: ${breakdown.secondResidence.price} €/mes`);
  }

  lines.push(`Total mensual: ${breakdown.totalMonthly} €/mes`);
  return lines.join('\n');
}

export function formatComparisonMarkdownTable(comparison: ComparisonResult): string {
  const headerLine = `| ${comparison.headers.join(' | ')} |`;
  const separatorLine = `| ${comparison.headers.map(() => '---').join(' | ')} |`;
  const rowLines = comparison.rows.map(
    r => `| ${r.optionName} | ${r.fiberSpeed} | ${r.mobileData} | ${r.television} | ${r.services} | ${r.monthlyPrice} |`
  );

  return [headerLine, separatorLine, ...rowLines].join('\n');
}
