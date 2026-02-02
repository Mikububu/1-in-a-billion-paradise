import { CityOption } from '@/types/forms';

export const formatDisplayDate = (value?: string) => {
  if (!value) return '';
  const [year, month, day] = value.split('-').map((part) => Number(part));
  if (!year || !month || !day) return value;
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

export const formatDisplayTime = (value?: string) => {
  if (!value) return '';
  const [hourString, minuteString] = value.split(':');
  const hour = Number(hourString);
  const minute = Number(minuteString);
  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return value;
  }
  const date = new Date();
  date.setHours(hour);
  date.setMinutes(minute);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const formatCityLabel = (city?: CityOption) => {
  if (!city) return '';
  return `${city.name}, ${city.country}`;
};

