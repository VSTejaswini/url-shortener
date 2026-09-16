require("dotenv").config();
const express = require("express");
const cors = require("cors");
const pool = require("./database");
const { createClient } = require("redis");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379"
});

redisClient.on("error", (error) => {
  console.error("Redis error:", error.message);
});

app.use(cors());
app.use(express.json());

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

function encodeBase62(number) {
  let code = "";
  while (number > 0) {
    code = BASE62[number % 62] + code;
    number = Math.floor(number / 62);
  }
  return code || "0";
}

app.get("/", (req, res) => {
  res.json({
    message: "URL Shortener API is running"
  });
});

app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    await redisClient.ping();
    res.json({ server: "OK", database: "OK", redis: "OK" });
  } catch (error) {
    res.status(500).json({ server: "OK", database: "ERROR", redis: "ERROR" });
  }
});

app.post("/shorten", async (req, res) => {
  try {
    const { originalUrl } = req.body;

    if (!originalUrl) {
      return res.status(400).json({ error: "URL is required" });
    }

    try {
      new URL(originalUrl);
    } catch {
      return res.status(400).json({ error: "Invalid URL" });
    }

    const idResult = await pool.query("SELECT nextval('url_id_seq') AS id");
    const id = Number(idResult.rows[0].id);
    const shortCode = encodeBase62(id);

    await pool.query(
      `INSERT INTO urls (id, short_code, original_url) VALUES ($1, $2, $3)`,
      [id, shortCode, originalUrl]
    );

    await redisClient.set(shortCode, originalUrl);

    res.json({
      originalUrl,
      shortCode,
      shortUrl: `${BASE_URL}/${shortCode}`
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/:shortCode", async (req, res) => {
  try {
    const { shortCode } = req.params;
    const cachedUrl = await redisClient.get(shortCode);

    if (cachedUrl) {
      console.log("Redis cache HIT");
      return res.redirect(cachedUrl);
    }

    console.log("Redis cache MISS");

    const result = await pool.query(
      `SELECT original_url FROM urls WHERE short_code = $1`,
      [shortCode]
    );

    if (result.rows.length === 0) {
      return res.status(404).send("Short URL not found");
    }

    const originalUrl = result.rows[0].original_url;
    await redisClient.set(shortCode, originalUrl);
    res.redirect(originalUrl);
  } catch (error) {
    console.error(error);
    res.status(500).send("Something went wrong");
  }
});

async function startServer() {
  try {
    await redisClient.connect();
    console.log("Redis connected!");

    app.listen(PORT, () => {
      console.log(`Server running on ${BASE_URL}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
}

startServer();
