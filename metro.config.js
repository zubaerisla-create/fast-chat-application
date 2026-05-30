const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Limit the number of workers to avoid SIGSEGV in Metro's Jest worker process
config.maxWorkers = 2;

module.exports = config;
