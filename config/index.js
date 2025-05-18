import nconf from "nconf";
import path from "path";
import { fileURLToPath } from "url";

const getConfigFile = (environment) => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const configDir = path.join(__dirname, environment);
  const configFile = path.join(configDir, "keys.json");
  return configFile;
};

export const readFileToNconf = () => {
  const environment = process.env.NODE_ENV || "development";
  const configFile = getConfigFile(environment);
  nconf.clear();

  nconf.file({ file: configFile });
  nconf.env();
  nconf.argv();

  return nconf;
};
