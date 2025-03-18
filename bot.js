const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

const app = express();
const PORT = 3000;

const token = '1965280785:AAFjXY8Mw2Sp9WsoX-OspY_Th9cXWjdRlnc';
const targetChatId = -4556541704;
const bot = new TelegramBot(token, { polling: true });

app.use(express.json());

app.get('/send', async (req, res) => {
    try {
        const { creo, vertical, contact, login, sub } = req.query;
        if (!creo || !vertical || !contact || !login || !sub) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        const parsedLines = [
            `Creo: ${creo}`,
            `Vertical: ${vertical}`,
            `Method: ${contact}`,
            `Login: ${login}`,
            `ClickId: ${sub}`
        ].join('\n');

        await bot.sendMessage(targetChatId, `Новый лид:

${parsedLines}\n\n`, {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '✅', callback_data: `approve_${sub}` },
                        { text: '❌', callback_data: `decline_${sub}` }
                    ]
                ]
            }
        });

        res.json({ success: true, message: 'Message sent to Telegram' });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

bot.on('callback_query', async (callbackQuery) => {
    const { message, data } = callbackQuery;
    const [action, subid] = data.split('_');
    const chatId = message.chat.id;
    const messageId = message.message_id;
    const originalText = message.text;

    let newText = '';

    if (action === 'approve') {
        const url = `https://app4my-knowledge.com/29d342d/postback?subid=${subid}&status=Lead&from=myfb`;
        try {
            const response = await fetch(url);
            console.log(`Postback sent for subid=${subid}, status: ${response.status}`);
        } catch (err) {
            console.error('Postback error:', err);
        }
        newText = `${originalText}\n\nВыбрано ✅`;
    } else if (action === 'decline') {
        newText = `${originalText}\n\nВыбрано ❌`;
    }

    try {
        await bot.editMessageText(newText, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: { inline_keyboard: [] }
        });
        console.log('Buttons removed, message updated.');
    } catch (err) {
        console.error('Edit message error:', err);
    }

    bot.answerCallbackQuery(callbackQuery.id);
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});