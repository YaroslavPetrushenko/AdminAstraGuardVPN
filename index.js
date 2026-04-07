require("dotenv").config();

const { Telegraf, Markup } = require("telegraf");
const crypto = require("crypto");

const { ADMIN_BOT_TOKEN, ADMIN_IDS, WEBHOOK_URL, PORT } = require("./config");
const { initSchema, pool } = require("./db");

const {
    getTicketsByStatus,
    getTicket,
    getTicketMessages,
    assignTicket,
    freeTicket,
    closeTicket,
    addAdminMessage,
    getNewTicketsForNotify,
    markTicketNotified,
} = require("./tickets");

const {
    getAllPromocodes,
    createPromocode,
    deletePromocode,
} = require("./promocodes");

const express = require("express");
const app = express();

// Telegram шлёт JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Инициализация бота
const bot = new Telegraf(ADMIN_BOT_TOKEN, { handlerTimeout: 0 });

// состояние мини-чата: adminId -> ticketId
const replyState = new Map();

// ===============================
// Вспомогательные
// ===============================
function isAdmin(id) {
    return ADMIN_IDS.includes(Number(id));
}

function formatUserLabel(row) {
    const parts = [];
    if (row.username) parts.push("@" + row.username);
    if (row.first_name) parts.push(row.first_name);
    if (row.last_name) parts.push(row.last_name);
    if (!parts.length) parts.push(String(row.user_id));
    return parts.join(" ");
}

function formatTicketListItem(t) {
    const userLabel = formatUserLabel(t);
    return (
        `📨 ${t.ticket_id}\n` +
        `Статус: ${t.status}\n` +
        `Пользователь: ${userLabel}\n` +
        `Сообщений: ${t.messages_count}\n`
    );
}

function formatMessages(ticketId, messages) {
    let text = `📨 Сообщения тикета ${ticketId}\n\n`;
    for (const m of messages) {
        const time = new Date(m.created_at).toLocaleTimeString("ru-RU", {
            hour: "2-digit",
            minute: "2-digit",
        });

        if (m.sender === "user") {
            text += `👤 Пользователь (${time})\n${m.text}\n\n`;
        } else {
            const adminInfo = m.admin_id ? `Админ ${m.admin_id}` : "Админ";
            text += `🛠 ${adminInfo} (${time})\n${m.text}\n\n`;
        }
    }
    return text;
}

function ticketKeyboard(ticketId, isOwner) {
    if (!isOwner) {
        return Markup.inlineKeyboard([
            [Markup.button.callback("🔄 Обновить", `ticket_refresh_${ticketId}`)],
        ]);
    }

    return Markup.inlineKeyboard([
        [
            Markup.button.callback("✉️ Ответить", `ticket_reply_${ticketId}`),
            Markup.button.callback("🔓 Освободить", `ticket_free_${ticketId}`),
            Markup.button.callback("✅ Закрыть", `ticket_close_${ticketId}`),
        ],
        [Markup.button.callback("🔄 Обновить", `ticket_refresh_${ticketId}`)],
    ]);
}

// ===============================
// /start
// ===============================
bot.start((ctx) => {
    if (!isAdmin(ctx.from.id)) return;

    ctx.reply(
        "Админ‑панель AstraGuardVPN.\n\n" +
        "Команды:\n" +
        "/open — открытые тикеты\n" +
        "/closed — закрытые тикеты\n" +
        "/me — мои тикеты\n" +
        "/ticket T-XXXX — открыть тикет\n" +
        "/promos — все промокоды\n" +
        "/addpromo CODE DISCOUNT USES — создать промо\n" +
        "/delpromo CODE — удалить промо\n" +
        "/vpnkey [дни] [устройства] [трафик] — создать VPN‑ключ\n"
    );
});

