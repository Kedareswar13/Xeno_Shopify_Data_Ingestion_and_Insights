import nodemailer from 'nodemailer';
import path from 'path';
import fs from 'fs/promises';
import handlebars from 'handlebars';
import logger from '../utils/logger';

// Email configuration
export interface EmailOptions {
  to: string;
  subject: string;
  template: string;
  context: Record<string, any>;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private templatesDir: string;

  constructor() {
    // Only create transporter if email config is present
    if (process.env.EMAIL_HOST && process.env.EMAIL_PORT && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      this.transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT, 10),
        secure: process.env.EMAIL_PORT === '465', // true for 465, false for other ports
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
        // For development with self-signed certificates
        tls: {
          rejectUnauthorized: process.env.NODE_ENV === 'production',
        },
      });

      // Verify connection configuration
      this.verifyConnection();
    } else if (process.env.NODE_ENV !== 'test') {
      logger.warn('Email configuration is incomplete. Email functionality will be disabled.');
    }

    // Set templates directory
    this.templatesDir = path.join(process.cwd(), 'src/templates/email');
  }

  // Check if email service is properly configured
  isConfigured(): boolean {
    return !!this.transporter;
  }

  // Send verification email with OTP
  async sendVerificationEmail(to: string, otp: string): Promise<void> {
    if (!this.transporter) {
      logger.warn('Email service not configured. Verification email not sent.');
      return;
    }

    try {
      const emailOptions: EmailOptions = {
        to,
        subject: 'Verify Your Email Address',
        template: 'otp',
        context: {
          otp,
          title: 'Verify Your Email',
          message: 'Please use the following OTP to verify your email address:', 
          note: 'This OTP is valid for 10 minutes.'
        }
      };

      await this.sendEmail(emailOptions);
      logger.info(`Verification email sent to ${to}`);
    } catch (error) {
      logger.error(`Failed to send verification email to ${to}:`, error);
      throw error;
    }
  }

  private async verifyConnection(): Promise<void> {
    if (!this.transporter) return;
    
    try {
      await this.transporter.verify();
      logger.info('Email server is ready to take messages');
    } catch (error) {
      logger.warn('Email server is not available. Email functionality will be limited.');
      if (process.env.NODE_ENV === 'production') {
        logger.error('Failed to connect to email server in production:', error);
      }
    }
  }

  private async loadTemplate(templateName: string, context: any): Promise<string> {
    try {
      const templatePath = path.join(this.templatesDir, `${templateName}.hbs`);
      const templateContent = await fs.readFile(templatePath, 'utf-8');
      const template = handlebars.compile(templateContent);
      return template(context);
    } catch (error) {
      logger.error(`Error loading email template ${templateName}:`, error);
      throw new Error('Failed to load email template');
    }
  }

  public async sendEmail(options: EmailOptions): Promise<void> {
    if (!this.transporter) {
      logger.warn('Email functionality is disabled. Cannot send email to:', options.to);
      return;
    }

    const { to, subject, template, context } = options;

    try {
      // Load email template
      const html = await this.loadTemplate(template, context);

      // Setup email data
      const mailOptions = {
        from: process.env.EMAIL_FROM || 'Xeno Shopify Insights <noreply@xeno.com>',
        to,
        subject,
        html,
      };

      // Send email
      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent: ${info.messageId}`);
    } catch (error) {
      logger.error('Error sending email:', error);
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Failed to send email');
      }
      // In development, just log the error but don't fail
      logger.warn('Email sending failed but continuing in development mode');
    }
  }
}

// Create and export a singleton instance
const emailService = new EmailService();

export default emailService;
