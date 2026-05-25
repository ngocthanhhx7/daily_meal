module.exports = {
  apps: [
    {
      name: "daily-meal-api",
      cwd: "./server",
      script: "./dist/index.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: "4000"
      },
      max_memory_restart: "350M",
      time: true
    }
  ]
};
