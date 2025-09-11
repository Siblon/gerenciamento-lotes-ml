// src/debug/logger.js
const on = () => (/\bdebug=1\b/.test(location.search) || localStorage.DEBUG_RZ === '1');

export function createLogger(ns='APP'){
  const enabled = on();
  const tag = (lvl) => `%c${new Date().toISOString()} %c[${ns}] %c${lvl}`;
  const css = (color)=>['color:#999','color:#6a5acd;font-weight:bold',`color:${color};font-weight:bold`];

  function log(lvl,color,...args){
    if(!enabled) return;
    // eslint-disable-next-line no-console
    console.log(tag(lvl), ...css(color), ...args);
  }
  return {
    enabled,
    debug: (...a)=>log('DEBUG','#4caf50',...a),
    info : (...a)=>log('INFO' ,'#2196f3',...a),
    warn : (...a)=>log('WARN' ,'#ff9800',...a),
    error: (...a)=>log('ERROR','#f44336',...a),
    group: (title)=> on() && console.groupCollapsed?.(`[${ns}] ${title}`),
    groupEnd: ()=> on() && console.groupEnd?.()
  };
}

export function isDebug(){ return on(); }
