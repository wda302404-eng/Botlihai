const { Telegraf } = require('telegraf');
const fs = require('fs');
const path = require('path');

// 从环境变量获取配置
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const LOG_FILE = path.join(__dirname, 'private_logs.json');

if (!BOT_TOKEN) {
    console.error('错误: 环境变量 BOT_TOKEN 未设置。');
    process.exit(1);
}
if (!ADMIN_ID) {
    console.error('错误: 环境变量 ADMIN_ID 未设置。');
    process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// 记录消息函数
function logMessage(userId, username, text) {
    const logEntry = {
        user_id: userId,
        username: username,
        text: text,
        time: new Date().toISOString()
    };

    let data = [];
    if (fs.existsSync(LOG_FILE)) {
        try {
            const fileContent = fs.readFileSync(LOG_FILE, 'utf-8');
            data = JSON.parse(fileContent);
        } catch (err) {
            data = [];
        }
    }

    data.push(logEntry);

    fs.writeFileSync(LOG_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// 监听所有消息
bot.on('message', async (ctx) => {
    // 只处理私聊消息
    if (ctx.chat.type !== 'private') return;

    const from = ctx.from;
    const message = ctx.message;

    // 记录消息
    logMessage(from.id, from.username || 'unknown', message.text || '[Non-text message]');

    console.log(`收到来自 ${from.id} 的消息: ${message.text}`);

    // 无痕转发给管理员 (使用 copyMessage)
    try {
        await ctx.telegram.copyMessage(ADMIN_ID, ctx.chat.id, message.message_id);
    } catch (err) {
        console.error('转发消息失败:', err);
    }
});

// 启动机器人
bot.launch().then(() => {
    console.log('机器人已启动...');
});

// 优雅停止
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
