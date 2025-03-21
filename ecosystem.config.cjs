module.exports = {
  apps: [
    {
      name: "app",
      script: "./dist/app.js",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
    },
  ],
};
