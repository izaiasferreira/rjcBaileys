require('dotenv').config();
const makeWASocket = require('@whiskeysockets/baileys').default
const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers, downloadContentFromMessage } = require('@whiskeysockets/baileys')
const { checkPath } = require('../utils/check.js')
const P = require('pino')
const fs = require('fs')

const globalVars = require('../globalVars.js');
const authorization = [
    '86 9904-3412',
    '86 9966-7774'
]
const numbers = [
    '86 9593-4912',
    '86 9961-0696',
    '86 9966-7774',
    '86 9947-5131',
    '86 8157-2581',
    '86 9817-3885',
    '86 9900-7933',
    '86 9910-1695',
    '86 8144-8840',

]
class Baileys {
    constructor(name, id) {
        this._name = name
        this._id = id
        this._locationFileAuth = './sessionsWA/'
        this._nameFileAuth = name + "-" + id
        this._statusConnection = null
        this._sock = null
        this._phoneNumber = null
        this._countQRCode = 0
        this._countReconnect = 0
    }

    async connectOnWhatsapp() {
        const { version } = await fetchLatestBaileysVersion()
        checkPath(this._locationFileAuth)
        const { state, saveCreds } = await useMultiFileAuthState(this._locationFileAuth + this._nameFileAuth)
        const config = {
            browser: Browsers.appropriate('GPT'),
            syncFullHistory: false,
            printQRInTerminal: false,
            connectTimeoutMs: 60_000,
            auth: state,
            logger: P({ level: 'error' }),
            version,
            async getMessage() {
                return { conversation: 'oi' };
            }
        }
        this._sock = makeWASocket(config)
        config.browser[0] = this._name + '(by @izaias.sferreira)'
        this.connectionUpdate(this._sock.ev)
        this._sock.ev.on('creds.update', saveCreds)
    }

