import { createPool } from "mysql2";

const dbConfig = {
  host: "<HOST>",
  user: "<USER>",
  password: "<PASSWORD>",
  database: "<DB>",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
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
