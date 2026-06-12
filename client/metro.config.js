const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

config.projectRoot = projectRoot;
config.watchFolders = Array.from(new Set([...(config.watchFolders ?? []), workspaceRoot]));

module.exports = config;
