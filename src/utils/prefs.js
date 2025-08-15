export const PREFS_KEY = 'ui:prefs:v1';

const DEFAULT_PREFS = {
  showFinance: false,
  showIndicators: false,
  calcFreteMode: 'finalizar',
};

export function loadPrefs(){
  try{
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
    return { ...DEFAULT_PREFS, ...saved };
  }catch{
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(p){
  localStorage.setItem(PREFS_KEY, JSON.stringify(p||{}));
}
