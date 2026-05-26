module.exports = {
  apps: [
    {
      name: 'probodyline',
      script: 'dist/src/main.js',
      instances: 1,
      exec_mode: 'fork',
      node_args: '--max-old-space-size=512',
      env: {
        NODE_ENV: 'production',
      },
      // Restart policy: only restart on crash, not on deploy
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 2000,
      // Memory limit: restart if process exceeds 450MB
      max_memory_restart: '450M',
      // Graceful shutdown: wait for in-flight requests to finish (30s)
      kill_timeout: 30000,
      // Log settings
      out_file: '/home/ubuntu/.pm2/logs/probodyline-out.log',
      error_file: '/home/ubuntu/.pm2/logs/probodyline-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
    },
  ],
};
