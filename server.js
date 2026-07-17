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
    hasSeen: { type: Boolean, default: false }
}));

const Presente = mongoose.model('Presente', new mongoose.Schema({
    nomeFamiliar: String,
    item: String,
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
    const participants = await Participant.find({}, 'name hasSeen');
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

    await Participant.deleteMany({});

    const newParticipants = names.map((name, index) => ({
        name: name,
        drawnName: shuffled[index],
        hasSeen: false
    }));

    await Participant.insertMany(newParticipants);

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
    const { nomeFamiliar, item, tamanhoEspecificacao, linkLoja } = req.body;
    const novoPresente = new Presente({ nomeFamiliar, item, tamanhoEspecificacao, linkLoja });
    await novoPresente.save();
    res.json(novoPresente);
});

// Deletar um presente (caso a pessoa desista do item)
app.delete('/api/presentes/:id', async (req, res) => {
    await Presente.findByIdAndDelete(req.params.id);
    res.json({ success: true });
});

// Editar um presente
app.put('/api/presentes/:id', async (req, res) => {
    const { item, tamanhoEspecificacao, linkLoja } = req.body;
    const presenteAtualizado = await Presente.findByIdAndUpdate(
        req.params.id,
        { item, tamanhoEspecificacao, linkLoja },
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

// Iniciar o servidor
app.listen(3000, () => console.log('Servidor rodando na porta 3000!'));