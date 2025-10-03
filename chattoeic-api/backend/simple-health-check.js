#!/usr/bin/env node

// 简单的健康检查脚本
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3001;

// 简单的健康检查端点
app.get('/', (req, res) => {
  res.json({
    name: 'ChatTOEIC API - Simple Health Check',
    version: '3.1.0-RAILWAY-STARTCOMMAND-FIX',
    status: 'running',
    timestamp: new Date().toISOString(),
    port: PORT,
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: '3.1.0-RAILWAY-STARTCOMMAND-FIX',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Simple Health Check Server running on port ${PORT}`);
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`🏥 Health: http://localhost:${PORT}/health`);
});