import { NextResponse } from 'next/server';
import type { ApiResponse, ErrorCode } from '@/types/api';

export function successResponse<T>(
  data: T,
  meta?: ApiResponse<T>['meta'],
  headers?: Record<string, string>
): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    { success: true, data, meta },
    { status: 200, headers }
  );
}

export function createdResponse<T>(
  data: T,
  headers?: Record<string, string>
): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    { success: true, data },
    { status: 201, headers }
  );
}

export function errorResponse(
  code: ErrorCode,
  message: string,
  status: number,
  headers?: Record<string, string>
): NextResponse<ApiResponse<never>> {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status, headers }
  );
}

export function unauthorizedResponse(
  message = 'Invalid or missing API key',
  headers?: Record<string, string>
): NextResponse<ApiResponse<never>> {
  return errorResponse('UNAUTHORIZED', message, 401, headers);
}

export function forbiddenResponse(
  message = 'Access denied',
  headers?: Record<string, string>
): NextResponse<ApiResponse<never>> {
  return errorResponse('FORBIDDEN', message, 403, headers);
}

export function notFoundResponse(
  message = 'Resource not found',
  headers?: Record<string, string>
): NextResponse<ApiResponse<never>> {
  return errorResponse('NOT_FOUND', message, 404, headers);
}

export function validationErrorResponse(
  message: string,
  headers?: Record<string, string>
): NextResponse<ApiResponse<never>> {
  return errorResponse('VALIDATION_ERROR', message, 400, headers);
}

export function rateLimitedResponse(
  resetAt: Date,
  headers?: Record<string, string>
): NextResponse<ApiResponse<never>> {
  const allHeaders = {
    ...headers,
    'Retry-After': String(Math.ceil((resetAt.getTime() - Date.now()) / 1000)),
  };
  return errorResponse(
    'RATE_LIMITED',
    `Rate limit exceeded. Try again after ${resetAt.toISOString()}`,
    429,
    allHeaders
  );
}

export function conflictResponse(
  message: string,
  headers?: Record<string, string>
): NextResponse<ApiResponse<never>> {
  return errorResponse('CONFLICT', message, 409, headers);
}

export function internalErrorResponse(
  message = 'Internal server error',
  headers?: Record<string, string>
): NextResponse<ApiResponse<never>> {
  return errorResponse('INTERNAL_ERROR', message, 500, headers);
}
