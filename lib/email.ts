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
          <h2 style="color: #2c3e50; border-bottom: 2px solid #eaeaea; padding-bottom: 10px;">Welcome to SoulPrint</h2>
          
          <p>Dear ${name},</p>
          
          <p>Thank you for securing your spot on the SoulPrint waitlist. We are honored to have you join our community of early adopters.</p>
          
          <p><strong>What happens next?</strong></p>
          
          <p>You have been entered into our priority pipeline. Our team is currently finalizing the next release of the SoulPrint Engine, which introduces enhanced neuro-mapping capabilities and deeper fluid visualizers.</p>
          
          <p>We are rolling out access in waves to ensure stability and a premium experience. When your cohort is activated, you will receive a personal invitation with your secure access credentials.</p>
          
          <p>In the meantime, stay tuned for updates. We are building something truly unique, and we can't wait for you to experience it.</p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eaeaea; font-size: 12px; color: #888;">
            <p>Best regards,<br/>The SoulPrint Team</p>
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
