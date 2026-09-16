export function getMssqlConfig() {
  return {
    server: process.env.MSSQL_SERVER,
    database: process.env.MSSQL_DATABASE,
    user: process.env.MSSQL_USER,
    password: process.env.MSSQL_PASSWORD,
    port: process.env.MSSQL_PORT ? Number(process.env.MSSQL_PORT) : 1433,
    options: {
      encrypt: process.env.MSSQL_ENCRYPT === 'true',
      trustServerCertificate: process.env.MSSQL_TRUST_SERVER_CERTIFICATE !== 'false',
    },
    connectionTimeout: 15000,
    requestTimeout: 30000,
  };
}
