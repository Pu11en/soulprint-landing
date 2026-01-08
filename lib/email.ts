import nodemailer from 'nodemailer';

export const sendConfirmationEmail = async (email: string, name: string) => {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: "OAuth2",
        user: process.env.GMAIL_USER,
        clientId: process.env.GMAIL_CLIENT_ID,
        clientSecret: process.env.GMAIL_CLIENT_SECRET,
        refreshToken: process.env.GMAIL_REFRESH_TOKEN
      }
    });


    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: email,
      subject: "Welcome to the SoulPrint Exclusive Waitlist",
      html: `
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
          <h2 style="color: #2c3e50; border-bottom: 2px solid #eaeaea; padding-bottom: 10px;">Entry Request Received</h2>
          
          <p>Dear ${name},</p>
          
          <p>We have successfully received your request to enter the SoulPrint system. Your secure credentials are being processed.</p>
          
          <p><strong>Next Steps</strong></p>
          
          <p>If you requested immediate entry, you may proceed to the dashboard. If your account requires additional manual verification, you will receive a follow-up notification shortly.</p>
          
          <p>Please remember that this is a closed system. The Non-Disclosure conditions you agreed to are active immediately upon entry.</p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eaeaea; font-size: 12px; color: #888;">
            <p>Welcome to the circle,<br/>The SoulPrint Team</p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Confirmation email sent to ${email}`);
    return true;
  } catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
};
