export interface BankConfig {
  id: string;
  name: string;
  loginUrl: string;
  credentialsEnvPrefix: string;
}

export const banks: BankConfig[] = [
  {
    id: 'supervielle',
    name: 'Banco Superville',
    loginUrl: 'https://personas.supervielle.com.ar/obi/usuarios/login',
    credentialsEnvPrefix: 'SUP',
  },
  {
    id: 'galicia',
    name: 'Banco Galicia',
    loginUrl: 'https://onlinebanking.bancogalicia.com.ar/login',
    credentialsEnvPrefix: 'GGAL',
  },
];
