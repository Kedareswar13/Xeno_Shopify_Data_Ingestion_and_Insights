import { format, formatDistanceToNow, parseISO, differenceInDays } from 'date-fns';

export const formatDate = (dateString: string | Date, formatStr = 'MMM d, yyyy') => {
  const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
  return format(date, formatStr);
};

export const formatDateTime = (dateString: string | Date) => {
  return formatDate(dateString, 'MMM d, yyyy h:mm a');
};

export const formatTimeAgo = (dateString: string | Date) => {
  const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
  return formatDistanceToNow(date, { addSuffix: true });
};

export const isRecent = (dateString: string | Date, days = 7) => {
  const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
  return differenceInDays(new Date(), date) <= days;
};

export const formatCurrency = (
  amount: number,
  currency: string = 'USD',
  locale: string = 'en-US'
) => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount);
};

export const formatNumber = (value: number, locale: string = 'en-US') => {
  return new Intl.NumberFormat(locale).format(value);
};

export const formatFileSize = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

export const slugify = (text: string) => {
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/[^\w-]+/g, '') // Remove all non-word chars
    .replace(/--+/g, '-') // Replace multiple - with single -
    .replace(/^-+/, '') // Trim - from start of text
    .replace(/-+$/, ''); // Trim - from end of text
};

export const truncate = (str: string, length: number, append = '...') => {
  if (str.length <= length) return str;
  return str.substring(0, length - append.length) + append;
};
