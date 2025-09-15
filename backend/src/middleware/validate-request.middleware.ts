import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';
import { StatusCodes } from 'http-status-codes';
import { AppError } from './error.middleware';

// Run an array of validations and throw if any errors are found
export const validateRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const mapped = errors.array().map((e: any) => ({
      field: e.param ?? e.path ?? 'unknown',
      message: e.msg,
    }));
    return next(new AppError('Validation failed', StatusCodes.BAD_REQUEST, { errors: mapped }));
  }
  return next();
};

// Helper to wrap route-specific validation chains then call validateRequest
export const withValidations = (chains: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    await Promise.all(chains.map((c) => c.run(req)));
    return validateRequest(req, res, next);
  };
};