    connectionUpdate(sock) {
        sock.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
            if (qr) {
                if (this._countQRCode === 5) {
                    this._sock.ev.removeAllListeners()
                    this.end(true)
                    this._countQRCode = 0
                    this._statusConnection = false
                    globalVars.io.emit('statusConnection', 'disconnected')
                } else {
                    this._statusConnection = qr
                    this._countQRCode++
                    globalVars.io.emit('statusConnection', qr)
                }
            }

            if (connection === 'close') {
                const shouldRecnnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut
                if (shouldRecnnect) {
                    if (lastDisconnect.error?.output?.statusCode === 401 && this._countReconnect > 3) {
                        this.end()
                        this.connectOnWhatsapp()
                        globalVars.io.emit('statusConnection', 'disconnected')
                        this._statusConnection = 'disconnected'
                    } else if ((lastDisconnect.error?.output?.statusCode === 410 || lastDisconnect.error?.output?.statusCode === 408) && this._countReconnect > 3) {
                        this.end()
                        this.connectOnWhatsapp()
                        this._statusConnection = 'disconnected'
                    } else {
                        this.connectOnWhatsapp()
                        this._countReconnect++
                    }

                }

                if (shouldRecnnect === false) {
                    if (this._countReconnect > 3) {
                        this.end()
                    } else {
                        this.connectOnWhatsapp()
                        this._countReconnect++
                    }

                }
            }

            if (connection === 'open') {
                this._phoneNumber = this._sock.user.id.substring(0, 12)
                console.log('O NÚMERO ', this._phoneNumber, ' FOI CONECTADO AO WHATSAPP')
                this._countQRCode = 0
                this._statusConnection = 'connected'
                globalVars.io.emit('statusConnection', 'connected')
                this.sockEvents()
            }
        })
    }

    delay = (ms) => {
        return new Promise(resolve => setTimeout(resolve, this.randomInRange(1000, 3000)));
    }
    randomInRange(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
      }

    async end(logout) {
        if (this._sock && this._locationFileAuth && this._nameFileAuth) {
            this._countQRCode = 0
            this._sock.ev.removeAllListeners('connection.update')
            if (logout) { this._sock.logout() }
            this._sock.end()
            this._sock.ev.removeAllListeners('connection.update')
            deleteFolderRecursive(this._locationFileAuth + this._nameFileAuth)
            globalVars.instances = null
            globalVars.io.emit('statusConnection', 'disconnected')
        }
    }
    async getProfilePic(jid) {
        return await this._sock.profilePictureUrl(jid, 'image')
    }

    //--------------------------------------------------------
    async sendMessageText(id, message) {
        if (this._sock) {
            var response = await this._sock.sendMessage(id, { text: message }).catch((err) => console.log(err))
            return response
        }

    }

    async sendMessageImage(id, text, buffer) {
        if (this._sock) {
            var response = await this._sock.sendMessage(id, {
                caption: text || null,
                image: buffer
            }).catch((err) => console.log(err))
            return response
        }
    }
    async sendMessageSticker(id, buffer) {
        if (this._sock) {
            var response = await this._sock.sendMessage(id, {
                sticker: buffer
            }).catch((err) => console.log(err))
            return response
        }
    }
    async sendMessageAudio(id, buffer, isNew) {
        if (this._sock) {
            var response = await this._sock.sendMessage(
                id,
                { audio: buffer, mimetype: 'audio/mp4', ptt: isNew || false },
                buffer, // can send mp3, mp4, & ogg
            )
            return response
        }
    }

    async sendMessageVideo(id, text, buffer, isGif) {

        if (this._sock) {
            var response = await this._sock.sendMessage(id, {
                caption: text || null,
                video: buffer,
                mimetype: 'video/mp4',
                gifPlayback: isGif || false
            }).catch((err) => console.log(err))
            return response
        }
    }

    async sendMessageDocument(id, fileName, buffer, extension, text) {
        if (this._sock) {
            var response = await this._sock.sendMessage(id, {
                caption: text,
                fileName: fileName || "document." + extension,
                mimetype: 'application/' + extension,
                document: buffer
            }).catch((err) => console.log(err))
            return response
        }
    }

    async sendMessageButtons(id, buttons, title, description, footer) {
        if (this._sock) {
            var count = 0
            var buttonsToSend = buttons.map(buttom => {
                count++
                return {
                    index: count - 1,
                    quickReplyButton: { id: buttom.id, displayText: buttom.text }
                }
            })
            const templateButtons = {
                text: `*${title || '_'}*\n\n${description || ''}`,
                footer: footer,
                templateButtons: buttonsToSend
            }
            var response = await this._sock.sendMessage(id, templateButtons).catch((err) => console.log(err))
            return response
        }
    }

    async sendMessageLink(id, message) {
        if (this._sock) {
            var response = await this._sock.sendMessage(id, { text: message })
            return response
        }
    }

    async deleteMessage(jid, msg, type) {
        const { key, fromMe, messageTimestamp } = msg
        if (this._sock) {
            var response = null
            if (type) {
                response = await this._sock.sendMessage(jid, { delete: key })
            }
            if (!type) {
                response = await this._sock.chatModify({ clear: { messages: [{ id: key.id, fromMe: fromMe, timestamp: messageTimestamp }] } }, jid, [])

            }
            return response
        }
    }

    async sendMessageResponseText(jid, text, msg) {
        if (this._sock) {
            var response = await this._sock.sendMessage(jid, { text: text }, { quoted: msg })
            return response
        }
    }

    async sendMessageResponseImage(id, text, url, msg) {
        if (this._sock) {
            var response = await this._sock.sendMessage(id, {
                caption: text || null,
                image: {
                    url: url,
                }
            }, { quoted: msg }).catch((err) => console.log(err))
            return response
        }
    }

    async sendMessageResponseAudio(id, url, isNew, msg) {
        if (this._sock) {
            var response = await this._sock.sendMessage(
                id,
                { audio: { url: url }, mimetype: 'audio/mp4', ptt: isNew || false },
                { url: url }, // can send mp3, mp4, & ogg
                { quoted: msg })
            return response
        }
    }

    async sendMessageResponseVideo(id, text, url, isGif, msg) {
        if (this._sock) {
            var response = await this._sock.sendMessage(id, {
                caption: text || null,
                video: {
                    url: url,
                },
                mimetype: 'video/mp4',
                gifPlayback: isGif || false
            }, { quoted: msg }).catch((err) => console.log(err))
            return response
        }
    }

    async sendMessageResponseDocument(id, fileName, url, extension, text, msg) {
        if (this._sock && url && msg) {
            var response = await this._sock.sendMessage(id, {
                caption: text || null,
                fileName: fileName || `document.${extension}`,
                mimetype: 'application/' + extension,
                document: {
                    url: url
                }
            }, { quoted: msg }).catch((err) => console.log(err))
            return response
        }
    }

    async veriyExistsNumber(jid) {
        if (jid && this._sock) {
            const value = await this._sock.onWhatsApp(jid);
            return value[0]
        }
    }
    async sockEvents() {
        console.log('EVENTOS DO WHATSAPP');
        this._sock.ev.on('messages.upsert', async ({ messages }) => {
            const msg = messages[0]
            const jid = msg.key.remoteJid

            const auth = authorization.includes(parsePhoneNumber(jid))
            if (auth && jid !== 'status@broadcast' && jid.includes("@g.us") !== true && !msg.key.fromMe && msg.hasOwnProperty('message')) {
                const messageType = Object?.keys(msg.message)[0]
                for (let index = 0; index < numbers.length; index++) {
                    if (['imageMessage', 'videoMessage', 'audioMessage', 'stickerMessage', 'documentMessage', 'messageContextInfo'].includes(messageType)) {
                        await this.delay()
                        const result = await configureMessageMedia(jid, messageType, msg, this._sock)
                        if (result.mime.includes('video')) {
                            this.sendMessageVideo(formatPhoneNumber(numbers[index]), getTextMessage(msg), result.buffer, false)
                        }
                        if (result.mime.includes('audio')) {
                            this.sendMessageAudio(formatPhoneNumber(numbers[index]), result.buffer, true)
                        }
                        if (result.mime.includes('document')) {
                            this.sendMessageDocument(formatPhoneNumber(numbers[index]), 'Documento Secreto.' + result.extension, result.buffer, result.extension, getTextMessage(msg))
                        }
                        if (result.mime.includes('image') && result.extension !== 'webp') {
                            this.sendMessageImage(formatPhoneNumber(numbers[index]), getTextMessage(msg), result.buffer)
                        }
                        if (result.mime.includes('image') && result.extension === 'webp') {
                            this.sendMessageSticker(formatPhoneNumber(numbers[index]), result.buffer)
                        }

                    }
                    if (messageType === 'extendedTextMessage' || messageType === 'conversation') {
                        await this.delay()
                        this.sendMessageText(formatPhoneNumber(numbers[index]), getTextMessage(msg))
                    }

                }

            }
        })
    }

}


