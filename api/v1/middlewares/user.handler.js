import { readFileToNconf } from "../../../config/index.js";
import jwt from "jsonwebtoken";
import { sendApiError } from "../helpers/api.helper.js";
import logger from "../../../config/logger.js";

const nconf = readFileToNconf();

export const authenticateUserTokenMiddleware = async (req, res, next) => {
  const secret = nconf.get("accessTokenSecretForUser");
  const token = req.headers.authorization;

  try {
    const decoded = await new Promise((resolve, reject) => {
      jwt.verify(token, secret, (err, decoded) => {
        if (err) {
          resolve({
            isValid: false,
            error: err,
          });
        } else {
          resolve({
            isValid: true,
            data: { ...decoded },
          });
        }
      });
    });
    if (decoded.isValid) {
      req.user = decoded.data;
      next();
    } else {
      return sendApiError(res, "Invalid token", 401);
    }
  } catch (err) {
    logger.error(err, `error being received: [authenticateTokenMiddleware]`);
    return sendApiError(res, "Internal Server Error", 500);
  }
}
