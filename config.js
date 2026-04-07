require("dotenv").config();

const ADMIN_BOT_TOKEN = process.env.ADMIN_BOT_TOKEN;
const DATABASE_URL = process.env.DATABASE_URL;

// через запятую: 123,456,789
const ADMIN_IDS = (process.env.ADMIN_IDS || "")
  .split(",")
  .map((x) => x.trim())
  .filter(Boolean)
  .map((x) => Number(x))
  .filter((x) => !Number.isNaN(x));

module.exports = {
  ADMIN_BOT_TOKEN,
  DATABASE_URL,
  ADMIN_IDS,
};