// ===============================
// Список тикетов
// ===============================
bot.command("open", async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;

    const tickets = await getTicketsByStatus("open", 20);
    if (!tickets.length) return ctx.reply("Открытых тикетов нет.");

    let text = "📂 Открытые тикеты:\n\n";
    for (const t of tickets) text += formatTicketListItem(t) + "\n";

    ctx.reply(text);
});

bot.command("closed", async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;

    const tickets = await getTicketsByStatus("closed", 20);
    if (!tickets.length) return ctx.reply("Закрытых тикетов нет.");

    let text = "📂 Закрытые тикеты:\n\n";
    for (const t of tickets) text += formatTicketListItem(t) + "\n";

    ctx.reply(text);
});

bot.command("me", async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;

    const adminId = ctx.from.id;
    const tickets = await getTicketsByStatus("open", 50);
    const mine = tickets.filter((t) => String(t.assigned_admin) === String(adminId));

    if (!mine.length) return ctx.reply("У тебя нет тикетов в работе.");

    let text = "📂 Твои тикеты:\n\n";
    for (const t of mine) text += formatTicketListItem(t) + "\n";

    ctx.reply(text);
});

// ===============================
// Открытие тикета
// ===============================
bot.command("ticket", async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;

    const parts = ctx.message.text.trim().split(/\s+/);
    if (parts.length < 2) return ctx.reply("Использование: /ticket T-1234");

    await showTicket(ctx, parts[1]);
});

async function showTicket(ctx, ticketId) {
    const adminId = ctx.from.id;

    const ticket = await getTicket(ticketId);
    if (!ticket) return ctx.reply(`Тикет ${ticketId} не найден.`);

    const messages = await getTicketMessages(ticketId);
    const text = formatMessages(ticketId, messages);

    let ownerLabel;
    if (ticket.assigned_admin) {
        if (String(ticket.assigned_admin) === String(adminId)) {
            ownerLabel = "Этот тикет сейчас ведёшь ты.";
        } else {
            ownerLabel =
                `⚠️ Тикет уже ведёт админ: ${ticket.assigned_admin}\n` +
                `Вы не можете отвечать.`;
        }
    } else {
        ownerLabel = "Тикет свободен. Нажми «Ответить», чтобы взять его в работу.";
    }

    const isOwner =
        ticket.assigned_admin && String(ticket.assigned_admin) === String(adminId);

    await ctx.reply(text + "\n" + ownerLabel, ticketKeyboard(ticketId, isOwner));
}

// ===============================
// Inline кнопки
// ===============================
bot.action(/ticket_refresh_(.+)/, async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    await ctx.answerCbQuery();
    await showTicket(ctx, ctx.match[1]);
});

bot.action(/ticket_reply_(.+)/, async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;

    const adminId = ctx.from.id;
    const ticketId = ctx.match[1];

    const ticket = await getTicket(ticketId);
    if (!ticket) return ctx.answerCbQuery("Тикет не найден.");

    if (ticket.assigned_admin && String(ticket.assigned_admin) !== String(adminId)) {
        await ctx.answerCbQuery("Тикет занят другим админом.");
        return ctx.reply(
            `⚠️ Тикет уже ведёт админ: ${ticket.assigned_admin}\nВы не можете отвечать.`
        );
    }

    await assignTicket(ticketId, adminId);
    replyState.set(adminId, ticketId);

    await ctx.answerCbQuery();
    await ctx.reply(`Вы отвечаете в тикет ${ticketId}.\nНапишите сообщение.`);
});

bot.action(/ticket_free_(.+)/, async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;

    const adminId = ctx.from.id;
    const ticketId = ctx.match[1];

    const freed = await freeTicket(ticketId, adminId);
    if (!freed) return ctx.answerCbQuery("Тикет не принадлежит тебе.");

    replyState.delete(adminId);

    await ctx.answerCbQuery("Тикет освобождён.");
    await ctx.reply(`Тикет ${ticketId} освобождён.`);

    for (const id of ADMIN_IDS) {
        bot.telegram.sendMessage(id, `🔔 Тикет ${ticketId} снова свободен.`).catch(() => {});
    }
});

