// PM2 process manager config
// Usage:  pm2 start ecosystem.config.js --env production
module.exports = {
  apps: [
    {
      name: 'lockercad',
      script: 'node_modules/.bin/next',
      args: 'start',
      cwd: '/var/www/lockercad',   // change to your deploy path
      instances: 1,
      autorestart: true,
      watch: false,
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
}
