import { createPool } from "mysql2";
import { readFileToNconf } from "./index.js";

const nconf = readFileToNconf();

const dbConfig = {
  host: nconf.get("dbConfig:host"),
  user: nconf.get("dbConfig:user"),
  password: nconf.get("dbConfig:password"),
  database: nconf.get("dbConfig:database"),
  waitForConnections: nconf.get("dbConfig:waitForConnections"),
  connectionLimit: nconf.get("dbConfig:connectionLimit"),
  queueLimit: nconf.get("dbConfig:queueLimit"),
  timezone: "+05:30",
  dateStrings: true,
};

export const pool = createPool(dbConfig);

export const query = (sql, params) => {
  return new Promise((resolve, reject) => {
    pool.query(sql, params, (error, results) => {
      if (error) {
        return reject(error);
      }
      resolve(results);
    });
  });
};
