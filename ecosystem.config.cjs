// ecosystem.config.cjs
const path = require('path');

module.exports = {
  apps: [
    {
      name: "dashboard",
      script: "npm",
      args: "run dev",
      cwd: path.resolve(__dirname, 'apps/dashboard'),
      log_date_format: "YYYY-MM-DD HH:mm:ss.SSS",
      env: {
        NODE_ENV: "development",
      },
    },
    {
      name: "worker:ingest",
      script: "npm",
      args: "run dev:ingest",
      cwd: path.resolve(__dirname, 'packages/workers'),
      log_date_format: "YYYY-MM-DD HH:mm:ss.SSS",
      env: {
        NODE_ENV: "development",
      },
    },
    {
      name: "worker:analysis",
      script: "npm",
      args: "run dev:analysis",
      cwd: path.resolve(__dirname, 'packages/workers'),
      log_date_format: "YYYY-MM-DD HH:mm:ss.SSS",
      env: {
        NODE_ENV: "development",
      },
    },
    {
      name: "worker:keyframe",
      script: "npm",
      args: "run dev:keyframe",
      cwd: path.resolve(__dirname, 'packages/workers'),
      log_date_format: "YYYY-MM-DD HH:mm:ss.SSS",
      env: {
        NODE_ENV: "development",
      },
    },
    {
      name: "worker:animation",
      script: "npm",
      args: "run dev:animation",
      cwd: path.resolve(__dirname, 'packages/workers'),
      log_date_format: "YYYY-MM-DD HH:mm:ss.SSS",
      env: {
        NODE_ENV: "development",
      },
    },
  ],
};
