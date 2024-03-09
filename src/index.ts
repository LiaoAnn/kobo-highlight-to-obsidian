import * as fs from 'fs-extra';
import { Config } from './types';
import { Convert } from './convert';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isConfig = (config: any): config is Config => {
  const {
    fileName,
    bookPath,
    chapterPath,
    highlightsPath,
    generatedMindMap,
    mindMapFolder,
    properties,
  } = config;
  return (
    typeof fileName === 'string' &&
    typeof bookPath === 'string' &&
    typeof chapterPath === 'string' &&
    typeof highlightsPath === 'string' &&
    typeof generatedMindMap === 'boolean' &&
    (mindMapFolder === undefined || typeof mindMapFolder === 'string') &&
    properties &&
    typeof properties === 'object' &&
    typeof properties.book === 'object' &&
    typeof properties.chapter === 'object' &&
    typeof properties.highlight === 'object' &&
    typeof properties.mindMap === 'object'
  );
};

const loadConfig = () => {
  const config = fs.readJsonSync('config.json');
  // check if the config file has the correct structure
  if (!isConfig(config)) {
    throw new Error('Invalid config file');
  }
  return config;
};

(() => {
  const config = loadConfig() as Config;
  const convert = new Convert(config);
  convert.startProcess();
})();
