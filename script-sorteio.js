const mongoose = require('mongoose');

// A mesma URL de conexão do servidor
const MONGO_URL = 'mongodb+srv://guilhermearcanjodasilva_db_user:HtMkf8DjzmyRgcxz@cluster0.7scuvbi.mongodb.net/amigosecreto?appName=Cluster0';

const Participant = mongoose.model('Participant', new mongoose.Schema({
    name: String,
    drawnName: String,
    hasSeen: { type: Boolean, default: false }
}));

const nomes = ['Danilo', 'Fernanda', 'Guilherme', 'Daniel', 'Ana Lúcia', 'Liviane', 'Patrícia', 'Maria', 'Simão'];

async function realizarSorteio() {
    try {
        console.log('Conectando ao MongoDB...');
        await mongoose.connect(MONGO_URL);
        console.log('Conectado com sucesso!');

        // Limpa o banco antes de fazer um novo sorteio (útil se precisar refazer)
        await Participant.deleteMany({});

        // Algoritmo de embaralhamento seguro
        for (let i = nomes.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [nomes[i], nomes[j]] = [nomes[j], nomes[i]];
        }

        // Cria a relação de quem tira quem (ciclo fechado)
        const sorteioFinal = nomes.map((nome, index) => {
            const proximoIndex = (index + 1) % nomes.length;
            return {
                name: nome,
                drawnName: nomes[proximoIndex],
                hasSeen: false
            };
        });

        // Salva tudo no banco de dados
        await Participant.insertMany(sorteioFinal);
        console.log('🎉 Sorteio realizado e salvo no banco de dados com sucesso!');

    } catch (error) {
        console.error('Erro ao realizar o sorteio:', error);
    } finally {
        await mongoose.disconnect();
    }
}

realizarSorteio();