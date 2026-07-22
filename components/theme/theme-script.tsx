import {
  MODO_DEFAULT,
  STORAGE_MODO,
  STORAGE_TEMA,
  TEMAS,
  TEMA_DEFAULT,
} from "@/lib/theme/temas"

/**
 * Script anti-FOUC: corre ANTES de pintar y fija data-theme + la clase .dark en
 * <html> desde localStorage, para que la app no aparezca con el tema/modo
 * equivocado un instante. Es JS plano (no React) porque debe ejecutarse durante
 * el parseo, antes de la hidratación. Va como primer hijo de <body>.
 *
 * Debe coincidir con la lógica de temas.ts / aplicar-dom.ts; se mantiene mínimo a
 * propósito. Las claves y valores válidos se inyectan desde las constantes para
 * que no se desincronicen.
 */
export function ThemeScript() {
  const ids = JSON.stringify(TEMAS.map((t) => t.id))
  const js = `(function(){try{
var IDS=${ids};
var t=localStorage.getItem(${JSON.stringify(STORAGE_TEMA)});
if(IDS.indexOf(t)===-1)t=${JSON.stringify(TEMA_DEFAULT)};
var m=localStorage.getItem(${JSON.stringify(STORAGE_MODO)})||${JSON.stringify(MODO_DEFAULT)};
var dark=m==="oscuro"||(m!=="claro"&&window.matchMedia("(prefers-color-scheme: dark)").matches);
var el=document.documentElement;
el.setAttribute("data-theme",t);
el.classList.toggle("dark",dark);
}catch(e){}})();`
  return <script dangerouslySetInnerHTML={{ __html: js }} />
}
