#!/usr/bin/env node

// 极简测试服务器 - 确保Railway能运行基本Node.js应用
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3001;

console.log('🚀 启动极简测试服务器...');
console.log('端口:', PORT);
console.log('NODE_ENV:', process.env.NODE_ENV || '未设置');

// 基本中间件
app.use(cors());
app.use(express.json());

// 根路径
app.get('/', (req, res) => {
  res.json({
    message: 'ChatTOEIC 极简测试服务器运行中',
    status: 'running',
    timestamp: new Date().toISOString(),
    port: PORT,
    env: process.env.NODE_ENV || 'development'
  });
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', api: 'working', timestamp: new Date().toISOString() });
});

// Google登录测试端点
app.get('/api/auth/google', (req, res) => {
  res.json({
    message: 'Google OAuth端点可访问',
    note: '这是测试响应，不是真实OAuth',
    timestamp: new Date().toISOString()
  });
});

// 捕获所有其他路径
app.use('*', (req, res) => {
  res.json({
    message: '极简服务器捕获路径',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ 极简测试服务器运行在端口 ${PORT}`);
  console.log(`🌐 测试URL: http://localhost:${PORT}`);
  console.log(`🏥 健康检查: http://localhost:${PORT}/health`);
  console.log(`🔐 Google测试: http://localhost:${PORT}/api/auth/google`);
});