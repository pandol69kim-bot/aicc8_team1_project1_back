import jwt from "jsonwebtoken";

export const requireAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, message: "Authorization 헤더에 토큰이 필요합니다." });
    }

    const token = authHeader.split(" ")[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || 'fallback_secret_key');
        req.user = decoded; // controller에서 req.user.id 등 사용 가능하도록 주입
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                code: 'TOKEN_EXPIRED',
                message: "액세스 토큰이 만료되었습니다."
            });
        }
        return res.status(401).json({ success: false, message: "유효하지 않거나 만료된 토큰입니다." });
    }
};
