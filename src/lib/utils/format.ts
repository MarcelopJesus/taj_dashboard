import { formatDistanceToNow, format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function formatTimeAgo(dateString: string): string {
    try {
        const date = parseISO(dateString);
        return formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
    } catch {
        return 'Data inválida';
    }
}

export function formatDate(dateString: string, formatStr: string = 'dd/MM/yyyy'): string {
    try {
        const date = parseISO(dateString);
        return format(date, formatStr, { locale: ptBR });
    } catch {
        return 'Data inválida';
    }
}

export function formatDateTime(dateString: string): string {
    return formatDate(dateString, "dd/MM/yyyy 'às' HH:mm");
}

export function formatPhone(phone: string): string {
    // Mascara o telefone: 5511****6060
    if (!phone || phone.length < 8) return phone;
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length >= 11) {
        return `${cleaned.slice(0, 4)}****${cleaned.slice(-4)}`;
    }
    return `****${cleaned.slice(-4)}`;
}

export function formatNumber(num: number): string {
    return new Intl.NumberFormat('pt-BR').format(num);
}

export function formatPercentage(num: number, decimals: number = 1): string {
    return `${num.toFixed(decimals)}%`;
}

export function formatCurrency(num: number): string {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(num);
}
