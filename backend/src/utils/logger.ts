import winston from 'winston';
import { TransformableInfo } from 'logform';
import path from 'path';
import fs from 'fs';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');

// Create logs directory if it doesn't exist
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const { combine, timestamp, printf, colorize, align } = winston.format;

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: combine(
    timestamp({
      format: 'YYYY-MM-DD HH:mm:ss',
    }),
    colorize({ all: true }),
    align(),
    printf(
      (info: TransformableInfo) =>
        `[${info.timestamp}] ${info.level}: ${info.message}`
    )
  ),
  transports: [
    // Write all logs with level `error` and below to `error.log`
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
    }),
    // Write all logs to `combined.log`
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
  exitOnError: false, // Do not exit on handled exceptions
});

// If we're not in production, log to the console as well
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: combine(colorize({ all: true })),
    })
  );
}

// Create a stream object with a 'write' function that will be used by `morgan`
export const stream = {
  write: (message: string): void => {
    logger.info(message.trim());
  },
};

export default logger;