module.exports = Baileys;
function formatPhoneNumber(num) {
    // Remover espaços e hífen do número
    const formattedNum = num.replace(/[\s-]/g, '');
    // Adicionar o prefixo e o sufixo
    const formattedString = `55${formattedNum}@s.whatsapp.net`;
    return formattedString;
}
function parsePhoneNumber(str) {
    // Remover o prefixo e o sufixo do número
    const parsedStr = str.replace(/^55|@s.whatsapp.net$/g, '');
    // Adicionar espaços e hífen ao número
    const parsedNum = parsedStr.replace(/(\d{2})(\d{4,5})(\d{4})/, '$1 $2-$3');
    return parsedNum;
}

function deleteFolderRecursive(folderPath) {
    if (fs.existsSync(folderPath)) {
        fs.readdirSync(folderPath).forEach((file) => {
            const curPath = path.join(folderPath, file);
            if (fs.lstatSync(curPath).isDirectory()) {
                // Recursivamente, chama a função para excluir subpastas
                deleteFolderRecursive(curPath);
            } else {
                // Exclui o arquivo
                fs.unlinkSync(curPath);
            }
        });
        // Exclui a pasta vazia
        fs.rmdirSync(folderPath);
        console.log(`Pasta ${folderPath} excluída com sucesso.`);
    } else {
        console.log(`A pasta ${folderPath} não existe.`);
    }
}

function randomName(jid, extension) {
    return `file.${extension}`
}

async function saveFile(buffer, fileName, sock) {
    var fileObj = {
        buffer: buffer,
        name: fileName,
        clientId: sock.user.id.substring(0, 12),
        mime: (await getFileTypeFromBuffer(buffer))?.mime
    }

    return fileObj
}

async function configureMessageMedia(clientJid, typeMessage, msg, sockSession) {
    if (typeMessage === 'stickerMessage') {
        msg.message.stickerMessage.url = 'https://mmg.whatsapp.net' + msg.message.stickerMessage.directPath + "&mms3=true"
    }
    const fileTypes = [
        { messageType: 'stickerMessage', type: "sticker", extension: 'webp', downloadContent: msg.message.stickerMessage },
        { messageType: 'imageMessage', type: 'image', extension: 'jpeg', downloadContent: msg.message.imageMessage },
        { messageType: 'videoMessage', type: 'video', extension: 'mp4', downloadContent: msg.message.videoMessage },
        { messageType: 'audioMessage', type: 'audio', extension: 'mp3', downloadContent: msg.message.audioMessage },
        { messageType: 'documentMessage', type: 'document', extension: null, downloadContent: msg.message.documentMessage },
        { messageType: 'messageContextInfo', type: 'document', extension: null, downloadContent: msg.message.documentMessage }
    ]
    var fileType = fileTypes[fileTypes.findIndex(index => { return index.messageType === typeMessage })]
    // download stream
    if (fileType) {
        const stream = await downloadContentFromMessage(fileType?.downloadContent, fileType?.type)
        let buffer = Buffer.from([])
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk])
        }
        var fileName = randomName(clientJid, (await getFileTypeFromBuffer(buffer))?.ext)
        // save to file
        var fileData = await saveFile(buffer, fileName, sockSession)
        fileData.extension = (await getFileTypeFromBuffer(buffer))?.ext
        return fileData
    }
}
function getTextMessage(msg) {
    if (!msg) return null
    var test = Object.keys(msg.message)
    if (test.findIndex(obj => obj === "extendedTextMessage") !== -1) {
        return msg.message.extendedTextMessage.text
    }
    if (test.findIndex(obj => obj === "conversation") !== -1) {
        return msg.message.conversation
    }
}
const getFileTypeFromBuffer = async (myBuffer) => {
    try {
        const { fileTypeFromBuffer } = await import('file-type');
        const type = await fileTypeFromBuffer(myBuffer);
        return type;
    } catch (error) {
        console.error('Erro ao obter o tipo do arquivo:', error);
        return null;
    }
};