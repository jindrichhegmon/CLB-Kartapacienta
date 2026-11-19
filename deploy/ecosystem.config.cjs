// pm2: pm2 start deploy/ecosystem.config.cjs && pm2 save
module.exports = {
  apps: [{
    name: 'clb-kartapacienta',
    script: 'src/server.js',
    cwd: __dirname + '/..',
    env: { NODE_ENV: 'production' },
    // 0.11.126: čtení zprávy z obrázku (OCR) potřebuje kolem 400 MB – při 250 MB pm2 aplikaci uprostřed rozboru restartoval
    max_memory_restart: '1G',
    time: true,
  }],
};
