/**
 * CLIENT-SIDE FORM VALIDATION
 *
 * Zod schemas for validating user input in onboarding and profile forms.
 * Note: Uses basic validation since zod may not be in frontend deps yet.
 */

// Simple validation helpers (no external deps needed)

export function validateName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Name is required';
  if (trimmed.length < 2) return 'Name must be at least 2 characters';
  if (trimmed.length > 50) return 'Name must be 50 characters or less';
  return null; // valid
}

export function validateBirthDate(date: Date | null): string | null {
  if (!date) return 'Birth date is required';
  const now = new Date();
  const age = now.getFullYear() - date.getFullYear();
  if (age < 13) return 'You must be at least 13 years old';
  if (age > 120) return 'Please enter a valid birth date';
  return null;
}

export function validateBirthTime(time: string | null): string | null {
  if (!time) return 'Birth time is required for accurate readings';
  // Expected format: HH:MM
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return 'Invalid time format';
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (hours < 0 || hours > 23) return 'Hours must be between 0 and 23';
  if (minutes < 0 || minutes > 59) return 'Minutes must be between 0 and 59';
  return null;
}

export function validateCity(city: string): string | null {
  const trimmed = city.trim();
  if (!trimmed) return 'City is required';
  if (trimmed.length < 2) return 'Please enter a valid city name';
  if (trimmed.length > 100) return 'City name is too long';
  return null;
}

export function validateEmail(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return 'Email is required';
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) return 'Please enter a valid email address';
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return 'Password is required';
  if (password.length < 8) return 'Password must be at least 8 characters';
  return null;
}
