import jwt from 'jsonwebtoken';
export const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    if (!token) {
        return res.status(401).json({
            success: false,
            error: '访问令牌是必需的'
        });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    }
    catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            return res.status(401).json({
                success: false,
                error: '访问令牌已过期'
            });
        }
        else if (error instanceof jwt.JsonWebTokenError) {
            return res.status(403).json({
                success: false,
                error: '无效的访问令牌'
            });
        }
        else {
            return res.status(500).json({
                success: false,
                error: '令牌验证失败'
            });
        }
    }
};
export const optionalAuth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return next();
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
    }
    catch (error) {
        // 可选认证失败时不阻断请求
        console.warn('Optional auth failed:', error);
    }
    next();
};
export const requireAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: '需要认证'
        });
    }
    if (req.user.role !== 'ADMIN') {
        return res.status(403).json({
            success: false,
            error: '需要管理员权限'
        });
    }
    next();
};
