// Configuração pública do Supabase.
// NÃO coloque Secret Key / Service Role Key aqui.

export const SUPABASE_URL =
  "https://pkktnavscnhusqwetexb.supabase.co";

export const SUPABASE_ANON_KEY =
  "sb_publishable_828AQlvKrmBT7hwX8q3nQw_ZXROUtFF";

/* Thoune Store — seleção da loja */
const params = new URLSearchParams(window.location.search);
const requestedStore = (params.get("store") || "").toLowerCase();
export const STORE_TYPE = requestedStore === "mm2" ? "mm2" : "ftf";
export const STORE_CONFIG = STORE_TYPE === "mm2"
  ? {
      key:"mm2", name:"Murder Mystery 2", shortName:"MM2",
      itemPlural:"facas e armas", itemSingular:"item",
      rarity:["Comum","Incomum","Raro","Lendário","Godly","Ancient","Unique","Vintage","Chroma"],
      heroTitle:"Encontre o item", heroEmphasis:"que combina com você.",
      heroSubtitle:"Facas e armas de Murder Mystery 2 organizadas por raridade e prontas para sua coleção.",
      catalogTitle:"Itens disponíveis", catalogSubtitle:"Encontre seu próximo item de Murder Mystery 2 sem complicação.",
      searchPlaceholder:"Pesquisar item pelo nome", welcomeKicker:"MURDER MYSTERY 2"
    }
  : {
      key:"ftf", name:"Flee the Facility", shortName:"Flee the Facility",
      itemPlural:"marretas", itemSingular:"marreta",
      rarity:["Lendária","Épica","Rara","Comum","Exclusiva","Atualização"],
      heroTitle:"Encontre a marreta", heroEmphasis:"que combina com você.",
      heroSubtitle:"Marretas para Flee the Facility organizadas por raridades e prontas para você escolher.",
      catalogTitle:"Marretas disponíveis", catalogSubtitle:"Encontre sua próxima marreta sem complicação.",
      searchPlaceholder:"Pesquisar marreta pelo nome", welcomeKicker:"FLEE THE FACILITY"
    };
