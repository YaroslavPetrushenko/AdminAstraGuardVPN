require("dotenv").config();

module.exports = {
  ADMIN_BOT_TOKEN: process.env.ADMIN_BOT_TOKEN,
  WEBHOOK_URL_ADMIN: process.env.WEBHOOK_URL_ADMIN,
  PORT: process.env.PORT || 3000,

  DATABASE_URL: process.env.DATABASE_URL,

  ADMIN_IDS: process.env.ADMIN_IDS
    ? process.env.ADMIN_IDS.split(",").map((id) => Number(id.trim()))
    : [],
};
