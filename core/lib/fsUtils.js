const fs = require('fs');
const fsp = fs.promises;

async function folderExists(folderPath) {
    try {
        const stats = await fsp.stat(folderPath);
        return stats.isDirectory();
    } catch {
        return false;
    }
}

async function fileExists(filePath){
    try {
        const stats = await fsp.stat(filePath);
        return stats.isFile();
    } catch {
        return false;
    }
}

module.exports = { folderExists, fileExists };