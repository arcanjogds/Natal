require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
app.use(helmet({
    crossOriginResourcePolicy: false,
}));

app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
}));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// 4. Rate Limiting para as rotas de Admin
const adminLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 10, // Limite de 10 requisições...
    skipSuccessfulRequests: true, // ...Apenas conta requisições falhas (ex: senha errada - status 401)
    message: { error: 'Muitas tentativas incorretas. O seu IP foi bloqueado temporariamente por 15 minutos.' }
});

app.use('/api/admin/', adminLimiter);

// Conexão Segura com o MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Conectado ao MongoDB com segurança!'))
    .catch((err) => console.error('Erro na conexão com o banco:', err.message));
// ==========================================
// SCHEMAS (Modelos de Dados)
// ==========================================

const Participant = mongoose.model('Participant', new mongoose.Schema({
    name: String,
    drawnName: String,
    hasSeen: { type: Boolean, default: false },
    password: { type: String, default: '' },
    passwordChanged: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true }
}));

const Presente = mongoose.model('Presente', new mongoose.Schema({
    nomeFamiliar: String,
    nomeKit: { type: String, default: 'Pedido Individual' },
    isKit: { type: Boolean, default: true },
    meta: { type: Number, default: 150 },
    itens: [{
        item: String,
        valor: Number,
        tamanhoEspecificacao: String,
        linkLoja: String
    }]
}));

const Prato = mongoose.model('Prato', new mongoose.Schema({
    nomePrato: String,
    categoria: String,
    responsaveis: { type: [{ nome: String, quantidade: Number }], default: [] }
}));

// ==========================================
// ROTAS DO AMIGO SECRETO (Existentes)
// ==========================================

app.get('/api/participants', async (req, res) => {
    const participants = await Participant.find({ isActive: true }, 'name hasSeen');
    res.json(participants);
});

app.post('/api/reveal', async (req, res) => {
    const { name } = req.body;
    const participant = await Participant.findOne({ name });

    if (!participant) return res.status(404).json({ error: 'Nome não encontrado' });

    participant.hasSeen = true;
    await participant.save();

    res.json({ drawnName: participant.drawnName });
});

app.post('/api/admin/shuffle', async (req, res) => {
    const { password } = req.body;
    if (password !== process.env.ADMIN_PASSWORD) return res.status(401).json({ error: 'Senha incorreta' });

    const activeParticipants = await Participant.find({ isActive: true });
    if (activeParticipants.length < 3) return res.status(400).json({ error: 'Mínimo de 3 participantes ativos' });

    const names = activeParticipants.map(p => p.name);
    let shuffled = [...names].sort(() => Math.random() - 0.5);
    let valid = false;
    while (!valid) {
        valid = true;
        for (let i = 0; i < names.length; i++) {
            if (names[i] === shuffled[i]) {
                shuffled = [...names].sort(() => Math.random() - 0.5);
                valid = false;
                break;
            }
        }
    }

    for (let i = 0; i < activeParticipants.length; i++) {
        activeParticipants[i].drawnName = shuffled[i];
        activeParticipants[i].hasSeen = false;
        await activeParticipants[i].save();
    }

    res.json({ success: true });
});

// CRUD Individual de Participantes (Admin)
app.post('/api/admin/participant', async (req, res) => {
    const { password, name } = req.body;
    if (password !== process.env.ADMIN_PASSWORD) return res.status(401).json({ error: 'Senha incorreta' });
    
    const existing = await Participant.findOne({ name });
    if (existing) return res.status(400).json({ error: 'Nome já existe' });
    
    const gerada = Math.floor(1000 + Math.random() * 9000).toString();
    const newParticipant = new Participant({
        name,
        drawnName: '',
        hasSeen: false,
        password: gerada,
        passwordChanged: false,
        isActive: true
    });
    await newParticipant.save();
    res.json({ success: true, participant: newParticipant });
});

app.put('/api/admin/participant/:id', async (req, res) => {
    const { password, name, isActive } = req.body;
    if (password !== process.env.ADMIN_PASSWORD) return res.status(401).json({ error: 'Senha incorreta' });
    
    const participant = await Participant.findById(req.params.id);
    if (!participant) return res.status(404).json({ error: 'Participante não encontrado' });
    
    if (name && name !== participant.name) {
        const existing = await Participant.findOne({ name });
        if (existing) return res.status(400).json({ error: 'Já existe um participante com este nome' });
        participant.name = name;
    }
    
    if (isActive !== undefined) {
        participant.isActive = isActive;
        if (!isActive) {
            participant.drawnName = '';
            participant.hasSeen = false;
        }
    }
    
    await participant.save();
    res.json({ success: true, participant });
});

app.delete('/api/admin/participant/:id', async (req, res) => {
    const { password } = req.body;
    if (password !== process.env.ADMIN_PASSWORD) return res.status(401).json({ error: 'Senha incorreta' });
    
    await Participant.findByIdAndDelete(req.params.id);
    res.json({ success: true });
});

// ==========================================
// ROTAS DE LOGIN E ADMIN
// ==========================================

app.post('/api/login', async (req, res) => {
    const { name, password } = req.body;
    const participant = await Participant.findOne({ name });
    
    if (!participant) return res.status(404).json({ error: 'Nome não encontrado' });
    if (participant.password !== password) return res.status(401).json({ error: 'Senha incorreta' });
    
    res.json({ success: true, participant });
});

