import nodemailer from 'nodemailer';
import logger from './logger';

const {
  EMAIL_USER,
  EMAIL_PASS,
  EMAIL_FROM = 'Xeno Shopify Insights <noreply@xeno.com>',
  NODE_ENV = 'development'
} = process.env;

// Only create transporter if all required env vars are present
const transporter = EMAIL_USER && EMAIL_PASS
  ? nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS
      },
      tls: {
        rejectUnauthorized: NODE_ENV === 'production' // Only verify cert in production
      }
    })
  : null;

// Verify connection configuration
if (transporter) {
  transporter.verify((error) => {
    if (error) {
      logger.warn('Email server is not available. Email functionality will be limited.');
      if (NODE_ENV === 'production') {
        logger.error('Failed to connect to email server in production:', error);
      }
    } else {
      logger.info('Successfully connected to the email server');
    }
  });
} else if (NODE_ENV !== 'test') {
  logger.warn('Email configuration is incomplete. Email functionality will be disabled.');
}

// Function to send test email with error handling
export const sendTestEmail = async (to: string, name: string) => {
  if (!transporter) {
    logger.warn('Email functionality is disabled. Cannot send test email to:', to);
    return { success: false, message: 'Email functionality is disabled' };
  }

  try {
    const mailOptions = {
      from: EMAIL_FROM,
      to,
      subject: 'Test Email from Xeno Shopify Insights',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #333;">Hello ${name},</h2>
          <p>This is a test email from Xeno Shopify Insights.</p>
          <p>If you're receiving this, your email configuration is working correctly!</p>
          <p>Best regards,<br>The Xeno Team</p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info(`Test email sent: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error('Error sending test email:', error);
    if (process.env.NODE_ENV === 'production') {
      throw error;
    }
    return { success: false, message: 'Failed to send test email' };
  }
};

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export const sendEmail = async (options: SendEmailOptions) => {
  if (!transporter) {
    logger.warn('Email functionality is disabled. Cannot send email to:', options.to);
    return null;
  }

  try {
    const mailOptions = {
      from: EMAIL_FROM,
      ...options,
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info(`Email sent: ${info.messageId}`);
    return info;
  } catch (error) {
    logger.error('Error sending email:', error);
    if (process.env.NODE_ENV === 'production') {
      throw error;
    }
    return null;
  }
};

// Email templates
export const emailTemplates = {
  welcome: (name: string) => ({
    subject: 'Welcome to Xeno Shopify Insights!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <h2 style="color: #333;">Welcome to Xeno Shopify Insights, ${name}!</h2>
        <p>Thank you for joining our platform. We're excited to have you on board.</p>
        <p>Get started by exploring your dashboard and connecting your Shopify store.</p>
        <p>If you have any questions, feel free to reply to this email.</p>
        <p>Best regards,<br>The Xeno Team</p>
      </div>
    `,
  }),
  passwordReset: (name: string, resetLink: string) => ({
    subject: 'Password Reset Request',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <h2 style="color: #333;">Hello ${name},</h2>
        <p>We received a request to reset your password. Click the button below to set a new password:</p>
        <div style="text-align: center; margin: 25px 0;">
          <a href="${resetLink}" style="background-color: #4CAF50; color: white; padding: 12px 24px; text-align: center; text-decoration: none; display: inline-block; border-radius: 4px;">Reset Password</a>
        </div>
        <p>If you didn't request this, you can safely ignore this email.</p>
        <p>Best regards,<br>The Xeno Team</p>
      </div>
    `,
  }),
};
