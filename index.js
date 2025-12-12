const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const admin = require('firebase-admin');

// Configuración de Firebase
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID,
  databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com`
};

// Inicializar Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: firebaseConfig.projectId,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  }),
  databaseURL: firebaseConfig.databaseURL
});

const db = admin.database();

// Token del bot
const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token);

// Configurar Express para el webhook
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

// Endpoint de salud
app.get('/', (req, res) => {
  res.send('🤖 Bot de Telegram CGT está activo!');
});

// Webhook endpoint
app.post(`/bot${token}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Función para guardar grupo en Firebase
async function guardarGrupo(chatData) {
  try {
    const grupoRef = db.ref('grupos').push();
    
    const grupoInfo = {
      id: chatData.id,
      nombre: chatData.title || 'Sin nombre',
      descripcion: chatData.description || 'Sin descripción',
      tipo: chatData.type,
      username: chatData.username || 'Sin username',
      fecha_agregado: new Date().toISOString(),
      timestamp: Date.now()
    };

    await grupoRef.set(grupoInfo);
    console.log('✅ Grupo guardado en Firebase:', chatData.title);
    return true;
  } catch (error) {
    console.error('❌ Error al guardar en Firebase:', error);
    return false;
  }
}

// Detectar cuando el bot es agregado a un grupo
bot.on('my_chat_member', async (msg) => {
  const { chat, new_chat_member } = msg;
  
  // Verificar si el bot fue agregado al grupo
  if (new_chat_member.status === 'member' || new_chat_member.status === 'administrator') {
    console.log(`🎉 Bot agregado al grupo: ${chat.title}`);
    
    // Guardar información del grupo
    const guardado = await guardarGrupo(chat);
    
    if (guardado) {
      // Enviar mensaje de bienvenida
      try {
        await bot.sendMessage(
          chat.id,
          `¡Hola! 👋\n\n` +
          `Gracias por agregarme al grupo *${chat.title}*\n\n` +
          `He guardado la información de este grupo en mi base de datos.\n\n` +
          `✅ Nombre: ${chat.title}\n` +
          `✅ Descripción: ${chat.description || 'Sin descripción'}\n` +
          `✅ Tipo: ${chat.type}`,
          { parse_mode: 'Markdown' }
        );
      } catch (error) {
        console.error('Error al enviar mensaje:', error);
      }
    }
  }
});

// Comando /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(
    chatId,
    '🤖 *Bot CGT Telegram*\n\n' +
    'Este bot recopila información cuando es agregado a grupos o canales.\n\n' +
    '📋 *Información que guardo:*\n' +
    '• Nombre del grupo\n' +
    '• Descripción\n' +
    '• Tipo de chat\n' +
    '• Fecha de agregado\n\n' +
    '✨ Simplemente agrégame a un grupo y comenzaré a trabajar!',
    { parse_mode: 'Markdown' }
  );
});

// Comando /info
bot.