app.post('/api/change-password', async (req, res) => {
    const { name, oldPassword, newPassword } = req.body;
    const participant = await Participant.findOne({ name });
    
    if (!participant) return res.status(404).json({ error: 'Nome não encontrado' });
    if (participant.password !== oldPassword) return res.status(401).json({ error: 'Senha atual incorreta' });
    if (!newPassword || newPassword.length < 4) return res.status(400).json({ error: 'A nova senha deve ter no mínimo 4 caracteres' });
    
    participant.password = newPassword;
    participant.passwordChanged = true;
    await participant.save();
    
    res.json({ success: true });
});

app.post('/api/admin/participants', async (req, res) => {
    const { password } = req.body;
    if (password !== process.env.ADMIN_PASSWORD) return res.status(401).json({ error: 'Senha incorreta' });
    
    const participants = await Participant.find({}, '_id name password passwordChanged isActive hasSeen');
    res.json(participants);
});

app.post('/api/admin/change-password', async (req, res) => {
    const { password, name, newPassword } = req.body;
    if (password !== process.env.ADMIN_PASSWORD) return res.status(401).json({ error: 'Senha incorreta' });
    
    const participant = await Participant.findOne({ name });
    if (!participant) return res.status(404).json({ error: 'Nome não encontrado' });
    
    participant.password = newPassword;
    await participant.save();
    
    res.json({ success: true });
});

// ==========================================
// NOVAS ROTAS: VITRINE DE PRESENTES
// ==========================================

// Listar todos os presentes
app.get('/api/presentes', async (req, res) => {
    const presentes = await Presente.find({});
    res.json(presentes);
});

// Adicionar um novo presente à lista (ou Kit vazio)
app.post('/api/presentes', async (req, res) => {
    const { nomeFamiliar, nomeKit, itens, meta, isKit } = req.body;
    const novoPresente = new Presente({ 
        nomeFamiliar, 
        nomeKit: nomeKit || 'Pedido de Presente', 
        isKit: isKit !== undefined ? isKit : true,
        itens: itens || [],
        meta: meta || 150
    });
    await novoPresente.save();
    res.json(novoPresente);
});

// Deletar um presente (caso a pessoa desista do item)
app.delete('/api/presentes/:id', async (req, res) => {
    await Presente.findByIdAndDelete(req.params.id);
    res.json({ success: true });
});

// Deletar em massa (admin)
app.post('/api/admin/presentes/delete', async (req, res) => {
    const { password, ids, all } = req.body;
    if (password !== process.env.ADMIN_PASSWORD) return res.status(401).json({ error: 'Senha incorreta' });
    
    if (all) {
        await Presente.deleteMany({});
    } else if (ids && ids.length > 0) {
        await Presente.deleteMany({ _id: { $in: ids } });
    }
    res.json({ success: true });
});

// Editar um presente/kit
app.put('/api/presentes/:id', async (req, res) => {
    const { nomeKit, itens, meta } = req.body;
    const updateData = {};
    if (nomeKit !== undefined) updateData.nomeKit = nomeKit;
    if (itens !== undefined) updateData.itens = itens;
    if (meta !== undefined) updateData.meta = meta;
    
    const presenteAtualizado = await Presente.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true }
    );
    res.json(presenteAtualizado);
});

// ==========================================
// NOVAS ROTAS: CARDÁPIO DA CEIA
// ==========================================

// Listar todo o cardápio
app.get('/api/ceia', async (req, res) => {
    const pratos = await Prato.find({});
    res.json(pratos);
});

// Adicionar um novo prato ao cardápio
app.post('/api/ceia', async (req, res) => {
    const { nomePrato, categoria } = req.body;
    const novoPrato = new Prato({ nomePrato, categoria }); // Responsável começa vazio por padrão
    await novoPrato.save();
    res.json(novoPrato);
});

// Assumir a responsabilidade por um prato ou Desistir
app.put('/api/ceia/:id/assumir', async (req, res) => {
    const { responsaveis } = req.body; // array completo
    const prato = await Prato.findByIdAndUpdate(
        req.params.id,
        { responsaveis: responsaveis },
        { new: true } // Retorna o documento atualizado
    );
    res.json(prato);
});

// Editar um prato do cardápio
app.put('/api/ceia/:id', async (req, res) => {
    const { nomePrato, categoria } = req.body;
    const pratoAtualizado = await Prato.findByIdAndUpdate(
        req.params.id,
        { nomePrato, categoria },
        { new: true }
    );
    res.json(pratoAtualizado);
});

// Deletar um prato do cardápio
app.delete('/api/ceia/:id', async (req, res) => {
    await Prato.findByIdAndDelete(req.params.id);
    res.json({ success: true });
});

// Deletar em massa (admin)
app.post('/api/admin/ceia/delete', async (req, res) => {
    const { password, ids, all } = req.body;
    if (password !== process.env.ADMIN_PASSWORD) return res.status(401).json({ error: 'Senha incorreta' });
    
    if (all) {
        await Prato.deleteMany({});
    } else if (ids && ids.length > 0) {
        await Prato.deleteMany({ _id: { $in: ids } });
    }
    res.json({ success: true });
});

// Iniciar o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}!`));