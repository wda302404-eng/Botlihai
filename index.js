const { Telegraf } = require('telegraf');
const fs = require('fs');
const path = require('path');

// 从环境变量获取配置
const BOT_TOKENS_STR = process.env.BOT_TOKEN; // 兼容之前的变量名，但现在支持逗号分隔
const ADMIN_ID = process.env.ADMIN_ID;
const LOG_FILE = path.join(__dirname, 'private_logs.json');

if (!BOT_TOKENS_STR || !ADMIN_ID) {
    console.error('错误: 请确保设置了 BOT_TOKEN (支持逗号分隔多个) 和 ADMIN_ID');
    process.exit(1);
}

const tokens = BOT_TOKENS_STR.split(',').map(t => t.trim()).filter(t => t.length > 0);
let isMonitoring = true;

// 记录消息函数
function logMessage(botName, userId, username, text) {
    if (!isMonitoring) return;
    
    const logEntry = {
        bot: botName,
        user_id: userId,
        username: username,
        text: text,
        time: new Date().toISOString()
    };

    let data = [];
    if (fs.existsSync(LOG_FILE)) {
        try {
            data = JSON.parse(fs.readFileSync(LOG_FILE, 'utf-8'));
        } catch (err) {
            data = [];
        }
    }
    data.push(logEntry);
    fs.writeFileSync(LOG_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// 初始化所有机器人实例
tokens.forEach((token, index) => {
    const bot = new Telegraf(token);
    let botInfo = {};

    bot.telegram.getMe().then(info => {
        botInfo = info;
        console.log(`机器人 [${index + 1}] @${info.username} 已就绪并开始监测...`);
    }).catch(err => {
        console.error(`机器人 [${index + 1}] 启动失败:`, err.message);
    });

    // 监听指令 (仅管理员可用)
    bot.command('monitor_on', async (ctx) => {
        if (ctx.from.id.toString() !== ADMIN_ID.toString()) return;
        isMonitoring = true;
        await ctx.reply('✅ 监测已开启。所有私聊信息将被静默记录并转发。');
    });

    bot.command('monitor_off', async (ctx) => {
        if (ctx.from.id.toString() !== ADMIN_ID.toString()) return;
        isMonitoring = false;
        await ctx.reply('⚠️ 监测已暂停。');
    });

    bot.command('logs', async (ctx) => {
        if (ctx.from.id.toString() !== ADMIN_ID.toString()) return;
        if (!fs.existsSync(LOG_FILE)) {
            return await ctx.reply('📭 目前没有任何日志记录。');
        }
        await ctx.replyWithDocument({ source: LOG_FILE, filename: 'private_logs.json' });
    });

    bot.command('clean', async (ctx) => {
        if (ctx.from.id.toString() !== ADMIN_ID.toString()) return;
        if (fs.existsSync(LOG_FILE)) {
            fs.unlinkSync(LOG_FILE);
        }
        await ctx.reply('🔥 痕迹已销毁。所有本地记录已永久删除。');
    });

    // 处理私聊消息
    bot.on('message', async (ctx) => {
        const from = ctx.from;
        const message = ctx.message;
        const isChatPrivate = ctx.chat.type === 'private';

        // 如果是管理员发的消息，且不是指令，则忽略（避免循环转发）
        if (from.id.toString() === ADMIN_ID.toString()) {
            return;
        }

        // 仅处理私聊
        if (!isChatPrivate) return;

        // 记录日志
        logMessage(`@${botInfo.username || 'Bot'+index}`, from.id, from.username || 'unknown', message.text || '[Non-text]');

        // 无痕转发给管理员
        try {
            await ctx.telegram.copyMessage(ADMIN_ID, ctx.chat.id, message.message_id);
            console.log(`[转发成功] 来自 ${from.id} 的消息已通过 @${botInfo.username} 转发。`);
        } catch (err) {
            console.error('[转发失败]:', err.message);
        }
    });

    bot.launch();
});

console.log(`总计 ${tokens.length} 个机器人监测实例正在初始化...`);

// 优雅停止
process.once('SIGINT', () => process.exit(0));
process.once('SIGTERM', () => process.exit(0));
