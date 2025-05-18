import bunyan from "bunyan";

const logger = bunyan.createLogger({
  name: "service-name",
  level: "debug", // Logging level: 'fatal', 'error', 'warn', 'info', 'debug', 'trace'
  serializers: bunyan.stdSerializers, // Standard serializers for request and error objects
});

export default logger;
