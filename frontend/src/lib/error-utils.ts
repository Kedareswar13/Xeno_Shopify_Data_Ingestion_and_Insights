import { isAxiosError } from 'axios';
import { ZodError } from 'zod';

type ErrorWithMessage = {
  message: string;
  status?: number;
  code?: string;
  errors?: Record<string, string[]>;
};

type ApiErrorResponse = {
  message: string;
  statusCode: number;
  error?: string;
  errors?: Record<string, string[]>;
};

function isErrorWithMessage(error: unknown): error is ErrorWithMessage {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as Record<string, unknown>).message === 'string'
  );
}

function toErrorWithMessage(maybeError: unknown): ErrorWithMessage {
  if (isAxiosError(maybeError)) {
    const response = maybeError.response?.data as ApiErrorResponse | undefined;
    
    if (response) {
      return {
        message: response.message || 'An error occurred',
        status: maybeError.response?.status,
        code: maybeError.code,
        errors: response.errors,
      };
    }

    return {
      message: maybeError.message || 'Network Error',
      status: maybeError.response?.status,
      code: maybeError.code,
    };
  }

  if (maybeError instanceof ZodError) {
    const errors: Record<string, string[]> = {};
    
    maybeError.errors.forEach((issue) => {
      const path = issue.path.join('.');
      if (!errors[path]) {
        errors[path] = [];
      }
      errors[path].push(issue.message);
    });

    return {
      message: 'Validation Error',
      errors,
    };
  }

  if (isErrorWithMessage(maybeError)) {
    return maybeError;
  }

  try {
    return {
      message: JSON.stringify(maybeError, null, 2),
    };
  } catch {
    return {
      message: String(maybeError),
    };
  }
}

export function getErrorMessage(error: unknown): string {
  const errorWithMessage = toErrorWithMessage(error);
  return errorWithMessage.message;
}

export function getErrorStatus(error: unknown): number | undefined {
  const errorWithMessage = toErrorWithMessage(error);
  return errorWithMessage.status;
}

export function getErrorCode(error: unknown): string | undefined {
  const errorWithMessage = toErrorWithMessage(error);
  return errorWithMessage.code;
}

export function getErrorFieldErrors(
  error: unknown
): Record<string, string[]> | undefined {
  const errorWithMessage = toErrorWithMessage(error);
  return errorWithMessage.errors;
}

export function getFirstErrorMessage(error: unknown): string | null {
  const errors = getErrorFieldErrors(error);
  if (!errors) return null;
  
  const firstErrorKey = Object.keys(errors)[0];
  if (!firstErrorKey) return null;
  
  return errors[firstErrorKey][0] || null;
}

export function isNetworkError(error: unknown): boolean {
  if (!isAxiosError(error)) return false;
  return !error.response;
}

export function isUnauthorizedError(error: unknown): boolean {
  return getErrorStatus(error) === 401;
}

export function isForbiddenError(error: unknown): boolean {
  return getErrorStatus(error) === 403;
}

export function isNotFoundError(error: unknown): boolean {
  return getErrorStatus(error) === 404;
}

export function isServerError(error: unknown): boolean {
  const status = getErrorStatus(error);
  return status ? status >= 500 : false;
}

export function isValidationError(error: unknown): boolean {
  return getErrorStatus(error) === 422;
}

export function handleError(error: unknown, defaultMessage = 'An error occurred'): never {
  const errorMessage = getErrorMessage(error);
  throw new Error(errorMessage || defaultMessage);
}

export function logError(error: unknown, context?: string): void {
  const errorMessage = getErrorMessage(error);
  const errorContext = context ? `[${context}] ` : '';
  console.error(`${errorContext}${errorMessage}`, error);
}

export function createError(
  message: string,
  options: Partial<ErrorWithMessage> = {}
): ErrorWithMessage {
  return {
    message,
    ...options,
  };
}
