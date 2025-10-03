import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// 基础CORS配置
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://www.chattoeic.com',
    'https://chattoeic.vercel.app'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Guest-Mode']
}));

app.use(express.json());

// 简单的健康检查
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
});

// 根路径
app.get('/', (req, res) => {
  res.json({
    name: 'ChatTOEIC API',
    version: '2.0.0',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// 启动服务器
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Simple ChatTOEIC API v2.0.0 服务器启动成功`);
  console.log(`📡 服务地址: http://0.0.0.0:${PORT}`);
  console.log(`🏥 健康检查: http://0.0.0.0:${PORT}/api/health`);
  console.log('✅ 服务器监听端口成功');
});

// 错误处理
server.on('error', (error) => {
  console.error('❌ 服务器启动错误:', error);
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('收到SIGTERM信号，开始关闭服务器...');
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('收到SIGINT信号，开始关闭服务器...');
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
});

export default app;