const mongoose = require('mongoose');

const planetSchema = new mongoose.Schema({
    keplerName: {
        type: String,
        required: true,
    },
    // koiDisposition: {
    //     type: String,
    //     required: true,
    // },
    // koiInsol: {
    //     type: Number,
    //     required: true,
    // },
    // koiPrad: {
    //     type: Number,
    //     required: true,
    // }
});

module.exports = mongoose.model('Planet', planetSchema);