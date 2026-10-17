// pm2: pm2 start deploy/ecosystem.config.cjs && pm2 save
module.exports = {
  apps: [{
    name: 'clb-kartapacienta',
    script: 'src/server.js',
    cwd: __dirname + '/..',
    env: { NODE_ENV: 'production' },
    max_memory_restart: '250M',
    time: true,
  }],
};
