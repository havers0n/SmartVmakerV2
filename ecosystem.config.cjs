// ecosystem.config.cjs
const path = require("path");

module.exports = {
  apps: [
    {
      name: "dashboard",
      script: "dotenv",
      args: "-e ./.env -- npm run dev",
      cwd: path.resolve(__dirname, "apps/dashboard"),
      log_date_format: "YYYY-MM-DD HH:mm:ss.SSS",
      env: {
        NODE_ENV: "development",
      },
    },
    {
      name: "worker:ingest",
      script: "dotenv",
      args: "-e ./.env -- npm run dev:ingest",
      cwd: path.resolve(__dirname, "packages/workers"),
      log_date_format: "YYYY-MM-DD HH:mm:ss.SSS",
      env: {
        NODE_ENV: "development",
      },
    },
    {
      name: "worker:analysis",
      script: "dotenv",
      args: "-e ./.env -- npm run dev:analysis",
      cwd: path.resolve(__dirname, "packages/workers"),
      log_date_format: "YYYY-MM-DD HH:mm:ss.SSS",
      env: {
        NODE_ENV: "development",
      },
    },
    {
      name: "worker:scenario",
      script: "dotenv",
      args: "-e ./.env -- npm run dev:scenario",
      cwd: path.resolve(__dirname, "packages/workers"),
      log_date_format: "YYYY-MM-DD HH:mm:ss.SSS",
      env: {
        NODE_ENV: "development",
      },
      // MiniMax timeout is 120s; allow the claimed call and terminal transaction to finish.
      kill_timeout: 135000,
    },
    {
      name: "worker:keyframe",
      script: "dotenv",
      args: "-e ./.env -- npm run dev:keyframe",
      cwd: path.resolve(__dirname, "packages/workers"),
      log_date_format: "YYYY-MM-DD HH:mm:ss.SSS",
      env: {
        NODE_ENV: "development",
      },
    },
    {
      name: "worker:animation",
      script: "dotenv",
      args: "-e ./.env -- npm run dev:animation",
      cwd: path.resolve(__dirname, "packages/workers"),
      log_date_format: "YYYY-MM-DD HH:mm:ss.SSS",
      env: {
        NODE_ENV: "development",
      },
    },
  ],
};
