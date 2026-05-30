import nodemailer from 'nodemailer'

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
  })
}

export async function sendTempPasswordEmail(to: string, tempPassword: string) {
  const transporter = createTransport()

  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@kuji.app'

  await transporter.sendMail({
    from: `쿠지 시스템 <${from}>`,
    to,
    subject: '[쿠지 시스템] 임시 비밀번호 안내',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #4f46e5;">쿠지 시스템 임시 비밀번호 안내</h2>
        <p>아래 임시 비밀번호로 로그인 후 비밀번호를 변경해 주세요.</p>
        <div style="
          background: #f3f4f6;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 16px 24px;
          margin: 24px 0;
          font-size: 24px;
          font-weight: bold;
          letter-spacing: 4px;
          text-align: center;
          color: #111827;
        ">
          ${tempPassword}
        </div>
        <p style="color: #6b7280; font-size: 13px;">
          ※ 보안을 위해 로그인 즉시 비밀번호를 변경해 주세요.<br>
          ※ 본 메일은 발신 전용입니다.
        </p>
      </div>
    `,
  })
}
