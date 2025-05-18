import { createPool } from "mysql2";

const dbConfig = {
  host: "lms-stage.cri6wqugy0ti.ap-south-1.rds.amazonaws.com",
  user: "admin",
  password: "1BlackHorse>2BlackCar",
  database: "lms-backend",
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
