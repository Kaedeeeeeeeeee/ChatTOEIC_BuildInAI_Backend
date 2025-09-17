#!/usr/bin/env node

// 超级简单的测试服务器 - 不依赖任何数据库或复杂配置
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3001;

console.log('🚀 Starting simple test server...');
console.log('Port:', PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);

app.use(express.json());

// 简单的根路径
app.get('/', (req, res) => {
  res.json({
    message: 'ChatTOEIC Simple Test Server',
    status: 'running',
    timestamp: new Date().toISOString(),
    port: PORT,
    env: process.env.NODE_ENV
  });
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    message: 'Simple test API working'
  });
});

// 捕获所有路径
app.use('*', (req, res) => {
  res.json({
    message: 'Simple test server catch-all',
    path: req.originalUrl,
    method: req.method
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Simple test server running on port ${PORT}`);
  console.log(`🌐 Test URL: http://localhost:${PORT}`);
});