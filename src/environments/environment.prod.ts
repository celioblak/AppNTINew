export const environment = {
  production: true,
  baseUrl: '',
  ApiBaseUrl: window.location.origin + window.location.pathname.substring(0, window.location.pathname.indexOf('/',2)+1)+'api/',
  //ApiBaseUrl: window.location.origin + '/ntiapi/api/',
  hbServiceBaseUrl: `http://127.0.0.1:9071`,
  webSockerBaseUrl:'ws:/'+window.location.host+ window.location.pathname.substring(0, window.location.pathname.indexOf('/',2)+1)+'socket',
  //webSockerBaseUrl:'ws:/'+window.location.host + '/ntiapi/socket',
  useHash: false,
};

