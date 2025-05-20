export const sendApiError = (res, error, statusCode = 500) => {
  return res.status(statusCode).json({ message: "failure", error });
};

export const sendApiResponse = (res, data, statusCode = 200) => {
  return res.status(statusCode).json({
    message: "success",
    data,
  });
};