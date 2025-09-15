import { Request, Response } from 'express';
import { sendTestEmail } from '../utils/email';

export const testEmail = async (req: Request, res: Response) => {
  try {
    const { email = 'test@example.com', name = 'Test User' } = req.body;

    // Send test email
    const result = await sendTestEmail(email, name);

    res.status(200).json({
      success: true,
      message: 'Test email sent successfully',
      data: result
    });
  } catch (error) {
    console.error('Error sending test email:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test email',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