bot.action(/ticket_close_(.+)/, async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;

    const adminId = ctx.from.id;
    const ticketId = ctx.match[1];

    await closeTicket(ticketId);
    replyState.delete(adminId);

    await ctx.answerCbQuery("Тикет закрыт.");
    await ctx.reply(`Тикет ${ticketId} закрыт.`);

    for (const id of ADMIN_IDS) {
        bot.telegram.sendMessage(id, `✅ Тикет ${ticketId} закрыт.`).catch(() => {});
    }
});

// ===============================
// Мини‑чат
// ===============================
bot.on("text", async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;

    const adminId = ctx.from.id;
    const ticketId = replyState.get(adminId);
    if (!ticketId) return;

    const text = ctx.message.text.trim();
    if (!text) return;

    const ticket = await getTicket(ticketId);
    if (!ticket) {
        replyState.delete(adminId);
        return ctx.reply(`Тикет ${ticketId} не найден.`);
    }

    await addAdminMessage(ticketId, adminId, text);
    await ctx.reply(`Сообщение отправлено в тикет ${ticketId}.`);
});

// ===============================
// Промокоды
// ===============================
bot.command("promos", async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;

    const promos = await getAllPromocodes();
    if (!promos.length) return ctx.reply("Промокодов нет.");

    let text = "🎟 Все промокоды:\n\n";
    for (const p of promos) {
        text +=
            `Код: ${p.code}\n` +
            `Скидка: ${p.discount}%\n` +
            `Осталось использований: ${p.uses_left}\n\n`;
    }

    ctx.reply(text);
});

bot.command("addpromo", async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;

    const args = ctx.message.text.trim().split(/\s+/).slice(1);
    if (args.length < 3) {
        return ctx.reply("Использование:\n/addpromo CODE DISCOUNT USES");
    }

    const code = args[0].toUpperCase();
    const discount = Number(args[1]);
    const usesLeft = Number(args[2]);

    const created = await createPromocode(code, discount, usesLeft);
    if (!created) return ctx.reply("Промокод уже существует.");

    ctx.reply(
        `✅ Промокод создан:\nКод: ${created.code}\nСкидка: ${created.discount}%\nИспользований: ${created.uses_left}`
    );
});

bot.command("delpromo", async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;

    const args = ctx.message.text.trim().split(/\s+/).slice(1);
    if (!args.length) return ctx.reply("Использование: /delpromo CODE");

    const code = args[0].toUpperCase();
    const deleted = await deletePromocode(code);
    if (!deleted) return ctx.reply("Такого промокода нет.");

    ctx.reply(`🗑 Промокод ${code} удалён.`);
});

// ===============================
// Уведомления о новых тикетах
// ===============================
async function notifyNewTickets() {
    const tickets = await getNewTicketsForNotify();
    if (!tickets.length) return;

    for (const t of tickets) {
        const userLabel = formatUserLabel(t);
        const msg =
            `🆕 Новый тикет ${t.ticket_id}\n` +
            `Пользователь: ${userLabel}\n\n` +
            `Открой: /ticket ${t.ticket_id}`;

        for (const id of ADMIN_IDS) {
            bot.telegram.sendMessage(id, msg).catch(() => {});
        }

        await markTicketNotified(t.ticket_id);
    }
}

// ===============================
// Запуск
// ===============================
async function start() {
    await initSchema();

    // Webhook
    bot.telegram.setWebhook(WEBHOOK_URL);

    // Webhook endpoint
    app.use(bot.webhookCallback("/webhook"));

    // Health-check
    app.get("/", (req, res) => res.send("OK"));

    // Start server
    app.listen(PORT, () => {
        console.log("Admin bot running via webhook");
    });

    // Background tasks
    setInterval(() => {
        notifyNewTickets().catch((e) =>
            console.log("notifyNewTickets error:", e.message)
        );
    }, 5000);
}

start();
