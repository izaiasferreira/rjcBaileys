require('dotenv').config();
const express = require('express');
const cors = require('cors');
var logger = require('morgan');
const app = express();
const { createServer } = require("http");
const { Server } = require("socket.io");
const httpServer = createServer(app);
const Baileys = require('./class/InstanceBaileys')
const globalVars = require('./globalVars')
const path = require('path')
const publicDirectoryPath = path.join(__dirname, './public')
const port = 3000

globalVars.io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        allowedHeaders: ["my-custom-header"],
        credentials: true
    }
});

app.use(cors())
app.use(express.json())
app.use(logger('dev'));
app.use(express.static(publicDirectoryPath))
app.use(express.static('public'))
app.use(express.static('files'))


app.get('/', async (req, res) => {
    return res.render('./public/index.html', { data: response.data });
});

app.get('/instances', (req, res) => {
    res.status(200).json(globalVars.instances)
});
app.get('/statusConnection', (req, res) => {
    if (globalVars.instances) {
        res.status(200).json(globalVars?.instances._statusConnection)
    } else {
        res.status(400).end()
    }
});

app.post('/startConnection', async (req, res) => {
    if (!globalVars.instances) {
        var a = new Baileys('Minha API', '001')
        globalVars.instances = a
        globalVars.instances.connectOnWhatsapp()
        res.status(200).end()
    } else {
        res.status(400).end()
    }
});

app.post('/disconnect', async (req, res) => {
    await globalVars?.instances?.end(true)
    res.status(200).end()
});




httpServer.listen(port, () => {
    console.log(`Servidor Rodando na porta ${port}`);
});


globalVars.io.on('connection', (socket) => {
    console.log('Socket Conectado');
})