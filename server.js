const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Conexão com o MongoDB
mongoose.connect('mongodb+srv://guilhermearcanjodasilva_db_user:HtMkf8DjzmyRgcxz@cluster0.7scuvbi.mongodb.net/amigosecreto?appName=Cluster0');

const Participant = mongoose.model('Participant', new mongoose.Schema({
    name: String,
    drawnName: String,
    hasSeen: { type: Boolean, default: false }
}));

// Rota para listar
app.get('/api/participants', async (req, res) => {
    const participants = await Participant.find({}, 'name hasSeen');
    res.json(participants);
});

// Rota para revelar
app.post('/api/reveal', async (req, res) => {
    const { name } = req.body;
    const participant = await Participant.findOne({ name });

    if (!participant) return res.status(404).json({ error: 'Nome não encontrado' });

    participant.hasSeen = true;
    await participant.save();

    res.json({ drawnName: participant.drawnName });
});

// ROTA ADMIN: Refazer todo o sorteio
app.post('/api/admin/shuffle', async (req, res) => {
    const { password, names } = req.body;

    // Senha de segurança
    if (password !== 'admin123') return res.status(401).json({ error: 'Senha incorreta' });
    if (!names || names.length < 3) return res.status(400).json({ error: 'Mínimo de 3 nomes' });

    // Lógica do Sorteio
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

    // Limpa o banco de dados antigo
    await Participant.deleteMany({});

    // Salva os novos nomes sorteados
    const newParticipants = names.map((name, index) => ({
        name: name,
        drawnName: shuffled[index],
        hasSeen: false
    }));

    await Participant.insertMany(newParticipants);
    res.json({ success: true });
});

app.listen(3000, () => console.log('Servidor rodando na porta 3000!'));