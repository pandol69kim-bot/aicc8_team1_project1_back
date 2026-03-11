import fs from "fs";
import path from "path";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();
const { Pool } = pg;

async function run() {
    if (!process.env.DATABASE_URL) {
        throw new Error("❌ DATABASE_URL이 없습니다. back/.env를 확인하세요.");
    }

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
    });

    try {
        const sqlPath = path.join(process.cwd(), "database", "table.sql");
        const sql = fs.readFileSync(sqlPath, "utf-8");

        await pool.query(sql);
        console.log("✅ table.sql 실행 완료! (테이블 생성/갱신)");
    } finally {
        await pool.end();
    }
}

run().catch((err) => {
    console.error("❌ DB init failed:", err);
    process.exit(1);
});
