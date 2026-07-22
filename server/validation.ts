import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

type Source = 'body' | 'query' | 'params';

export function validate<T>(schema: ZodSchema<T>, source: Source = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      let raw = req[source];
      if (source === 'body' && typeof raw === 'string') {
        try {
          raw = JSON.parse(raw);
        } catch {}
      }
      const data = schema.parse(raw);
      // Replace with parsed/coerced data so handlers receive clean types
      (req as any)[source] = data;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({
          error: 'Dados inválidos.',
          issues: err.issues.map(i => ({
            path: i.path.join('.'),
            message: i.message
          }))
        });
      }
      next(err);
    }
  };
}

export function onlyDigits(s: string): string {
  return s.replace(/\D/g, '');
}

export function normalizePhone(input: string): string {
  const digits = onlyDigits(input);
  if (!digits) return '';
  if (digits.length <= 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, (_, a, b, c) =>
      c ? `${a}${b}${c}` : `${a}${b}`
    );
  }
  return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, (_, a, b, c) =>
    c ? `${a}${b}${c}` : `${a}${b}`
  );
}
