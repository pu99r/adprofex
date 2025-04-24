require('dotenv').config();          // загружаем .env
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
const cors = require('cors');
const chats = require('./config/chats');

const app   = express();
const PORT  = process.env.PORT || 3000;
const bot   = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });

app.use(cors());
app.use(express.json());

/**
 *  /send?creo=...&vertical=...&contact=...&login=...&sub=...&geo=...&chat=1,2
 */
app.get('/send', async (req, res) => {
  try {
    const { creo, vertical, contact, login, sub, geo, chat } = req.query;

    // проверяем обязательные поля
    if (!creo || !vertical || !contact || !login || !sub || !geo) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    /*------------------------------------------------------------
     *  Определяем, в какие чаты отправлять
     *-----------------------------------------------------------*/
    const ids = (chat ? chat.split(',') : ['default'])   // берём ключи
      .map(c => chats[c])                                 // превращаем в chat-id
      .filter(Boolean);                                   // отбрасываем пустые

    if (!ids.length) {
      return res.status(400).json({ error: 'Unknown chat key' });
    }

    /*------------------------------------------------------------
     *  Формируем текст лида
     *-----------------------------------------------------------*/
    const text = [
      `Geo: ${geo}`,
      `Vertical: ${vertical}`,
      `Method: ${contact}`,
      `Login: ${login}`,
      `Creo: ${creo}`
    ].join('\n');

    /*------------------------------------------------------------
     *  Рассылаем во все указанные чаты
     *-----------------------------------------------------------*/
    await Promise.all(ids.map(id =>
      bot.sendMessage(
        id,
        `Новый лид:\n\n${text}\n\n`,
        {
          reply_markup: {
            inline_keyboard: [[
              { text: '✅', callback_data: `approve_${sub}` },
              { text: '❌', callback_data: `decline_${sub}` }
            ]]
          }
        }
      )
    ));

    res.json({ success: true, message: 'Message sent to Telegram' });
  } catch (err) {
    console.error('Send error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/*================================================================
  Call-back обработчик – кнопки ✅ / ❌
================================================================*/
bot.on('callback_query', async (cb) => {
  try {
    const { message, data } = cb;
    const [action, subid] = data.split('_');

    /*------------------------------------------------------------
     *  Что выбрали – approve / decline
     *-----------------------------------------------------------*/
    let newText = message.text;
    if (action === 'approve') {
      // шлём постбэк вашему трекеру
      const url = `https://app4my-knowledge.com/29d342d/postback?subid=${subid}&status=Lead&from=myfb`;
      try {
        const resp = await fetch(url);
        console.log(`Postback sent, status: ${resp.status}`);
      } catch (err) {
        console.error('Postback error:', err);
      }
      newText += '\n\nВыбрано ✅';
    } else if (action === 'decline') {
      newText += '\n\nВыбрано ❌';
    }

    /*------------------------------------------------------------
     *  Обновляем сообщение и убираем кнопки
     *-----------------------------------------------------------*/
    await bot.editMessageText(newText, {
      chat_id: message.chat.id,
      message_id: message.message_id,
      reply_markup: { inline_keyboard: [] }   // кнопок больше нет
    });

    bot.answerCallbackQuery(cb.id);           // подтверждаем нажатие
  } catch (err) {
    console.error('Callback error:', err);
  }
});

/*================================================================
  Запуск сервера
================================================================*/
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));