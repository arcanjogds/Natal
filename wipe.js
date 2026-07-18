const mongoose = require('mongoose');

mongoose.connect('mongodb+srv://guilhermearcanjodasilva_db_user:HtMkf8DjzmyRgcxz@cluster0.7scuvbi.mongodb.net/amigosecreto?appName=Cluster0')
.then(async () => {
    const Prato = mongoose.model('Prato', new mongoose.Schema({}, { strict: false }));
    const Presente = mongoose.model('Presente', new mongoose.Schema({}, { strict: false }));
    
    await Prato.deleteMany({});
    console.log('Pratos apagados');
    
    await Presente.deleteMany({});
    console.log('Presentes apagados');
    
    process.exit(0);
});
