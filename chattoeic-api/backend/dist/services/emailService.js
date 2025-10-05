import nodemailer from 'nodemailer';
import logger from '../utils/logger.js';
class EmailService {
    transporter = null;
    constructor() {
        try {
            this.transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST || 'smtp.gmail.com',
                port: parseInt(process.env.SMTP_PORT || '587'),
                secure: false, // true for 465, false for other ports
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS,
                },
            });
        }
        catch (error) {
            logger.warn('Email service initialization failed - SMTP not configured', { error: error.message });
            this.transporter = null;
        }
    }
    async sendEmail(options) {
        if (!this.transporter) {
            throw new Error('SMTP not configured - email service unavailable');
        }
        try {
            const info = await this.transporter.sendMail({
                from: `"ChatTOEIC" <${process.env.SMTP_USER}>`,
                to: options.to,
                subject: options.subject,
                text: options.text,
                html: options.html,
            });
            logger.info('Email sent successfully', {
                messageId: info.messageId,
                to: options.to,
                subject: options.subject
            });
        }
        catch (error) {
            logger.error('Failed to send email', {
                error: error.message,
                to: options.to,
                subject: options.subject
            });
            throw new Error('邮件发送失败');
        }
    }
    async sendVerificationCode(email, code, type = 'register') {
        const subject = type === 'register' ? 'ChatTOEIC 注册验证码' : 'ChatTOEIC 密码重置验证码';
        const purpose = type === 'register' ? '完成注册' : '重置密码';
        const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${subject}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: #2563eb;
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 8px 8px 0 0;
          }
          .content {
            background: #f8fafc;
            padding: 30px;
            border-radius: 0 0 8px 8px;
          }
          .code {
            background: #2563eb;
            color: white;
            font-size: 32px;
            font-weight: bold;
            letter-spacing: 8px;
            text-align: center;
            padding: 20px;
            margin: 20px 0;
            border-radius: 8px;
          }
          .warning {
            background: #fef2f2;
            border-left: 4px solid #ef4444;
            padding: 12px 16px;
            margin: 20px 0;
          }
          .footer {
            text-align: center;
            margin-top: 20px;
            color: #6b7280;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>ChatTOEIC</h1>
          <p>${purpose}验证码</p>
        </div>
        <div class="content">
          <p>您好！</p>
          <p>您正在使用此邮箱${purpose}ChatTOEIC账号，请使用以下验证码${purpose}：</p>
          
          <div class="code">${code}</div>
          
          <div class="warning">
            <strong>安全提醒：</strong>
            <ul>
              <li>此验证码5分钟内有效</li>
              <li>如果不是您本人操作，请忽略此邮件</li>
              <li>请勿将验证码告诉他人</li>
            </ul>
          </div>
          
          <p>感谢您使用ChatTOEIC！</p>
        </div>
        <div class="footer">
          <p>此邮件由系统自动发送，请勿直接回复</p>
          <p>ChatTOEIC Team</p>
        </div>
      </body>
      </html>
    `;
        const text = `
      ChatTOEIC ${purpose}验证码
      
      您好！
      
      您正在使用此邮箱${purpose}ChatTOEIC账号，请使用以下验证码${purpose}：
      
      验证码：${code}
      
      安全提醒：
      - 此验证码5分钟内有效
      - 如果不是您本人操作，请忽略此邮件
      - 请勿将验证码告诉他人
      
      感谢您使用ChatTOEIC！
      
      ChatTOEIC Team
    `;
        await this.sendEmail({
            to: email,
            subject,
            html,
            text
        });
    }
    async testConnection() {
        if (!this.transporter) {
            logger.warn('Email service not configured - cannot test connection');
            return false;
        }
        try {
            await this.transporter.verify();
            logger.info('Email service connection verified successfully');
            return true;
        }
        catch (error) {
            logger.error('Email service connection failed', { error: error.message });
            return false;
        }
    }
}
export const emailService = new EmailService();
