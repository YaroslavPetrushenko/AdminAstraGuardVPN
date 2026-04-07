require("dotenv").config();

const { Telegraf } = require("telegraf");

const registerAdminCommands = require("../ASTRAGUARD_VPN/admin");
const registerBroadcast = require("../ASTRAGUARD_VPN/broadcast");

const bot = new Telegraf(process.env.ADMIN_BOT_TOKEN);

// /start
bot.start((ctx) => {
  ctx.reply(
    "Добро пожаловать в админ‑панель AstraGuardVPN.\n\n" +
    "Команды:\n" +
    "/stats\n" +
    "/sendto USER_ID текст\n" +
    "/reply USER_ID текст\n" +
    "/promos\n" +
    "/addpromoAstraGuardVPN_bot CODE СКИДКА КОЛ-ВО\n" +
    "/delpromoAstraGuardVPN_bot CODE\n" +
    "/broadcast ТЕКСТ\n" +
    "Фото + подпись: /photocast ТЕКСТ"
  );
});

// подключаем команды
registerAdminCommands(bot);
registerBroadcast(bot);

// запуск
bot.launch().then(() => {
  console.log("Admin bot started");
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
