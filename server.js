const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Conexão com o MongoDB
mongoose.connect('mongodb+srv://guilhermearcanjodasilva_db_user:HtMkf8DjzmyRgcxz@cluster0.7scuvbi.mongodb.net/amigosecreto?appName=Cluster0');

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
    item: String,
    valor: String,
    tamanhoEspecificacao: String,
    linkLoja: String
}));

const Prato = mongoose.model('Prato', new mongoose.Schema({
    nomePrato: String,
    categoria: String,
    responsavel: { type: String, default: '' }
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
    if (participant.hasSeen) return res.status(403).json({ error: 'Este participante já revelou o amigo secreto em outro aparelho.' });

    participant.hasSeen = true;
    await participant.save();

    res.json({ drawnName: participant.drawnName });
});

app.post('/api/admin/shuffle', async (req, res) => {
    const { password, names } = req.body;

    if (password !== 'admin123') return res.status(401).json({ error: 'Senha incorreta' });
    if (!names || names.length < 3) return res.status(400).json({ error: 'Mínimo de 3 nomes' });

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

    const existingParticipants = await Participant.find({});
    
    // Marcar como inativo os que não estão na nova lista
    for (const existing of existingParticipants) {
        if (!names.includes(existing.name)) {
            existing.isActive = false;
            existing.drawnName = '';
            existing.hasSeen = false;
            await existing.save();
        }
    }

    // Adicionar ou atualizar os participantes da nova lista
    for (let i = 0; i < names.length; i++) {
        const name = names[i];
        const existing = existingParticipants.find(p => p.name === name);
        
        if (existing) {
            existing.isActive = true;
            existing.drawnName = shuffled[i];
            existing.hasSeen = false;
            await existing.save();
        } else {
            const gerada = Math.floor(1000 + Math.random() * 9000).toString();
            await new Participant({
                name: name,
                drawnName: shuffled[i],
                hasSeen: false,
                password: gerada,
                passwordChanged: false,
                isActive: true
            }).save();
        }
    }

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
    if (password !== 'admin123') return res.status(401).json({ error: 'Senha incorreta' });
    
    const participants = await Participant.find({}, 'name password passwordChanged isActive');
    res.json(participants);
});

app.post('/api/admin/change-password', async (req, res) => {
    const { password, name, newPassword } = req.body;
    if (password !== 'admin123') return res.status(401).json({ error: 'Senha incorreta' });
    
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

// Adicionar um novo presente à lista
app.post('/api/presentes', async (req, res) => {
    const { nomeFamiliar, item, valor, tamanhoEspecificacao, linkLoja } = req.body;
    const novoPresente = new Presente({ nomeFamiliar, item, valor, tamanhoEspecificacao, linkLoja });
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
    if (password !== 'admin123') return res.status(401).json({ error: 'Senha incorreta' });
    
    if (all) {
        await Presente.deleteMany({});
    } else if (ids && ids.length > 0) {
        await Presente.deleteMany({ _id: { $in: ids } });
    }
    res.json({ success: true });
});

// Editar um presente
app.put('/api/presentes/:id', async (req, res) => {
    const { item, valor, tamanhoEspecificacao, linkLoja } = req.body;
    const presenteAtualizado = await Presente.findByIdAndUpdate(
        req.params.id,
        { item, valor, tamanhoEspecificacao, linkLoja },
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

// Assumir a responsabilidade por um prato (Botão "Eu levo!") ou Desistir (responsavel vazio)
app.put('/api/ceia/:id/assumir', async (req, res) => {
    const { responsavel } = req.body;
    const prato = await Prato.findByIdAndUpdate(
        req.params.id,
        { responsavel: responsavel },
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
    if (password !== 'admin123') return res.status(401).json({ error: 'Senha incorreta' });
    
    if (all) {
        await Prato.deleteMany({});
    } else if (ids && ids.length > 0) {
        await Prato.deleteMany({ _id: { $in: ids } });
    }
    res.json({ success: true });
});

// Iniciar o servidor
app.listen(3000, () => console.log('Servidor rodando na porta 3000!'));