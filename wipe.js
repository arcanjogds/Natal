require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI)
    .then(async () => {
        const Prato = mongoose.model('Prato', new mongoose.Schema({}, { strict: false }));
        const Presente = mongoose.model('Presente', new mongoose.Schema({}, { strict: false }));

        await Prato.deleteMany({});
        console.log('Pratos apagados');

        await Presente.deleteMany({});
        console.log('Presentes apagados');

        process.exit(0);
    });
