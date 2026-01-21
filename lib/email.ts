import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    type: "OAuth2",
    user: process.env.GMAIL_USER,
    clientId: process.env.GMAIL_CLIENT_ID,
    clientSecret: process.env.GMAIL_CLIENT_SECRET,
    refreshToken: process.env.GMAIL_REFRESH_TOKEN,
  },
});

export async function sendConfirmationEmail(email: string, name: string) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET || !process.env.GMAIL_REFRESH_TOKEN) {
    return;
  }

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to SoulPrint</title>
</head>
<body style="margin: 0; padding: 0; background-color: #050505; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #ffffff;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #050505;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #0a0a0a; border: 1px solid #1a1a1a; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
          
          <!-- Header / Logo -->
          <tr>
            <td align="center" style="padding: 60px 40px 40px 40px;">
              <!-- Placeholder for logo - replace with your hosted logo if available -->
               <h1 style="color: #EA580C; margin: 0; font-size: 28px; letter-spacing: -1px;">SoulPrint</h1>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 0 60px;">
              <h1 style="font-size: 32px; font-weight: 800; text-align: center; margin: 0 0 24px 0; color: #ffffff; letter-spacing: -1px; text-transform: uppercase;">
                Identity <span style="color: #EA580C;">Secured</span>
              </h1>
              
              <p style="font-size: 18px; line-height: 1.6; color: #a1a1a1; text-align: center; margin-bottom: 40px;">
                Hello ${name}, <br>
                You are officially in. Your spot on the SoulPrint waitlist is confirmed and your identity mapping is next in the queue.
              </p>

              <!-- Highlight Box -->
              <div style="background: linear-gradient(135deg, rgba(234, 88, 12, 0.1) 0%, rgba(151, 71, 255, 0.1) 100%); border: 1px solid rgba(234, 88, 12, 0.3); border-radius: 16px; padding: 32px; text-align: center; margin-bottom: 40px;">
                <p style="font-size: 16px; color: #ffffff; font-weight: 600; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 2px;">ACCESS GRANTED</p>
                <p style="font-size: 14px; color: #EA580C; margin: 0; font-family: 'Courier New', monospace;">${new Date().toISOString().split('T')[0].replace(/-/g, '_')}_SEC_CONFIRMED</p>
              </div>

              <!-- Features / What's Next -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 40px;">
                <tr>
                  <td style="padding-bottom: 24px;">
                    <table width="100%" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td width="40" valign="top"><span style="color: #EA580C; font-size: 20px;">✦</span></td>
                        <td style="font-size: 16px; color: #d1d1d1; line-height: 1.5;">
                          <strong>Persistent Memory</strong><br>
                          Your AI will remember you across sessions, models, and boundaries.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom: 24px;">
                    <table width="100%" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td width="40" valign="top"><span style="color: #9747ff; font-size: 20px;">✦</span></td>
                        <td style="font-size: 16px; color: #d1d1d1; line-height: 1.5;">
                          <strong>Identity Mapping</strong><br>
                          Turning your digital footprint into a persistent, sovereign identity layer.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer / ArcheForge -->
          <tr>
            <td align="center" style="padding: 40px 60px 60px 60px; background-color: #080808; border-top: 1px solid #151515;">
              <p style="font-size: 14px; color: #555555; margin: 0 0 16px 0;">
                Built on the SoulPrint Engine by <span style="color: #ffffff; font-weight: 600;">ArcheForge</span>
              </p>
              <div style="color: #333333; font-size: 12px;">
                &copy; 2025 ArcheForge. Private Infrastructure. <br>
                Secure Communication Protocol 1.0
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

  try {
    await transporter.sendMail({
      from: `"SoulPrint Waitlist" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: "Entry confirmed. Welcome to SoulPrint.",
      html: htmlContent,
    });
  } catch (error) {
    console.error("Error sending confirmation email:", error);
  }
}
